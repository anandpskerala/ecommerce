const mongoose = require('mongoose');
const productModel = require('../../models/product_model');
const categoryModel = require('../../models/category_model');
const offerModel = require('../../models/offer_model');
const reviewModel = require('../../models/review_model');
const cartModel = require('../../models/cart_model');
const wishlistModel = require('../../models/wishlist_model');
const time = require('../../utils/time');
const currency = require('../../utils/currency');


const homePage = async (req, res) => {
    try {
        const new_products = await productModel.find({ listed: true }).sort({ createdAt: -1 }).limit(6);
        const popular_products = await productModel.find({ listed: true }).sort({ ordered: -1 }).limit(6);
        return res.render('user/home', { title: "Home", cart_option: "page", session: req.session, new_arrivals: new_products, popular_products });
    } catch (err) {
        console.log(err);
        return res.redirect('/error');
    }
}

const getProducts = async (req, res) => {
    try {
        const categories = await categoryModel.find({});
        return res.render('user/products', { title: "Products", cart_option: "page", session: req.session, categories, currency });
    } catch (err) {
        console.log(err);
        return res.redirect('/error');
    }
}

const getProductDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await productModel.findOne({ _id: id });
        const category = await categoryModel.findOne({ name: product.category });
        let wishlist;
        const offers = await offerModel.find({});
        const reviews = await reviewModel.find({ product_id: product._id }).limit(5).populate('user_id', 'first_name last_name email image');
        const rating = await reviewModel.aggregate([
            { $match: { product_id: product._id } },
            {
                $group: {
                    _id: "$product_id",
                    totalRating: { $sum: "$rating" },
                    averageRating: { $avg: "$rating" },
                    reviewCount: { $count: {} }
                }
            }
        ]);

        const similar_products = await productModel.find({
            $and: [
                { _id: { $ne: product._id } },
                { listed: true },
                {
                    $or: [
                        { category: product.category },
                        { brand: product.brand }
                    ]
                }
            ]
        }).limit(5);

        let carts;
        let result = [];
        if (req.session.user) {
            carts = await cartModel.find({ user: req.session.user.id }).sort({ createdAt: -1 }).populate("product");
            wishlist = await wishlistModel.findOne({ product_id: product._id, user_id: req.session.user.id });
            result = await cartModel.aggregate([
                {
                    $match: { user: new mongoose.Types.ObjectId(req.session.user.id) }
                },
                {
                    $group: {
                        _id: null,
                        totalPrice: { $sum: { $multiply: ["$price", "$quantity"] } }
                    }
                }
            ]);
        }
        const total_price = result.length > 0 ? result[0].totalPrice : 0;
        return res.render('user/product_page', { title: product.title, cart_option: "popup", session: req.session, product, category, similar_products, offers, reviews, time, rating: rating[0], carts, total_price, currency, wishlist });
    } catch (err) {
        console.log(err);
        return res.redirect('/');
    }
}


module.exports = { homePage, getProducts, getProductDetails };