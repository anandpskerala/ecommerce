const express = require('express');
const routes = express.Router();
const auth = require('../middlewares/user_authentication');
const controllers = require('../controllers/user/payment_controller');

routes.post('/razorpay/order', auth.authenticateUserApi, controllers.createPayment);
routes.post('/razorpay/verify-payment', auth.authenticateUserApi, controllers.verifyPayment);
routes.post('/razorpay/retry-payment', auth.authenticateUserApi, controllers.retryPayment);
routes.patch('/razorpay/set-payment-status', auth.authenticateUserApi, controllers.setPaymentStatus);

module.exports = routes;