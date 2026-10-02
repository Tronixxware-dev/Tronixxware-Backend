const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ['superadmin', 'product_uploader'],
      default: 'product_uploader',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);