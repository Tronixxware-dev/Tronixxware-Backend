require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const exchangeRateRoutes = require('./routes/exchangeRateRoutes');
const customerAuthRoutes = require('./routes/customerAuthRoutes');
const customerOrderRoutes = require('./routes/customerOrderRoutes');
const { releaseExpiredReservations } = require('./controllers/paymentController');

const REQUIRED_ENV_VARS = ['JWT_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'PAYSTACK_SECRET_KEY'];
const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variable(s): ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();

// Only needed if this app sits behind a reverse proxy / platform load
// balancer (Render, Railway, Heroku, Nginx, etc.) — it's what lets
// express-rate-limit (and req.ip generally) see the real client IP instead
// of the proxy's. Remove this line if you're running on a bare VPS with no
// proxy in front, since trusting it unnecessarily lets a caller spoof their
// IP via the X-Forwarded-For header.
app.set('trust proxy', 1);

connectDB();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));

// Captures the raw request body alongside Express's parsed JSON, so the
// Paystack webhook handler can verify the x-paystack-signature header
// against the exact bytes Paystack sent (a HMAC check breaks if you
// verify against a re-serialized copy of the body instead of the original).
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
app.use('/api/customers', customerAuthRoutes);
app.use('/api/my-orders', customerOrderRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// Safety net for abandoned checkouts: if a customer never completes (or
// never returns from) payment, this hands their reserved stock back after
// the reservation window passes instead of holding it hostage forever. The
// same cleanup also runs at the start of every new checkout.
const RESERVATION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  releaseExpiredReservations().catch((err) =>
    console.error('Scheduled reservation cleanup failed:', err)
  );
}, RESERVATION_CLEANUP_INTERVAL_MS);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Tronixxware API listening on port ${PORT}`));