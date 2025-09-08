const signup = (req, res) => {
    try {
        const { refer = null } = req.query;
        const error_message = req.session.error || null;
        req.session.error = null;
        req.session.refer = refer;
        return res.render('user/signup', { title: "Signup", cart_option: "page", error_message });
    } catch (err) {
        console.log(err);
        return res.redirect('/error');
    }
}

const login = (req, res) => {
    try {
        const error_message = req.session.error || null;
        req.session.error = null;
        return res.render('user/login', { title: "Login", cart_option: "page", error_message });
    } catch (err) {
        console.log(err);
        return res.redirect('/error');
    }
}

const adminLogin = (req, res) => {
    const error_message = req.session.error || null;
    req.session.error = null;
    console.error(error_message);
    return res.render("admin/login", { title: "Login", error_message })
}

const forgotPassword = (req, res) => {
    const error_message = req.session.error || null;
    req.session.error = null;
    return res.render('user/forgot_password', { title: "Forgot Password", cart_option: "page", error_message });
}

const errorPage = (req, res) => {
    try {
        return res.render('partials/user/error', { title: "Error" });
    } catch (err) {
        console.log(err);
        return res.redirect('/error');
    }
}

const verifyOtp = (req, res) => {
    if (!req.session.otp) {
        return res.redirect('/forgot-password');
    }
    try {
        const error_message = req.session.error || null;
        req.session.error = null;
        return res.render('user/verify_otp', { title: "Verify OTP", cart_option: "page", error_message, session: req.session.otp });
    } catch (err) {
        console.log(err);
        return res.redirect('/error');
    }
}

const verifySignup = (req, res) => {
    if (!req.session.otp) {
        return res.redirect('/signup');
    }
    try {
        const error_message = req.session.error || null;
        req.session.error = null;
        return res.render('user/verify_signup', { title: "Verify OTP", cart_option: "page", error_message, session: req.session.otp });
    } catch (err) {
        console.log(err);
        return res.redirect('/error');
    }
}

const resetPassword = (req, res) => {
    try {
        const error_message = req.session.error || null;
        req.session.error = null;
        return res.render('user/reset_password', { title: "Reset Password", cart_option: "page", error_message });
    } catch (err) {
        console.log(err);
        return res.redirect('/error');
    }
}


module.exports = { signup, login, forgotPassword, adminLogin, errorPage, verifyOtp, verifySignup, resetPassword };