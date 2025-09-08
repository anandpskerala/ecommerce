const mongoose = require('mongoose');
const user_model = require('../../models/user_model');
const offer_model = require('../../models/offer_model');
const cart_model = require('../../models/cart_model');
const product_model = require('../../models/product_model');
const payment_model = require('../../models/payment_model');
const order_model = require('../../models/order_model');
const wallet_model = require('../../models/wallet_model');
const return_model = require('../../models/return_model');
const httpStatus = require("../../utils/httpStatus");

const time = require('../../utils/time');
const currency = require('../../utils/currency');


const addOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let { carts, payment_method, address, price, razorpay_order_id, status, coupon_discount } = req.body;

        if (!carts || !payment_method || !address) {
            await session.abortTransaction();
            session.endSession();
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "All fields are required" });
        }

        const user = await user_model.findById(req.session.user.id).session(session);
        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "User not found" });
        }

        if (payment_method === "cod" && price > 1000) {
            await session.abortTransaction();
            session.endSession();
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "COD is not allowed above ₹1000" });
        }

        if (payment_method === "wallet") {
            const wallet = await wallet_model.findOne({ user_id: user._id }).session(session);
            if (!wallet || wallet.balance < price) {
                await session.abortTransaction();
                session.endSession();
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Insufficient wallet balance" });
            }

            wallet.balance -= price;
            wallet.transactions.push({
                amount: price,
                type: "debit",
                description: "Order payment",
            });
            await wallet.save({ session });
        }

        let payment_data = new payment_model({
            user_id: user._id,
            method: payment_method,
            amount: price,
        });

        if (payment_method === "razorpay" && razorpay_order_id) {
            payment_data.razorpay_order_id = razorpay_order_id;
            payment_data.status = status;
        }
        if (payment_method === "wallet") {
            payment_data.status = "success";
        }
        if (!isNaN(coupon_discount)) {
            payment_data.coupon_discount = coupon_discount;
        }

        const payment = await payment_data.save({ session });

        let orders = [];
        let computedTotal = price > 1000 ? 503 : 3;
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

            const updatedProduct = await product_model.findOneAndUpdate(
                {
                    _id: product._id,
                    "variants.name": variant.name,
                    "variants.colors.color": product_cart.color,
                    "variants.colors.quantity": { $gte: product_cart.quantity },
                },
                {
                    $inc: {
                        "variants.$[v].colors.$[c].quantity": -product_cart.quantity,
                        ordered: 1,
                    },
                },
                {
                    arrayFilters: [
                        { "v.name": variant.name },
                        { "c.color": product_cart.color }
                    ],
                    new: true,
                    session,
                }
            );

            if (!updatedProduct) {
                await session.abortTransaction();
                session.endSession();
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Insufficient stock" });
            }

            const order_item = new order_model({
                user_id: user._id,
                product_id: product._id,
                name: product.title,
                variant: variant.name,
                color: product_cart.color,
                quantity: product_cart.quantity,
                image: product_cart.image,
                price: finalPrice,
                payment: payment._id,
                address: address,
                discount: product_cart.discount,
            });

            const order = await order_item.save({ session });
            orders.push(order._id);


            await cart_model.deleteOne({ _id: product_cart._id }).session(session);
        }

        if (Number(computedTotal) !== Number(price)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Price mismatch. Please refresh and try again." });
        }

        await payment_model.updateOne(
            { _id: payment._id },
            { $set: { orders: orders } },
            { session }
        );

        user.coupon = null;
        await user.save({ session });

        await session.commitTransaction();
        session.endSession();

        return res.status(httpStatus.OK).json({
            success: true,
            message: "Order placed successfully",
            order_id: payment._id,
        });

    } catch (error) {
        console.error("Error placing order:", error);
        await session.abortTransaction();
        session.endSession();
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "An error occurred while placing the order",
        });
    }
};


const cancelOrder = async (req, res) => {
    const { order_id, reason } = req.body;
    const user = await user_model.findOne({ _id: req.session.user.id });
    if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: `User not found` });
    }
    const order = await order_model.findOne({ _id: order_id, user_id: user._id });
    if (!order) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: `Order not found` });
    }
    if (order.status !== "processing") {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Order can only be cancelled in processing state" });
    }
    const payment = await payment_model.findOne({ _id: order.payment });
    const wallet = await wallet_model.findOne({ user_id: user._id });
    if (payment.amount <= (order.quantity * order.price + 3)) {
        if (payment.method == "razorpay" || payment.method == "wallet") {
            wallet.balance += payment.amount;
            wallet.transactions.push({ amount: payment.amount, type: 'credit', description: "Refund due to cancellation" })
        }
        await payment_model.deleteOne({ _id: payment._id });
    } else {
        if (payment.method == "razorpay" || payment.method == "wallet") {
            wallet.balance += order.quantity * order.price;
            wallet.transactions.push({ amount: order.quantity * order.price, type: 'credit', description: "Refund due to cancellation" })
        }
        await payment_model.updateOne({ _id: payment._id }, { $inc: { amount: -(order.quantity * order.price) }, $pull: { orders: order._id } }, { $set: { status: "refund" } });
    }
    await wallet.save();
    const product = await product_model.findOne({ _id: order.product_id });
    const variant_data = product.variants.map((v) => {
        if (v.name === order.variant) {
            v.quantity += order.quantity;
        }
        return v;
    });
    await product_model.updateOne({ _id: order.product_id }, { $set: { variants: variant_data } })
    await order_model.updateOne({ _id: order._id }, { $set: { status: 'cancelled', reason } });
    return res.status(httpStatus.OK).json({ success: true, message: "Order cancelled successfully" });
};

const returnOrder = async (req, res) => {
    const { order_id, reason } = req.body;
    const user = await user_model.findOne({ _id: req.session.user.id });
    if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: `User not found` });
    }
    const order = await order_model.findOne({ _id: order_id, user_id: user._id });
    if (!order) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: `Order not found` });
    }
    if (order.status !== "delivered") {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Order can only be returned after delivery" });
    }

    const payment = await payment_model.findOne({ _id: order.payment });
    const exists = await return_model.findOne({ order_id: order._id });
    if (exists) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Return request already sent for this order" });
    }
    const return_data = new return_model({
        user_id: user._id,
        order_id: order._id,
        payment_id: payment._id,
        reason: reason,
    });
    await return_data.save();
    return res.status(httpStatus.OK).json({ success: true, message: "Return request sent successfully" });
};

const orderPage = async (req, res) => {
    try {
        const error_message = req.session.error || null;
        req.session.error = null;
        const { page = 1, limit = 10 } = req.query;
        const orders = await order_model.find({ user_id: req.session.user.id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate('payment');
        const returns = await return_model.find({ user_id: req.session.user.id });
        const total = await order_model.countDocuments({ user_id: req.session.user.id });
        return res.render('user/order_page', {
            title: "Orders",
            cart_option: "page",
            error_message,
            orders,
            time,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            currency,
            returns
        });
    } catch (err) {
        console.log(err);
        return res.redirect('/error');
    }
}


const pendingOrders = async (req, res) => {
    try {
        const error_message = req.session.error || null;
        req.session.error = null;
        const { page = 1, limit = 10 } = req.query;
        const orders = await order_model.find({ user_id: req.session.user.id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate('payment');
        const returns = await return_model.find({ user_id: req.session.user.id });
        const total = orders.reduce((acc, curr) => {
            if (curr.payment && curr.payment.status == "failed") {
                acc++;
            }
            return acc;
        }, 0)
        return res.render('user/pending_orders', {
            title: "Pending Orders",
            cart_option: "page",
            error_message,
            orders,
            time,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            currency,
            returns
        });
    } catch (err) {
        console.log(err);
        return res.redirect('/error');
    }
}

const orderSummary = async (req, res) => {
    const { id } = req.params;
    const payment = await payment_model.findOne({ _id: id });
    if (!payment) {
        return res.redirect("/user/orders");
    }
    let orders = [];
    for (const order of payment.orders) {
        const product_order = await order_model.findOne({ _id: order });
        if (product_order) orders.push(product_order);
    }
    const user = await user_model.findOne({ _id: req.session.user.id });
    let address = null;
    if (orders.length > 0 && orders[0].address) {
        address = user.addresses.find(v => v._id.toString() === orders[0].address.toString());
    }
    return res.render('user/order_summary', { title: "Order Summary", cart_option: "page", payment, orders, time, user, address, currency });
}

const orderResult = async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.redirect("/user/orders");
    }
    const payment = await payment_model.findOne({ _id: id });
    return res.render('user/order_result', { title: "Order", cart_option: "page", session: req.session, payment });
}


module.exports = {
    addOrder,
    cancelOrder,
    returnOrder,
    orderPage,
    pendingOrders,
    orderSummary,
    orderResult
};