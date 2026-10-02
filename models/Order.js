const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    brand: { type: String },
    image: { type: String },
    colorName: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    // Set when the customer was logged in at checkout. Left unset for
    // guest checkouts — those orders just live on paymentReference/email.
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true }, // in Naira — the store's base currency
    customer: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    shippingAddress: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String },
      country: { type: String, required: true },
    },
    notes: { type: String },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    // 'pending'  — stock is reserved, waiting on the customer to finish paying on Paystack
    // 'paid'     — payment confirmed, this is a real order
    // 'failed'   — Paystack reported the payment failed (or it never got that far); stock released
    // 'expired'  — the customer never came back to finish checkout; stock released
    // 'unpaid'   — manual/admin-entered order that was never meant to go through Paystack
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'pending', 'paid', 'failed', 'expired'],
      default: 'unpaid',
    },
    paymentProvider: { type: String, default: undefined },
    paymentReference: { type: String, unique: true, sparse: true },
    // Bookkeeping for what actually happened at checkout, since the
    // USD→NGN rate can drift between orders — keeps each order's real
    // history accurate even if today's live rate is different.
    exchangeRateUsed: { type: Number },
    amountPaidNgn: { type: Number },
    // Only meaningful while paymentStatus is 'pending' — once this passes,
    // the reservation is released back to stock (see paymentController).
    reservationExpiresAt: { type: Date },
    // Set true when a payment was confirmed late (after the reservation
    // already expired and stock was released/possibly resold) and we
    // couldn't fully re-reserve it. The order is still marked 'paid' —
    // the customer's money is real — but this needs a human to check
    // stock/fulfillment for it.
    stockConflict: { type: Boolean, default: false },
  },
  { timestamps: true }
);

orderSchema.index({ paymentStatus: 1, reservationExpiresAt: 1 });
orderSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);