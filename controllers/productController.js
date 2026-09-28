const Product = require('../models/Product');

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function generateUniqueId(name) {
  const base = slugify(name) || 'product';
  let candidate = base;
  let suffix = 0;
  // Keep trying until we find an id that isn't already taken.
  while (await Product.exists({ id: candidate })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

function validateProductPayload(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (!partial || body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string') errors.push('name is required');
    else data.name = body.name.trim();
  }
  if (!partial || body.brand !== undefined) {
    if (!body.brand || typeof body.brand !== 'string') errors.push('brand is required');
    else data.brand = body.brand.trim();
  }
  if (!partial || body.image !== undefined) {
    if (!body.image || typeof body.image !== 'string') errors.push('image URL is required');
    else data.image = body.image.trim();
  }
  if (body.gallery !== undefined) {
    if (Array.isArray(body.gallery)) {
      data.gallery = body.gallery.map((g) => String(g).trim()).filter(Boolean);
    } else {
      errors.push('gallery must be an array of image URLs');
    }
  }
  if (!partial || body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) errors.push('price must be a non-negative number');
    else data.price = price;
  }
  if (body.compareAtPrice !== undefined) {
    if (body.compareAtPrice === null || body.compareAtPrice === '') {
      data.compareAtPrice = undefined; // explicit clear — handled as $unset by the caller
    } else {
      const compareAtPrice = Number(body.compareAtPrice);
      if (!Number.isFinite(compareAtPrice) || compareAtPrice < 0) {
        errors.push('compareAtPrice must be a non-negative number');
      } else {
        data.compareAtPrice = compareAtPrice;
      }
    }
  }
  if (!partial || body.unitStock !== undefined) {
    const unitStock = Number(body.unitStock);
    if (!Number.isFinite(unitStock) || unitStock < 0) errors.push('unitStock must be a non-negative number');
    else data.unitStock = unitStock;
  }
  if (body.condition !== undefined) data.condition = String(body.condition).trim() || 'New';
  if (body.description !== undefined) data.description = String(body.description);
  if (body.rating !== undefined) {
    const rating = Number(body.rating);
    if (Number.isFinite(rating)) data.rating = Math.min(5, Math.max(0, rating));
  }
  if (body.reviews !== undefined) {
    const reviews = Number(body.reviews);
    if (Number.isFinite(reviews)) data.reviews = Math.max(0, reviews);
  }
  if (body.specs !== undefined) {
    if (Array.isArray(body.specs)) {
      data.specs = body.specs.map((s) => String(s).trim()).filter(Boolean);
    } else {
      errors.push('specs must be an array of strings');
    }
  }
  if (body.colors !== undefined) {
    if (body.colors === null) {
      data.colors = undefined;
    } else if (Array.isArray(body.colors)) {
      const cleaned = body.colors
        .map((c) => ({ name: String(c?.name || '').trim(), hex: String(c?.hex || '').trim() }))
        .filter((c) => c.name && c.hex);
      data.colors = cleaned.length > 0 ? cleaned : undefined;
    } else {
      errors.push('colors must be an array of { name, hex }');
    }
  }
  if (body.bulk !== undefined) {
    if (body.bulk === null || body.bulk === '') {
      data.bulk = undefined;
    } else {
      const minQty = Number(body.bulk.minQty);
      const pricePerUnit = Number(body.bulk.pricePerUnit);
      if (!Number.isFinite(minQty) || minQty < 2 || !Number.isFinite(pricePerUnit) || pricePerUnit < 0) {
        errors.push('bulk.minQty must be >= 2 and bulk.pricePerUnit must be a non-negative number');
      } else {
        data.bulk = { minQty, pricePerUnit };
      }
    }
  }

  return { data, errors };
}

// GET /api/products — public storefront listing.
exports.getProducts = async (req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    next(err);
  }
};

// GET /api/products/:id — public product detail page. Matches the short
// `id` field (e.g. "iphone-15-pro"), not Mongo's _id.
exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
};

// POST /api/products — admin-only. Auto-generates a URL-friendly `id` from
// the name if one isn't supplied.
exports.createProduct = async (req, res, next) => {
  try {
    const { data, errors } = validateProductPayload(req.body);
    if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });

    let id = req.body.id ? slugify(String(req.body.id)) : '';
    if (id) {
      if (await Product.exists({ id })) {
        return res.status(400).json({ error: `Product id "${id}" is already in use` });
      }
    } else {
      id = await generateUniqueId(data.name);
    }

    const product = await Product.create({ ...data, id });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/products/:id — admin-only. Partial update; only fields present
// in the request body are changed. A field explicitly cleared (null/'')
// gets $unset rather than left stale in the document.
exports.updateProduct = async (req, res, next) => {
  try {
    const { data, errors } = validateProductPayload(req.body, { partial: true });
    if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });

    const setFields = {};
    const unsetFields = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) unsetFields[key] = '';
      else setFields[key] = value;
    }

    const update = {};
    if (Object.keys(setFields).length > 0) update.$set = setFields;
    if (Object.keys(unsetFields).length > 0) update.$unset = unsetFields;

    const product = await Product.findOneAndUpdate({ id: req.params.id }, update, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/products/:id — admin-only.
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findOneAndDelete({ id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};