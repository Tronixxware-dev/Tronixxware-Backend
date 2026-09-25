require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/Product');

const products = [
  {
    id: 'p-iphone-15-pro',
    category: 'phones',
    brand: 'Apple',
    name: 'iPhone 15 Pro',
    specs: ['256GB', 'Titanium', '5G'],
    condition: 'New',
    description:
      'Forged titanium design with the A17 Pro chip and a pro camera system built for everyday power users. Sealed in original retail packaging with full manufacturer warranty.',
    image: '/products/iphone-15-pro.png',
    colors: [
      { name: 'Natural Titanium', hex: '#8a8a86' },
      { name: 'Blue Titanium', hex: '#3f4a56' },
      { name: 'Black Titanium', hex: '#1c1c1e' },
    ],
    price: 999,
    compareAtPrice: 1099,
    rating: 4.8,
    reviews: 214,
    unitStock: 34,
    bulk: { minQty: 10, pricePerUnit: 899 },
  },
  {
    id: 'p-galaxy-s24',
    category: 'phones',
    brand: 'Samsung',
    name: 'Galaxy S24 Ultra',
    specs: ['512GB', 'Snapdragon 8 Gen 3', '5G'],
    condition: 'New',
    description:
      "Samsung's flagship with a built-in S Pen, a 200MP main sensor, and Snapdragon 8 Gen 3 performance tuned for gaming and multitasking.",
    image: '/products/galaxy-s24-ultra.png',
    colors: [
      { name: 'Titanium Gray', hex: '#5a5c5f' },
      { name: 'Titanium Violet', hex: '#7c6a8a' },
    ],
    price: 1149,
    compareAtPrice: null,
    rating: 4.7,
    reviews: 168,
    unitStock: 51,
    bulk: { minQty: 10, pricePerUnit: 1029 },
  },
  {
    id: 'p-pixel-9',
    category: 'phones',
    brand: 'Google',
    name: 'Pixel 9 Pro',
    specs: ['128GB', 'Tensor G4', '5G'],
    condition: 'Refurbished',
    description:
      "Certified refurbished and fully tested — Google's Tensor G4 chip, a clean stock Android experience, and class-leading computational photography.",
    image: '/products/pixel-9-pro.png',
    colors: [
      { name: 'Obsidian', hex: '#141414' },
      { name: 'Porcelain', hex: '#e9e5df' },
    ],
    price: 649,
    compareAtPrice: 799,
    rating: 4.5,
    reviews: 92,
    unitStock: 18,
    bulk: { minQty: 5, pricePerUnit: 599 },
  },
  {
    id: 'p-macbook-pro-14',
    category: 'laptops',
    brand: 'Apple',
    name: 'MacBook Pro 14"',
    specs: ['M3 Pro', '18GB RAM', '512GB SSD'],
    condition: 'New',
    description:
      "Apple's M3 Pro chip delivers pro-grade performance in a compact 14-inch body, with a Liquid Retina XDR display built for color-critical work.",
    image: '/products/macbook-pro-14.jpg',
    colors: [
      { name: 'Space Black', hex: '#2b2b2c' },
      { name: 'Silver', hex: '#e5e5e5' },
    ],
    price: 1899,
    compareAtPrice: 1999,
    rating: 4.9,
    reviews: 301,
    unitStock: 22,
    bulk: { minQty: 5, pricePerUnit: 1749 },
  },
  {
    id: 'p-xps-15',
    category: 'laptops',
    brand: 'Dell',
    name: 'XPS 15',
    specs: ['Core Ultra 7', '32GB RAM', '1TB SSD'],
    condition: 'New',
    description:
      'A 15-inch workhorse with a 13th-gen Intel Core Ultra 7, 32GB of RAM, and a 1TB SSD — built for heavy multitasking and content creation.',
    image: '/products/xps-15.jpg',
    colors: [{ name: 'Platinum', hex: '#c9cbcd' }],
    price: 1599,
    compareAtPrice: null,
    rating: 4.6,
    reviews: 74,
    unitStock: 15,
    bulk: null,
  },
  {
    id: 'p-thinkpad-x1',
    category: 'laptops',
    brand: 'Lenovo',
    name: 'ThinkPad X1 Carbon',
    specs: ['Core i7', '16GB RAM', '512GB SSD'],
    condition: 'Open-box',
    description:
      "Open-box unit in excellent condition. Lenovo's legendary keyboard, carbon-fiber chassis, and enterprise-grade reliability at a fraction of retail.",
    image: '/products/thinkpad-x1.png',
    colors: [{ name: 'Black', hex: '#161616' }],
    price: 1099,
    compareAtPrice: 1349,
    rating: 4.4,
    reviews: 58,
    unitStock: 9,
    bulk: { minQty: 5, pricePerUnit: 999 },
  },
];

async function seed() {
  await connectDB();
  await Product.deleteMany({});
  await Product.insertMany(products);
  console.log(`Seeded ${products.length} products`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});