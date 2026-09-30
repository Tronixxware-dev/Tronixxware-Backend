const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    fullName: { type: String, default: '' },
    email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    phone: { type: String, trim: true, unique: true, sparse: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

customerSchema.pre('validate', function (next) {
  if (!this.email && !this.phone) {
    return next(new Error('Either email or phone is required'));
  }
  next();
});

module.exports = mongoose.model('Customer', customerSchema);