const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { computeUnitPrice } = require('./orderController');
const { getUsdToNgnRate } = require('../services/exchangeRate');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const RESERVATION_TTL_MS = 20 * 60 * 1000; // hold stock for 20 minutes while the customer is on Paystack's page

function paystackHeaders() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
}

function generateReference() {
  return `TRX-PAY-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TRX-${y}${m}${d}-${rand}`;
}

// Releases a single reservation: restores stock for every line item and
// marks the order so it stops holding inventory hostage. Used both for a
// checkout Paystack reports as failed, and for one that simply timed out.
async function releaseReservation(order, finalPaymentStatus) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const item of order.items) {
        await Product.updateOne(
          { id: item.productId },
          { $inc: { unitStock: item.quantity } },
          { session }
        );
      }
      order.paymentStatus = finalPaymentStatus;
      order.status = 'cancelled';
      order.reservationExpiresAt = undefined;
      await order.save({ session });
    });
  } finally {
    session.endSession();
  }
}

// Safety net: anything still 'pending' past its reservation window gets its
// stock handed back automatically. Run before every new checkout (so the
// products someone is about to buy are accurately in stock) and on a timer
// in server.js (so stock isn't held hostage just because nobody else
// happens to check out afterwards).
async function releaseExpiredReservations() {
  const expired = await Order.find({
    paymentStatus: 'pending',
    reservationExpiresAt: { $lt: new Date() },
  });

  for (const order of expired) {
    try {
      await releaseReservation(order, 'expired');
    } catch (err) {
      console.error(`Failed to release expired reservation for order ${order.orderNumber}:`, err);
    }
  }
}

// Validates the cart, reserves stock for every line item, and creates a
// 'pending' Order — all inside one transaction, so either the whole
// reservation succeeds or none of it does and nothing is double-sold.
async function reserveStockAndCreatePendingOrder({ items, customer, shippingAddress, notes }) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Cart is empty');
    err.status = 400;
    throw err;
  }

  const session = await mongoose.startSession();
  let order;

  try {
    await session.withTransaction(async () => {
      const orderItems = [];
      let subtotal = 0;

      for (const item of items) {
        const quantity = Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity < 1) {
          const err = new Error(`Invalid quantity for product: ${item.productId}`);
          err.status = 400;
          throw err;
        }

        // Atomic check-and-decrement: this only succeeds if unitStock is
        // still >= quantity at the moment it runs, so two customers racing
        // for the last unit can never both win.
        const product = await Product.findOneAndUpdate(
          { id: item.productId, unitStock: { $gte: quantity } },
          { $inc: { unitStock: -quantity } },
          { session, new: false }
        );

        if (!product) {
          const exists = await Product.findOne({ id: item.productId }).session(session);
          const err = new Error(
            exists ? `Not enough stock for ${exists.name}` : `Product not found: ${item.productId}`
          );
          err.status = 400;
          throw err;
        }

        const unitPrice = computeUnitPrice(product, quantity);
        const lineTotal = unitPrice * quantity;
        subtotal += lineTotal;

        const color = product.colors?.find((c) => c.name === item.colorName);

        orderItems.push({
          productId: product.id,
          name: product.name,
          brand: product.brand,
          image: product.image,
          colorName: color ? color.name : item.colorName,
          quantity,
          unitPrice,
          lineTotal,
        });
      }

      const [created] = await Order.create(
        [
          {
            orderNumber: generateOrderNumber(),
            items: orderItems,
            subtotal,
            customer,
            shippingAddress,
            notes,
            paymentStatus: 'pending',
            reservationExpiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
          },
        ],
        { session }
      );

      order = created;
    });
  } finally {
    session.endSession();
  }

  return order;
}

// POST /api/payments/initialize
// Reserves real stock and a real (pending) Order up front, converts its USD
// subtotal to Naira at the current live rate, and asks Paystack for a
// hosted checkout URL. If Paystack's own API call fails, the reservation is
// released immediately so stock isn't held for nothing.
exports.initializePayment = async (req, res, next) => {
  let order;
  try {
    const { items, customer, shippingAddress, notes } = req.body;

    if (!customer || !customer.fullName || !customer.email || !customer.phone) {
      return res.status(400).json({ error: 'Customer full name, email and phone are required' });
    }
    if (
      !shippingAddress ||
      !shippingAddress.address ||
      !shippingAddress.city ||
      !shippingAddress.state ||
      !shippingAddress.country
    ) {
      return res.status(400).json({ error: 'Shipping address is incomplete' });
    }

    await releaseExpiredReservations();

    order = await reserveStockAndCreatePendingOrder({ items, customer, shippingAddress, notes });

    const rate = await getUsdToNgnRate();
    const amountNgn = Math.round(order.subtotal * rate);

    order.exchangeRateUsed = rate;
    order.amountPaidNgn = amountNgn;
    order.paymentReference = generateReference();
    await order.save();

    const paystackRes = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email: customer.email,
        amount: amountNgn * 100, // Paystack expects the amount in kobo
        currency: 'NGN',
        reference: order.paymentReference,
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/callback`,
        metadata: { orderId: order._id.toString() },
      },
      { headers: paystackHeaders() }
    );

    const { authorization_url, access_code } = paystackRes.data.data;
    res.json({ authorization_url, access_code, reference: order.paymentReference, amountNgn, rate });
  } catch (err) {
    // Don't hold stock hostage for a checkout that never made it to Paystack.
    if (order && order.paymentStatus === 'pending') {
      await releaseReservation(order, 'failed').catch((releaseErr) =>
        console.error('Failed to release reservation after initialize error:', releaseErr)
      );
    }
    if (err.response) {
      console.error('Paystack initialize error:', err.response.data);
      return res.status(err.response.status || 502).json({
        error: err.response.data?.message || 'Failed to initialize payment',
      });
    }
    res.status(err.status || 500).json({ error: err.message || 'Failed to initialize payment' });
  }
};

// Shared: verify a reference with Paystack and finalize the matching
// pending order. Safe to call twice for the same reference — both the
// callback-verify endpoint and the webhook call this.
async function confirmPayment(reference) {
  const order = await Order.findOne({ paymentReference: reference });
  if (!order) {
    const err = new Error('No matching order for this payment reference');
    err.status = 404;
    throw err;
  }

  if (order.paymentStatus === 'paid') return order; // already confirmed, idempotent

  if (order.paymentStatus !== 'pending') {
    // Already failed/expired — its stock has been released, possibly sold
    // to someone else since. Don't resurrect it automatically; this needs a
    // human to reconcile against the Paystack dashboard.
    const err = new Error(
      'This checkout session is no longer active. If you were charged, please contact support with your reference.'
    );
    err.status = 409;
    throw err;
  }

  const verifyRes = await axios.get(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    headers: paystackHeaders(),
  });

  const data = verifyRes.data.data;

  if (!data || data.status !== 'success') {
    await releaseReservation(order, 'failed');
    const err = new Error('Payment was not successful');
    err.status = 400;
    throw err;
  }

  // Defense in depth: confirm the amount Paystack actually received matches
  // what we asked for, using the amount WE stored at initialize time —
  // never something that round-tripped through a third party.
  const expectedKobo = Math.round((order.amountPaidNgn || 0) * 100);
  if (expectedKobo && data.amount !== expectedKobo) {
    await releaseReservation(order, 'failed');
    const err = new Error('Paid amount does not match the expected order total');
    err.status = 400;
    throw err;
  }

  order.paymentStatus = 'paid';
  order.paymentProvider = 'paystack';
  order.reservationExpiresAt = undefined;
  await order.save();

  return order;
}

// GET /api/payments/verify/:reference — called by the frontend right after
// Paystack redirects the customer back to /checkout/callback.
exports.verifyPayment = async (req, res) => {
  try {
    const order = await confirmPayment(req.params.reference);
    res.json(order);
  } catch (err) {
    if (err.response) {
      console.error('Paystack verify error:', err.response.data);
      return res.status(err.response.status || 502).json({
        error: err.response.data?.message || 'Failed to verify payment',
      });
    }
    res.status(err.status || 500).json({ error: err.message || 'Payment verification failed' });
  }
};

// POST /api/payments/webhook — Paystack calls this server-to-server as a
// reliable backup in case the customer closes their browser before the
// redirect back to /checkout/callback completes. Verified via the
// x-paystack-signature header (HMAC-SHA512 over the raw request body) so we
// know it genuinely came from Paystack — this is why server.js captures
// req.rawBody rather than just the parsed JSON.
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'] || '';
    const expected = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(req.rawBody)
      .digest('hex');

    const signatureBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureValid =
      signatureBuf.length === expectedBuf.length && crypto.timingSafeEqual(signatureBuf, expectedBuf);

    if (!signatureValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    if (event.event === 'charge.success') {
      await confirmPayment(event.data.reference);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook handling error:', err);
    // Still respond 200 so Paystack doesn't retry forever on our own bug —
    // the callback-verify path covers the customer-facing case regardless.
    res.sendStatus(200);
  }
};

exports.releaseExpiredReservations = releaseExpiredReservations;