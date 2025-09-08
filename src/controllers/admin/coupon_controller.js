const coupon_model = require('../../models/coupon_model');
const timer = require('../../utils/time');
const httpStatus = require("../../utils/httpStatus");

const addCoupon = async (req, res) => {
    try {
        const {
            name, 
            description, 
            activation, 
            expiry, 
            discount, 
            min_amount,
            max_amount,
            type,
            status,
            limit
        } = req.body;
        const exists = await coupon_model.findOne({name: {$regex: new RegExp(`^${name}$`, 'i')}});
        if (exists) {
            return res.status(httpStatus.BAD_REQUEST).json({success: false, message: "Coupon already exists"});
        }
        const coupon = new coupon_model({ name, description, activation, discount, expiry, type, min_amount, max_amount, status, limit});
        await coupon.save();
        return res.status(httpStatus.CREATED).json({success: true, message: "Coupon added successfully"});
    } catch (error) {
        console.log("Error in add coupon" + error)
        return res.json({success: false, message: "An error occurred"});
    }
};


const loadCoupons = async (req, res) => {
    return res.render("admin/coupons", {
        title: "Coupons", 
        page: "Coupons"
    });
};

const getCoupons = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.body;
        const coupons = await coupon_model.find().sort({createdAt: -1}).skip((page - 1) * limit).limit(Number(limit));
        const total = await coupon_model.countDocuments();
        return res.status(httpStatus.OK).json({
            success: true,
            coupons,
            time: timer,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
        });
    } catch (error) {
        console.log("Error in getting coupons", error);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({success: false, message: "An error occurred"});
    }
};

const editCoupon = async (req, res) => {
    const {id} = req.params;
    const coupon = await coupon_model.findOne({_id: id});
    return res.render("admin/edit_coupon", {title: "Coupons", page: "Edit Coupon", coupon});
};

const editCouponForm = async (req, res) => {
    try {
        const {
            id,
            name, 
            description, 
            activation, 
            expiry, 
            discount, 
            min_amount,
            max_amount, 
            type,
            status,
            limit
        } = req.body;
        const coupon = await coupon_model.findOne({_id: id});
        if (!coupon) {
            return res.status(httpStatus.BAD_REQUEST).json({success: false, message: "Coupon doesn't exists"});
        }
        await coupon_model.updateOne({_id: coupon._id}, {$set: {name, description, activation, discount, expiry, min_amount, max_amount, type, status, limit}});
        return res.status(httpStatus.CREATED).json({success: true, message: "Coupon updated successfully"});
    } catch (error) {
        console.log("Error in add coupon" + error)
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({success: false, message: "An error occurred" + error});
    }
};

const deleteCoupon = async (req, res) => {
    const {id} = req.params;
    await coupon_model.deleteOne({_id: id});
    return res.status(httpStatus.OK).json({success: true, message: "Coupon deleted successfully"});
};

module.exports = {
    addCoupon,
    loadCoupons,
    editCoupon,
    editCouponForm,
    deleteCoupon,
    getCoupons,
}