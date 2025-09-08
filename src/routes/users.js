const express = require('express');	
const mongoose = require('mongoose');
const controllers = require('../controllers/user/user_controller');
const authControllers = require('../controllers/user/auth_controller');
const productController = require('../controllers/user/product_controller');
const auth = require('../middlewares/user_authentication');

const routes = express.Router();


routes.get("/signup", auth.isAlreadyLogged, authControllers.signup);

routes.get("/login", auth.isAlreadyLogged, authControllers.login);

routes.get("/", productController.homePage);

routes.get("/forgot-password", authControllers.forgotPassword);

routes.get("/error", authControllers.errorPage);

routes.get("/products", productController.getProducts);

routes.get("/product/:id", productController.getProductDetails);

routes.get("/contact-us", (req, res) => {
    return res.render('user/contact_page', {title: "Contact Us", cart_option: "page"});
})

routes.get("/about", (req, res) => {
    return res.render('user/about_page', {title: "About Page", cart_option: "page"});
})

routes.post("/signup", controllers.userSignup);
routes.post("/login", controllers.userLogin);
routes.get("/logout", controllers.userLogout);
routes.get("/login/google", controllers.googleLogin);
routes.get("/login/google/auth", controllers.authGoogle)
routes.post("/products", controllers.getProducts)

module.exports = routes;