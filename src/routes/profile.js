const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middlewares/user_authentication');
const profile_controller = require('../controllers/user/profile_controller');
const authController = require('../controllers/user/auth_controller');
const cart_controller = require('../controllers/user/cart_controller');
const order_controller = require('../controllers/user/order_controller');
const user_model = require('../models/user_model');
const cart_model = require('../models/cart_model');
const coupon_model = require('../models/coupon_model');
const multer = require('../utils/multer');

const routes = express.Router();


routes.get("/verify-otp", authController.verifyOtp);

routes.get("/verify-signup", authController.verifySignup);

routes.get("/reset-password", authController.resetPassword);

routes.get("/account", auth.authenticateUser, profile_controller.profilePage);

routes.get("/orders", auth.authenticateUser, order_controller.orderPage);

routes.get("/pending-orders", auth.authenticateUser, order_controller.pendingOrders);

routes.get("/change-password", auth.authenticateUser, (req, res) => {
    return res.render('user/change_password', { title: "Change Password", cart_option: "page" });
});

routes.get("/carts", auth.authenticateUser, async (req, res) => {
    return res.render('user/cart_page', { title: "Cart", cart_option: "page" });
});

routes.post("/carts", auth.authenticateUserApi, cart_controller.loadCarts);

routes.get("/manage-address", auth.authenticateUser, profile_controller.manageAddressPage);

routes.get("/wishlists", auth.authenticateUser, cart_controller.wishlistPage);

routes.get("/referrals", auth.authenticateUser, profile_controller.referalPage);

routes.get("/checkout", auth.authenticateUser, cart_controller.checkoutPage);
routes.post("/checkout", auth.authenticateUserApi, cart_controller.loadCheckout);

routes.get("/order-summary/:id", auth.authenticateUser, order_controller.orderSummary);

routes.get("/ordered/:id", auth.authenticateUser, order_controller.orderResult);

routes.get("/get-a-coupon", auth.authenticateUser, (req, res) => {
    return res.render('user/random_coupon', { title: "Get Coupon", cart_option: "page", session: req.session });
});


routes.post("/send-otp", profile_controller.sendOtp);
routes.post("/verify-otp", profile_controller.verifyOtp);
routes.post("/verify-signup", profile_controller.verifySignup);
routes.post("/reset-password", profile_controller.resetPassword);
routes.get("/wallet", auth.authenticateUser, profile_controller.loadWallet);
routes.post("/change-password", auth.authenticateUserApi, profile_controller.changePassword);
routes.post("/change-profile-picture", auth.authenticateUserApi, multer.single("image"), profile_controller.changeProfilePicture);
routes.delete("/remove-profile-image", auth.authenticateUserApi, profile_controller.removeProfilePicture);
routes.patch("/change-phone", auth.authenticateUserApi, profile_controller.changePhone);
routes.post("/add-address", auth.authenticateUserApi, profile_controller.addAddress);
routes.delete("/delete-address", auth.authenticateUserApi, profile_controller.deleteAddress);
routes.patch("/update-address", auth.authenticateUserApi, profile_controller.updateAddress);
routes.post("/create-review", auth.authenticateUserApi, profile_controller.addReview);
routes.post("/add-to-cart", auth.authenticateUserApi, cart_controller.addToCart);
routes.delete("/cart/:id", auth.authenticateUserApi, cart_controller.removeFromCart);
routes.post("/place-order", auth.authenticateUserApi, order_controller.addOrder);
routes.patch("/cancel-order", auth.authenticateUserApi, order_controller.cancelOrder);
routes.post("/return-order", auth.authenticateUserApi, order_controller.returnOrder);
routes.delete("/delete-account", auth.authenticateUserApi, profile_controller.deleteAccount);
routes.patch("/change-name", auth.authenticateUserApi, profile_controller.changeName);
routes.post("/apply-coupon", auth.authenticateUserApi, profile_controller.applyCoupon);
routes.post("/remove-coupon", auth.authenticateUserApi, profile_controller.removeCoupon);
routes.post("/update-wishlist", auth.authenticateUserApi, profile_controller.updateWishlist);
routes.post("/referrals", auth.authenticateUserApi, profile_controller.getReferrals);
routes.post("/update-cart", auth.authenticateUserApi, cart_controller.updateCartQuantity);
routes.post("/get-all-coupons", auth.authenticateUserApi, profile_controller.getAllCoupouns);
routes.post("/get-spin", auth.authenticateUserApi, profile_controller.validateSpin);

module.exports = routes;