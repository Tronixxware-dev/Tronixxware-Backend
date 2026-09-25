const axios = require('axios');
const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { buildAndSaveOrder } = require('./orderController');
const { getUsdToNgnRate } = require('../services/exchangeRate');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function paystackHeaders() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
}

function generateReference() {
  return `TRX-PAY-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

// Re-derive the subtotal server-side in USD (never trust a client-sent
// amount), using the same bulk-aware pricing logic as order creation.
async function computeCheckoutTotalUsd(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Cart is empty');
    err.status = 400;
    throw err;
  }

  let subtotal = 0;
  for (const item of items) {
    const product = await Product.findOne({ id: item.productId });
    if (!product) {
      const err = new Error(`Product not found: ${item.productId}`);
      err.status = 400;
      throw err;
    }
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      const err = new Error(`Invalid quantity for product: ${item.productId}`);
      err.status = 400;
      throw err;
    }
    if (product.unitStock < quantity) {
      const err = new Error(`Not enough stock for ${product.name}`);
      err.status = 400;
      throw err;
    }
    const unitPrice =
      product.bulk && quantity >= product.bulk.minQty ? product.bulk.pricePerUnit : product.price;
    subtotal += unitPrice * quantity;
  }
  return subtotal;
}

// POST /api/payments/initialize
// Validates the cart, converts the real USD total to Naira at the current
// live rate, and asks Paystack for a hosted checkout URL. The full checkout
// payload rides along as Paystack metadata (set by us, not the client) so we
// can safely rebuild the order once payment is confirmed.
exports.initializePayment = async (req, res, next) => {
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

    const subtotalUsd = await computeCheckoutTotalUsd(items);
    const rate = await getUsdToNgnRate();
    const amountNgn = Math.round(subtotalUsd * rate);
    const reference = generateReference();

    const paystackRes = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email: customer.email,
        amount: amountNgn * 100, // Paystack expects the amount in kobo
        currency: 'NGN',
        reference,
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/callback`,
        metadata: {
          items,
          customer,
          shippingAddress,
          notes: notes || '',
          exchangeRateUsed: rate,
          amountPaidNgn: amountNgn,
        },
      },
      { headers: paystackHeaders() }
    );

    const { authorization_url, access_code } = paystackRes.data.data;
    res.json({ authorization_url, access_code, reference, amountNgn, rate });
  } catch (err) {
    if (err.response) {
      console.error('Paystack initialize error:', err.response.data);
      return res.status(err.response.status || 502).json({
        error: err.response.data?.message || 'Failed to initialize payment',
      });
    }
    res.status(err.status || 500).json({ error: err.message || 'Failed to initialize payment' });
  }
};

// Shared: verify a reference with Paystack, and if it's a genuine successful
// payment we haven't recorded yet, create the real Order from the metadata
// we set at initialize time. Safe to call twice for the same reference —
// both the callback-verify endpoint and the webhook call this.
async function confirmAndCreateOrder(reference) {
  const existing = await Order.findOne({ paymentReference: reference });
  if (existing) return existing;

  const verifyRes = await axios.get(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    headers: paystackHeaders(),
  });

  const data = verifyRes.data.data;
  if (!data || data.status !== 'success') {
    const err = new Error('Payment was not successful');
    err.status = 400;
    throw err;
  }

  const { items, customer, shippingAddress, notes, exchangeRateUsed, amountPaidNgn } =
    data.metadata || {};
  if (!items || !customer || !shippingAddress) {
    const err = new Error('Payment succeeded but order details were missing from metadata');
    err.status = 500;
    throw err;
  }

  // Defense in depth: confirm the amount Paystack actually received matches
  // what we asked for, in case metadata was ever tampered with in transit.
  const expectedKobo = Math.round((amountPaidNgn || 0) * 100);
  if (expectedKobo && data.amount !== expectedKobo) {
    const err = new Error('Paid amount does not match the expected order total');
    err.status = 400;
    throw err;
  }

  const order = await buildAndSaveOrder({
    items,
    customer,
    shippingAddress,
    notes,
    paymentStatus: 'paid',
    paymentProvider: 'paystack',
    paymentReference: reference,
    exchangeRateUsed,
    amountPaidNgn,
  });

  return order;
}

// GET /api/payments/verify/:reference — called by the frontend right after
// Paystack redirects the customer back to /checkout/callback.
exports.verifyPayment = async (req, res) => {
  try {
    const order = await confirmAndCreateOrder(req.params.reference);
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
// x-paystack-signature header so we know it genuinely came from Paystack.
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const expected = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(req.rawBody)
      .digest('hex');

    if (!signature || signature !== expected) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    if (event.event === 'charge.success') {
      await confirmAndCreateOrder(event.data.reference);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook handling error:', err);
    res.sendStatus(200);
  }
};