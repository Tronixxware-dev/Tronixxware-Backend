const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');

function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TRX-${y}${m}${d}-${rand}`;
}

function computeUnitPrice(product, quantity) {
  if (product.bulk && quantity >= product.bulk.minQty) {
    return product.bulk.pricePerUnit;
  }
  return product.price;
}

async function buildAndSaveOrder({
  items,
  customer,
  shippingAddress,
  notes,
  paymentStatus,
  paymentProvider,
  paymentReference,
  exchangeRateUsed,
  amountPaidNgn,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Order must contain at least one item');
    err.status = 400;
    throw err;
  }
  if (!customer || !customer.fullName || !customer.email || !customer.phone) {
    const err = new Error('Customer full name, email and phone are required');
    err.status = 400;
    throw err;
  }
  if (
    !shippingAddress ||
    !shippingAddress.address ||
    !shippingAddress.city ||
    !shippingAddress.state ||
    !shippingAddress.country
  ) {
    const err = new Error('Shipping address is incomplete');
    err.status = 400;
    throw err;
  }

  const session = await mongoose.startSession();
  let savedOrder;

  try {
    await session.withTransaction(async () => {
      const orderItems = [];
      let subtotal = 0;

      for (const item of items) {
        const product = await Product.findOne({ id: item.productId }).session(session);
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

        product.unitStock -= quantity;
        await product.save({ session });
      }

      const orderNumber = generateOrderNumber();

      const [order] = await Order.create(
        [
          {
            orderNumber,
            items: orderItems,
            subtotal,
            customer,
            shippingAddress,
            notes,
            paymentStatus: paymentStatus || 'unpaid',
            paymentProvider,
            paymentReference,
            exchangeRateUsed,
            amountPaidNgn,
          },
        ],
        { session }
      );

      savedOrder = order;
    });
  } finally {
    session.endSession();
  }

  return savedOrder;
}

exports.createOrder = async (req, res, next) => {
  try {
    const { items, customer, shippingAddress, notes, paymentStatus } = req.body;
    const order = await buildAndSaveOrder({
      items,
      customer,
      shippingAddress,
      notes,
      paymentStatus: paymentStatus || 'unpaid',
    });
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
    }
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

exports.buildAndSaveOrder = buildAndSaveOrder;