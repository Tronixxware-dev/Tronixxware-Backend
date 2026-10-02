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
    minQty: { type: Number, required: true, min: 2 },
    pricePerUnit: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    // A short, URL-friendly identifier — this is what carts, orders and the
    // product detail page (/products/:id) key off of, NOT Mongo's _id.
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    brand: { type: String, required: true },
    image: { type: String, required: true },
    gallery: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0 }, // Naira — the store's base currency
    compareAtPrice: { type: Number, min: 0 },
    unitStock: { type: Number, required: true, min: 0, default: 0 },

    // New admin fields (category + the per-category spec fields the admin
    // form now collects). These are plain strings so any category can use
    // whichever of them apply — the frontend only sends the relevant ones.
    category: { type: String, required: true, default: 'phones' },
    storage: { type: String, default: '' },
    cardSlot: { type: String, default: '' },
    inches: { type: String, default: '' },
    operatingSystem: { type: String, default: '' },
    colorOption: { type: String, default: '' },

    // Kept for backward compatibility with older products — no longer set
    // by the admin form, but left in place in case anything else reads them.
    colors: { type: [colorSchema], default: undefined },
    bulk: { type: bulkSchema, default: undefined },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviews: { type: Number, min: 0, default: 0 },
    specs: { type: [String], default: [] },
    condition: { type: String, default: 'New' },
    description: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);