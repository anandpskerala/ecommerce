const mongoose = require("mongoose");
const razorpay = require("../../utils/razorpay");
const dotenv = require('dotenv');
const crypto = require('crypto');
const payment_model = require('../../models/payment_model');
const cart_model = require("../../models/cart_model");
const offer_model = require("../../models/offer_model");
const product_model = require("../../models/product_model");
const httpStatus = require("../../utils/httpStatus");

dotenv.config();
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;

const createPayment = async (req, res) => {
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		const { amount, carts } = req.body;
		const user_id = req.session.user.id;

		let computedTotal = amount > 1000 ? 503 : 3;
		const parsedCarts = JSON.parse(carts);

		for (const cartId of parsedCarts) {
			const product_cart = await cart_model.findById(cartId).session(session);
			if (!product_cart) continue;

			const product = await product_model.findById(product_cart.product).session(session);
			if (!product) continue;

			let variant = product.variants.find((v) => v.name === product_cart.variant);
			if (!variant) continue;

			const colorDetail = variant.colors.find((color) => color.color === product_cart.color);
			if (!colorDetail) continue;


			let finalPrice = product_cart.quantity * colorDetail.price;
			if (product.offer && product.offer !== "none") {
				const offer = await offer_model.findOne({ name: product.offer }).session(session);
				if (offer) {
					finalPrice -= Math.ceil(colorDetail.price * offer.discount / 100);
				}
			}

			computedTotal += finalPrice;
		}

		if (Number(computedTotal) !== Number(amount)) {
			await session.abortTransaction();
			session.endSession();
			return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Price mismatch. Please refresh and try again." });
		}

		const options = { amount: amount * 100, currency: "INR", receipt: `receipt_${user_id}_${Date.now().toString().slice(-5)}` }
		const order = await razorpay.orders.create(options);
		return res.status(httpStatus.OK).json({ success: true, order: { key: RAZORPAY_KEY_ID, ...order }, });
	} catch (err) {
		console.error("Error creating Razorpay order:", err);
		await session.abortTransaction();
		session.endSession();
		return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Payment creation failed" });
	}
};

const verifyPayment = async (req, res) => {
	const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

	const generated_signature = crypto
		.createHmac("sha256", RAZORPAY_KEY_SECRET)
		.update(razorpay_order_id + "|" + razorpay_payment_id)
		.digest("hex");

	if (generated_signature === razorpay_signature) {
		return res.status(httpStatus.OK).json({
			success: true,
			message: "Payment verified successfully",
		});
	} else {
		return res.status(httpStatus.BAD_REQUEST).json({
			success: false,
			message: "Payment verification failed",
		});
	}
};

const retryPayment = async (req, res) => {
	const { order_id } = req.body;
	if (!order_id) {
		return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Invalid request" });
	}
	const order = await razorpay.orders.fetch(order_id);
	return res.status(httpStatus.OK).json({
		success: true,
		order: { key: RAZORPAY_KEY_ID, ...order },
	});
};

const setPaymentStatus = async (req, res) => {
	const { id, status } = req.body;
	const payment = await payment_model.updateOne({ _id: id }, { status: status });
	return res.status(httpStatus.OK).json({ success: true, message: "Payment status updated", order_id: id });
};

module.exports = { createPayment, verifyPayment, retryPayment, setPaymentStatus };