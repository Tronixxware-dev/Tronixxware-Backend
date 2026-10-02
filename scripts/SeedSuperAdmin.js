require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

async function run() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in your .env file before running this script.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await Admin.findOne({ email: normalizedEmail });
  if (existing) {
    console.log(`An admin with email ${normalizedEmail} already exists — nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await Admin.create({ email: normalizedEmail, passwordHash, role: 'superadmin' });

  console.log(`Superadmin account created for ${normalizedEmail}.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});