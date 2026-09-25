const express = require('express');
const router = express.Router();
const { getExchangeRate } = require('../controllers/exchangeRateController');

router.get('/', getExchangeRate);

module.exports = router;