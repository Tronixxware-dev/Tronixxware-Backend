const { getUsdToNgnRate } = require('../services/exchangeRate');

// GET /api/exchange-rate — public. The frontend calls this to display
// live Naira prices; the backend independently calls the same cached
// helper when it actually charges via Paystack.
exports.getExchangeRate = async (req, res, next) => {
  try {
    const usdToNgn = await getUsdToNgnRate();
    res.json({ usdToNgn });
  } catch (err) {
    next(err);
  }
};