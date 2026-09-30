const express = require('express');
const router = express.Router();
const { register, login, me } = require('../controllers/customerAuthController');
const requireCustomer = require('../middleware/requireCustomer');

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireCustomer, me);

module.exports = router;