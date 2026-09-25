const mongoose = require('mongoose');

const colorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    hex: { type: String, required: true },
  },
  { _id: false }
);

const bulkSchema = new mongoose.Schema(
  {
    minQty: { type: Number, required: true },
    pricePerUnit: { type: Number, required: true },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    brand: { type: String, required: true },
    name: { type: String, required: true },
    specs: { type: [String], default: [] },
    condition: { type: String, required: true },
    description: { type: String, default: '' },
    image: { type: String, required: true },
    colors: { type: [colorSchema], default: [] },
    price: { type: Number, required: true },
    compareAtPrice: { type: Number, default: null },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
    unitStock: { type: Number, required: true, default: 0 },
    bulk: { type: bulkSchema, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);