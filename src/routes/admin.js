const express = require('express');	
const admin_controller = require('../controllers/admin/admin_controller');
const product_controller = require('../controllers/admin/product_controller');
const brand_controller = require('../controllers/admin/brand_controller');
const category_controller = require('../controllers/admin/category_controller');
const offer_controller = require('../controllers/admin/offer_controller');
const coupon_controller = require('../controllers/admin/coupon_controller');
const authController = require('../controllers/user/auth_controller');
const order_controller = require('../controllers/admin/order_controller');
const auth = require('../middlewares/admin_authentication');
const brand_model = require("../models/brand_model");
const offer_model = require("../models/offer_model");
const order_model = require("../models/order_model");
const multer = require('../utils/multer');
const time = require('../utils/time');
const currency = require('../utils/currency');

const routes = express.Router();


routes.get("/login", authController.adminLogin);

routes.get("/dashboard", auth.authenticateAdmin, async (req, res) => {
    return res.render("admin/dashboard", {title: "Dashboard", page: "Dashboard"});
});

routes.get("/products", auth.authenticateAdmin, product_controller.loadProducts);
routes.post("/products", auth.authenticateAdminApI, product_controller.getProducts);

routes.get("/add-product", auth.authenticateAdmin, product_controller.addProductPage);

routes.get("/edit-product/:id", auth.authenticateAdmin, product_controller.editProductPage);

routes.get("/categories", auth.authenticateAdmin, category_controller.loadCategory);
routes.post("/categories", auth.authenticateAdminApI, category_controller.getCategories);

routes.get("/add-category", auth.authenticateAdmin, async (req, res) => {
    const offers = await offer_model.find({});
    return res.render("admin/add_category", {title: "Categories", page: "Create Category", offers});
})

routes.get("/orders", auth.authenticateAdmin, order_controller.loadOrders);
routes.post("/orders", auth.authenticateAdminApI, order_controller.getOrders);

routes.get("/order/:id", auth.authenticateAdmin, order_controller.orderDetailsPage);

routes.get("/brands", auth.authenticateAdmin, brand_controller.loadBrands);
routes.post("/brands", auth.authenticateAdminApI, brand_controller.getBrands);

routes.get("/add-brand", auth.authenticateAdmin, (req, res) => {
    return res.render("admin/add_brand", {title: "Brands", page: "Create Brand"});
})

routes.get("/customers", auth.authenticateAdmin, admin_controller.loadUser);
routes.post("/customers", auth.authenticateAdminApI, admin_controller.getUsers);

routes.get("/create-offer", auth.authenticateAdmin, (req, res) => {
    return res.render("admin/create_offer", {title: "Offers", page: "Create Offer"});
});

routes.get("/coupons", auth.authenticateAdmin, coupon_controller.loadCoupons);
routes.post("/coupons", auth.authenticateAdminApI, coupon_controller.getCoupons);
routes.get("/edit-coupon/:id", auth.authenticateAdmin, coupon_controller.editCoupon);

routes.get("/create-coupon", auth.authenticateAdmin, (req, res) => {
    return res.render("admin/create_coupon", {title: "Coupons", page: "Create Coupons"});
});


routes.get("/reviews", auth.authenticateAdmin, (req, res) => {
    return res.render("admin/reviews", {title: "Reviews", page: "Reviews"});
});

routes.get("/settings", auth.authenticateAdmin, (req, res) => {
    return res.render("admin/settings", {title: "Settings", page: "Settings"});
});

routes.get("/sales-report", auth.authenticateAdmin, (req, res) => {
    return res.render("admin/sales_report", {title: "Sales Report", page: "Sales Report"});
});

routes.get("/ledger-book", auth.authenticateAdmin, (req, res) => {
    return res.render("admin/ledger_book", {title: "Ledger Book", page: "Ledger Book"});
});

routes.get("/offers", auth.authenticateAdmin, offer_controller.loadOffers);
routes.post("/offers", auth.authenticateAdminApI, offer_controller.getOffers);


routes.get("/returns", auth.authenticateAdmin, order_controller.loadReturns);
routes.post("/update-return", auth.authenticateAdminApI, order_controller.updateReturn);

routes.post("/login", admin_controller.adminLogin);
routes.get("/logout", admin_controller.adminLogout);
routes.post("/edit-user", auth.authenticateAdminApI, admin_controller.editUser);
routes.post("/delete-user", auth.authenticateAdminApI, admin_controller.deleteUser);
routes.post("/add-product", multer.array("images"), auth.authenticateAdminApI, product_controller.addProductForm);
routes.post("/edit-product", multer.none(), auth.authenticateAdminApI, product_controller.editProductForm);
routes.post("/add-brand", multer.single("image"), auth.authenticateAdminApI, brand_controller.addBrandForm);
routes.post("/edit-brand", multer.single("image"), auth.authenticateAdminApI, brand_controller.editBrands);
routes.delete("/delete-brand/:id", auth.authenticateAdminApI, brand_controller.deleteBrand);	
routes.post("/add-category", multer.single("image"), auth.authenticateAdminApI, category_controller.addCategoryForm);
routes.post("/edit-category", multer.single("image"), auth.authenticateAdminApI, category_controller.editCategory);
routes.delete("/delete-category/:id", auth.authenticateAdminApI, category_controller.deleteCategory);
routes.post("/create-offer", auth.authenticateAdminApI, offer_controller.createOffer);
routes.delete("/delete-offer/:id", auth.authenticateAdminApI, offer_controller.deleteOffer);
routes.delete("/delete-product/:id", auth.authenticateAdminApI, product_controller.deleteProduct);
routes.post("/remove-product-image", auth.authenticateAdminApI, product_controller.removeProductImage);
routes.post("/edit-product-image", multer.array("images"), auth.authenticateAdminApI, product_controller.addProductImage);
routes.post("/product-options", auth.authenticateAdminApI, product_controller.productOptions);
routes.patch("/order/:id", auth.authenticateAdminApI, order_controller.setOrderStatus);
routes.post("/create-coupon", auth.authenticateAdminApI, coupon_controller.addCoupon);
routes.post("/edit-coupon", auth.authenticateAdminApI, coupon_controller.editCouponForm);
routes.delete("/coupons/:id", auth.authenticateAdminApI, coupon_controller.deleteCoupon);
routes.post("/get-reports", auth.authenticateAdminApI, admin_controller.getReports);
routes.post("/sales-reports", auth.authenticateAdminApI, admin_controller.getSalesReport);
routes.post("/load-ledger-book", auth.authenticateAdminApI, admin_controller.getLedgerBook);

module.exports = routes;