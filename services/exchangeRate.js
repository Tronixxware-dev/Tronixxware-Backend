const axios = require('axios');

// Simple in-memory cache so we don't hit the rate API on every request.
let cache = { rate: null, fetchedAt: 0 };
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // refresh every 6 hours
const FALLBACK_RATE = 1600; // only used if the live API fails AND we have no cached rate yet

async function getUsdToNgnRate() {
  const now = Date.now();
  if (cache.rate && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rate;
  }

  try {
    const res = await axios.get('https://open.er-api.com/v6/latest/USD');
    const rate = res.data?.rates?.NGN;
    if (typeof rate === 'number' && rate > 0) {
      cache = { rate, fetchedAt: now };
      return rate;
    }
    throw new Error('NGN rate missing from exchange rate API response');
  } catch (err) {
    console.error('Failed to fetch live USD→NGN rate:', err.message);
    if (cache.rate) return cache.rate; // serve the last known good rate rather than fail checkout
    return FALLBACK_RATE;
  }
}

module.exports = { getUsdToNgnRate };