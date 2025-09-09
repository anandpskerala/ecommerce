const mongoose = require('mongoose');
const order_model = require('../../models/order_model');
const return_model = require('../../models/return_model');
const payment_model = require('../../models/payment_model');
const timer = require('../../utils/time');
const currency = require("../../utils/currency");
const wallet_model = require('../../models/wallet_model');
const httpStatus = require("../../utils/httpStatus");
const time = require('../../utils/time');

const loadOrders = async (req, res) => {
    return res.render("admin/orders", {
        title: "Orders",
        page: "Orders",
    });
}

const getOrders = async (req, res) => {
    const { page = 1, limit = 10, status = "" } = req.body;
    const query = status ? { status } : {};
    const orders = await order_model.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate('user_id', 'first_name last_name email');
    const total = await order_model.countDocuments(query);
    return res.status(httpStatus.OK).json({
        success: true,
        orders,
        totalPages: Math.ceil(total / limit),
        currentPage: Number(page),
    });
}

const setOrderStatus = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        const { status, reason = "" } = req.body;
        const order = await order_model.findOne({ _id: id });
        const wallet = await wallet_model.findOne({ user_id: order.user_id });
        if (status == "delivered") {
            const payment = await payment_model.findOne({ _id: order.payment });
            if (!payment) {
                await session.abortTransaction();
                session.endSession();
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Payment not found for this order" });
            }

            if (payment.status == "pending") {
                await payment_model.updateOne({ _id: payment._id }, { $set: { status: "success" } }).session(session);
            }
        }

        if (status === "cancelled") {
            const payment = await payment_model.findOne({ _id: order.payment });
            if (payment.amount <= (order.quantity * order.price + 3)) {
                if (payment.method == "razorpay" || payment.method == "wallet") {
                    wallet.balance += payment.amount;
                    wallet.transactions.push({ amount: payment.amount, type: 'credit', description: "Refund due to cancellation" })
                }
                await payment_model.deleteOne({ _id: payment._id }).session(session);
            } else {
                if (payment.method == "razorpay" || payment.method == "wallet") {
                    wallet.balance += order.quantity * order.price;
                    wallet.transactions.push({ amount: order.quantity * order.price, type: 'credit', description: "Refund due to cancellation" })
                }
                await payment_model.updateOne({ _id: payment._id }, { $inc: { amount: -(order.quantity * order.price) }, $pull: { orders: order._id } }, { $set: { status: "refund" } }).session(session);
            }
            await wallet.save().session(session);
        }
        await order_model.updateOne({ _id: id }, { $set: { status, reason } }).session(session);
        await session.commitTransaction();
        session.endSession();
        return res.status(httpStatus.OK).json({ success: true, message: `Order status updated successfully` });
    } catch (error) {
        console.log("Error in set order status" + error);
        await session.abortTransaction();
        session.endSession();
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: `An error occurred` });
    }
};



const loadReturns = async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const returns = await return_model.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate('order_id', 'name price image').populate('user_id', 'first_name last_name');
    const total = await return_model.countDocuments();
    return res.render("admin/return_page", {
        title: "Returns",
        page: "Returns",
        returns,
        time: timer,
        totalPages: Math.ceil(total / limit),
        currentPage: Number(page),
    });
}

const updateReturn = async (req, res) => {
    const { return_id, status, rejection_reason = null } = req.body;
    const return_data = await return_model.findOne({ _id: return_id });
    if (!return_data) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Invalid return request" });
    }
    const order = await order_model.findOne({ _id: return_data.order_id });
    if (!order) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Invalid order" });
    }

    return_data.status = status;
    if (status === "rejected") {
        return_data.rejection_reason = rejection_reason;
    } else {
        await order_model.updateOne({ _id: order._id }, { $set: { status: "returned" } });
        await payment_model.updateOne({ _id: order.payment }, { $set: { status: "refund" } });
        await wallet_model.updateOne({ user_id: return_data.user_id }, {
            $push: {
                transactions: {
                    type: "credit",
                    amount: order.quantity * order.price,
                    description: "Refund due to Return"
                }
            },
            $inc: {
                balance: order.quantity * order.price
            }
        })
    }
    await return_model.updateOne({ _id: return_data._id }, { $set: { status: return_data.status, rejection_reason: rejection_reason } })
    return res.status(httpStatus.OK).json({ success: true, message: "Return status updated successfully" });
};


const orderDetailsPage = async (req, res) => {
    const { id } = req.params;
    const order = await order_model.findOne({ _id: id }).populate('user_id', 'first_name last_name email addresses phone_number').populate('payment');
    const address = order.user_id.addresses.find(v => v._id.toString() == order.address.toString());
    return res.render("admin/order_details", { title: "Orders", page: "Order Details", order, time, address, currency });
}

module.exports = {
    loadOrders,
    setOrderStatus,
    loadReturns,
    updateReturn,
    getOrders,
    orderDetailsPage
}