const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const otp_model = require('../../models/otp_model');
const user_model = require('../../models/user_model');
const review_model = require('../../models/review_model');
const order_model = require('../../models/order_model');
const coupon_model = require('../../models/coupon_model');
const wishlist_model = require('../../models/wishlist_model');
const wallet_model = require('../../models/wallet_model');
const referral_model = require('../../models/referral_model');
const spin_model = require('../../models/spin_model');

const time = require('../../utils/time');
const currency = require('../../utils/currency');
const httpStatus = require("../../utils/httpStatus");

const generate_otp = () => {
    return crypto.randomInt(1000, 9999);
}

const sendOtp = async (req, res) => {
    const { email } = req.body;
    const result = await otp_model.findOne({ email: email.toLowerCase() });
    if (!result) {
        const user = await user_model.findOne({ email: email.toLowerCase() });
        if (!user || !user.password) {
            req.session.error = "Email doesn't exists";
            return res.redirect("/forgot-password");
        }
        const otp = new otp_model({ email: email.toLowerCase(), otp: generate_otp() });
        let result = await otp.save();
        req.session.otp = { email: email.toLowerCase(), expiry: result.expiry };
        return res.redirect("/user/verify-otp");
    } else {
        req.session.error = "Please wait for sometime to try again";
        return res.redirect("/forgot-password");
    }
}

const verifyOtp = async (req, res) => {
    const { otp } = req.body;
    if (!req.session.otp) {
        req.session.error = "Session expired. Please try again";
        return res.redirect("/forgot-password");
    }
    const { email } = req.session.otp;
    const result = await otp_model.findOne({ email, otp });
    if (result) {
        return res.redirect("/user/reset-password");
    } else {
        req.session.error = "Invalid OTP";
        return res.redirect("/user/verify-otp");
    }
};

const verifySignup = async (req, res) => {
    const { otp } = req.body;
    if (!req.session.otp) {
        req.session.error = "Session expired. Please try again";
        return res.redirect("/signup");
    }
    const { user } = req.session.otp;
    const result = await otp_model.findOne({ email: user.email.toLowerCase(), otp });
    if (result) {
        const user_data = new user_model({ ...user })
        let result = await user_data.save();
        const wallet = new wallet_model({
            user_id: result._id,
        });
        await wallet.save();
        const referral = new referral_model({
            user: result._id,
        })
        await referral.save();

        if (req.session.refer) {
            const referrer = await referral_model.findOne({ referral_code: req.session.refer });
            if (referrer) {
                referrer.referred_users.push(result._id);
                referrer.amount_earned += 100;
                await referrer.save();
                await wallet_model.updateOne({ user_id: referrer.user }, { $inc: { balance: 100 }, $push: { transactions: { amount: 100, type: "credit", description: "Referral Bonus" } } });
            }
        }
        if (req.session.admin) {
            req.session.user = {
                id: result._id,
                first_name: result.first_name,
                last_name: result.last_name,
                email: result.email,
            };
            return res.redirect("/");
        } else {
            req.session.regenerate((err) => {
                if (err) {
                    console.error("Error regenerating session: " + err);
                    req.session.error = "Session Error. Please try again.";
                    return res.redirect("/signup");
                }

                req.session.user = {
                    id: result._id,
                    first_name: result.first_name,
                    last_name: result.last_name,
                    email: result.email,
                };

                return res.redirect("/");
            });
        }
    } else {
        req.session.error = "Invalid OTP";
        return res.redirect("/user/verify-signup");
    }
};

const resetPassword = async (req, res) => {
    const { password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashed_password = await bcrypt.hash(password, salt);
    if (!req.session.otp) {
        req.session.error = "Session expired. Please try again";
        return res.redirect("/forgot-password");
    }
    const { email } = req.session.otp;
    const user = await user_model.findOne({ email });
    if (user) {
        await user_model.updateOne({ email }, { $set: { password: hashed_password } });
        delete req.session.otp;
        return res.redirect("/login");
    } else {
        req.session.error = "Failed to reset password";
        return res.redirect("/user/reset-password");
    }
}

const changeProfilePicture = async (req, res) => {
    try {
        const { id } = req.body;
        const image = req.file.filename;
        const user = await user_model.findOne({ _id: id });
        if (user && user.image) {
            fs.unlink(path.join(__dirname, "../uploads", user.image), (err) => {
                if (err) console.error("Error deleting file:", err);
                console.log("File deleted successfully");
            });
        }
        if (!req.file) {
            return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "No Image found. Try again" });
        }
        await user_model.updateOne({ _id: id }, { $set: { image } });
        return res.status(httpStatus.OK).json({ success: true, message: "Profile picture updated successfully" });
    } catch (err) {
        console.log(err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal Error Please try again" });
    }
};

const removeProfilePicture = async (req, res) => {
    try {
        const { id } = req.body;
        const user = await user_model.findOne({ _id: id });
        if (user && user.image) {
            fs.unlink(path.join(__dirname, "../uploads", user.image), (err) => {
                if (err) console.error("Error deleting file:", err);
                console.log("File deleted successfully");
            });
        }
        await user_model.updateOne({ _id: id }, { $unset: { image: "" } });
        return res.status(httpStatus.OK).json({ success: true, message: "Profile picture removed successfully" });
    } catch (err) {
        console.log(err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal Server Error Please try again" });
    }
};

const changePassword = async (req, res) => {
    const { password, current_password } = req.body;
    const exists = await user_model.findOne({ _id: req.session.user.id });
    if (!exists) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: `User not found` });
    }

    const comparePassword = await bcrypt.compare(current_password, exists.password);

    if (!comparePassword) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Current password is incorrect" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashed_password = await bcrypt.hash(password, salt);
    await user_model.updateOne({ _id: req.session.user.id }, { $set: { password: hashed_password } });
    return res.status(httpStatus.OK).json({ success: true, message: "Password updated successfully" });
};

const changePhone = async (req, res) => {
    const { phone } = req.body;
    const exists = await user_model.findOne({ _id: req.session.user.id });
    if (!exists) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: `User not found` });
    }
    await user_model.updateOne({ _id: req.session.user.id }, { $set: { phone_number: phone } });
    return res.status(httpStatus.OK).json({ success: true, message: "Phone number updated successfully" });
};

const addAddress = async (req, res) => {
    const { house_address, street_address, city, state, country, zip_code } = req.body;
    const exists = await user_model.findOne({ _id: req.session.user.id });
    if (!exists) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: `User not found` });
    }
    await user_model.updateOne(
        { _id: req.session.user.id },
        {
            $push: {
                addresses: {
                    house_address,
                    street_address,
                    city,
                    state,
                    country,
                    zip_code
                }
            }
        }
    );
    return res.status(httpStatus.OK).json({ success: true, message: "Address added successfully" });
};

const deleteAddress = async (req, res) => {
    const { id } = req.body;
    const exists = await user_model.findOne({ _id: req.session.user.id });
    if (!exists) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: `User not found` });
    }
    await user_model.updateOne(
        { _id: req.session.user.id },
        { $pull: { addresses: { _id: id } } }
    );
    return res.status(httpStatus.OK).json({ success: true, message: "Address deleted successfully" });
};

const updateAddress = async (req, res) => {
    const { id, house_address, street_address, city, state, country, zip_code } = req.body;
    const exists = await user_model.findOne({ _id: req.session.user.id });
    if (!exists) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: `User not found` });
    }
    await user_model.updateOne(
        { _id: req.session.user.id, "addresses._id": id },
        {
            $set: {
                'addresses.$.house_address': house_address,
                'addresses.$.street_address': street_address,
                'addresses.$.city': city,
                'addresses.$.state': state,
                'addresses.$.country': country,
                'addresses.$.zip_code': zip_code
            }
        }
    );
    return res.status(httpStatus.OK).json({ success: true, message: "Address updated successfully" });
}

const addReview = async (req, res) => {
    const { product_id, comment, rating } = req.body;
    const user = await user_model.findOne({ _id: req.session.user.id });
    if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: `User not found` });
    }

    const order = await order_model.findOne({ user_id: user.id, product_id: product_id });
    if (!order) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: 'You need to order the product to add review' });
    }

    if (order.status != 'delivered' && order.status != 'returned') {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: 'You can only add review after the product has been delivered or returned' });
    }

    const review = new review_model({ user_id: user.id, product_id, rating, comment });
    await review.save();
    return res.status(httpStatus.OK).json({ success: true, message: "Review added successfuly" });
};

const deleteAccount = async (req, res) => {
    const { id } = req.session.user;
    const user = await user_model.findOne({ _id: id });
    if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "User not found" });
    }
    await user_model.deleteOne({ _id: user._id });
    return res.status(httpStatus.OK).json({ success: true, message: "Account deleted successfully" });
};

const changeName = async (req, res) => {
    const { id } = req.session.user;
    const { first_name, last_name } = req.body;
    const user = await user_model.findOneAndUpdate({ _id: id }, { first_name, last_name });
    if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "User not found" });
    }
    return res.status(httpStatus.OK).json({ success: true, message: "Name updated successfully", user });
}

const applyCoupon = async (req, res) => {
    const { coupon_code, min_amount } = req.body;
    const coupon = await coupon_model.findOne({ coupon_code: coupon_code });
    if (!coupon || coupon.limit <= 0) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Invalid coupon code" });
    }
    if (coupon.expiry < new Date()) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Coupon has expired" });
    }
    if (coupon.status == false) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Coupon is inactive" });
    }
    if (min_amount && coupon.min_amount > min_amount) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Coupon minimum amount requirement not met" });
    }

    if (min_amount && coupon.max_amount < min_amount) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Coupon maximum amount requirement exceeded" });
    }
    const user = await user_model.findOne({ _id: req.session.user.id });

    if (coupon.users.includes(user._id)) {
        if (coupon.type == 'single') {
            delete user.coupon;
            await user.save();
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Coupon already applied" });
        }
        coupon.limit -= 1;
        user.coupon = coupon._id;
    } else {
        user.coupon = coupon._id;
        coupon.users.push(user._id);
        coupon.limit -= 1;
    }

    await user.save();
    await coupon.save();
    return res.status(httpStatus.OK).json({ success: true, message: "Coupon applied successfully" });
};

const removeCoupon = async (req, res) => {
    const { coupon_code } = req.body;
    const coupon = await coupon_model.findOne({ coupon_code: coupon_code });
    if (!coupon) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "Coupon not found" });
    }
    const user = await user_model.findOne({ _id: req.session.user.id });
    if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "User not found" });
    }
    if (user.coupon.toString() == coupon._id.toString()) {
        delete user.coupon;
        coupon.users.pull(user._id)
        if (coupon.type == "multiple") {
            coupon.limit += 1;
        }
    }

    await user.save();
    await coupon.save();
    return res.status(httpStatus.OK).json({ success: true, message: "Coupon removed successfully" });
}

const updateWishlist = async (req, res) => {
    const { product_id, variant_id, color } = req.body;
    const user = await user_model.findOne({ _id: req.session.user.id });
    if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "User not found" });
    }

    const wishlist = await wishlist_model.findOne({ product_id });
    if (!wishlist) {
        const new_wishlist = await wishlist_model.create({
            user_id: user._id,
            product_id,
            variant_id,
            color,
        });
        return res.status(httpStatus.OK).json({ success: true, message: "Product added to wishlist successfully" });
    } else {
        await wishlist_model.deleteOne({ product_id });
        return res.status(httpStatus.OK).json({ success: true, message: "Product removed from wishlist successfully" });
    }
};

const loadWallet = async (req, res) => {
    const user = await user_model.findOne({ _id: req.session.user.id });
    if (!user) {
        return res.redirect("/login");
    }

    const wallet = await wallet_model.findOne({ user_id: user._id });
    return res.render("user/wallet_page", { title: "Wallet", cart_option: "page", user, wallet, time, currency });
};

const getReferrals = async (req, res) => {
    const { user_id } = req.body;
    const user = await user_model.findOne({ _id: user_id });
    if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "User not found" });
    }
    const referrals = await referral_model.findOne({ user: user._id }).populate('referred_users');
    const referral_link = `${req.protocol}://${req.get('host')}/signup?refer=${referrals.referral_code}`;
    return res.status(httpStatus.OK).json({ referral_code: referrals.referral_code, referral_link, referred_users: referrals.referred_users, amount: referrals.amount_earned });
};

const getAllCoupouns = async (req, res) => {
    try {
        const user = req.session.user.id;
        const coupons = await coupon_model.find({
            status: true,
            limit: { $gt: 0 },
            expiry: { $gt: new Date() },
            users: { $nin: [user] }
        });
        return res.status(httpStatus.OK).json({ success: true, coupons });
    } catch (error) {
        console.error("Error in coupons" + error)
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Error fetching coupons" });
    }
};

const validateSpin = async (req, res) => {
    const user_id = req.session.user.id;
    const spins = await spin_model.findOne({ user_id });
    if (spins) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false, message: `You can spin again on ${spins.expires.toLocaleString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                hour12: true
            })}`
        });
    }
    await spin_model.create({
        user_id
    });
    return res.status(httpStatus.OK).json({ success: true, message: "Spin registered" });
}

const profilePage = async (req, res) => {
    try {
        const error_message = req.session.error || null;
        req.session.error = null;
        const user = await user_model.findOne({ _id: req.session.user.id });
        return res.render('user/account_page', { title: "Account", cart_option: "page", error_message, user });
    } catch (err) {
        console.log(err);
        return res.redirect('/error');
    }
}

const manageAddressPage = async (req, res) => {
    const user = await user_model.findOne({ _id: req.session.user.id });
    return res.render('user/address', { title: "Address", cart_option: "page", user });
}

const referalPage = async (req, res) => {
    const user = await user_model.findOne({ _id: req.session.user.id });
    return res.render('user/referral_page', { title: "Referral", cart_option: "page", user });
}


module.exports = {
    sendOtp,
    verifyOtp,
    resetPassword,
    verifySignup,
    changeProfilePicture,
    removeProfilePicture,
    changePassword,
    changePhone,
    addAddress,
    deleteAddress,
    updateAddress,
    addReview,
    deleteAccount,
    changeName,
    applyCoupon,
    removeCoupon,
    updateWishlist,
    loadWallet,
    getReferrals,
    getAllCoupouns,
    validateSpin,
    profilePage,
    manageAddressPage,
    referalPage
};