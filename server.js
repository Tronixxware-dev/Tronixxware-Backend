require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const exchangeRateRoutes = require('./routes/exchangeRateRoutes');

const app = express();
connectDB();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get('/', (req, res) => res.json({ status: 'ok', message: 'Tronixxware API is running' }));

app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminAuthRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/exchange-rate', exchangeRateRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Tronixxware API listening on port ${PORT}`));