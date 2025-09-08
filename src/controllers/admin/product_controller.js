const path = require('path');
const fs = require('fs');
const productModel = require('../../models/product_model');
const offerModel = require("../../models/offer_model");
const categoryModel = require("../../models/category_model");
const brandModel = require("../../models/brand_model");
const currency = require("../../utils/currency");
const httpStatus = require("../../utils/httpStatus");


const loadProducts = async (req, res) => {
    return res.render(
        "admin/products",
        {
            title: "Products",
            page: "Products",
        }
    );
};

const getProducts = async (req, res) => {
    try {
        const { page = 1, limit = 10, product = "" } = req.body;
        const search_product = product != "" ? { title: { $regex: product } } : {};
        const products = await productModel.find(search_product).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
        const total = await productModel.countDocuments(search_product);
        return res.status(httpStatus.OK).json(
            {
                success: true,
                products,
                totalPages: Math.ceil(total / limit),
                currentPage: Number(page),
            }
        );
    } catch (error) {
        console.log("Error in getting products", error);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "An error occurred" });
    }
};

const addProductForm = async (req, res) => {
    try {
        const { title, stock, category, brand, offer, description, variants } = req.body;

        const parsed_variants = JSON.parse(variants);

        const variant_list = Object.keys(parsed_variants).map((variant_name) => {
            const colors = Object.keys(parsed_variants[variant_name]).map((color) => {
                const { price, quantity } = parsed_variants[variant_name][color];
                return { color, price: parseFloat(price), quantity: parseInt(quantity) };
            });
            return { name: variant_name, colors };
        });

        const files = req.files.map((file) => file.filename);

        const product_data = {
            title,
            stock: stock === "true",
            category,
            brand,
            offer: offer || "none",
            description,
            images: files,
            variants: variant_list,
        };

        const product = await productModel.create(product_data);

        return res.status(httpStatus.OK).json({ success: true, message: "Product added successfully" });
    } catch (error) {
        console.error(error);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "An error occurred while adding the product" });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const exists = await productModel.findOne({ _id: id });
        if (!exists) {
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Product not found" });
        }
        await productModel.deleteOne({ _id: id });
        for (image in exists.images) {
            fs.unlink(path.join(__dirname, '../uploads', exists.images[image]), (err) => {
                if (err) console.error("Error deleting file:", err);
                console.log("File deleted successfully");
            });
        }
        return res.status(httpStatus.OK).json({ success: true, message: "Product deleted successfully" });
    } catch (err) {
        console.error("Error in delete product:", err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "An error occurred" });
    }
};


const removeProductImage = async (req, res) => {
    try {
        const { id, image } = req.body;
        const product = await productModel.findOne({ _id: id });
        if (!product) {
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Invalid request" });
        }
        await productModel.updateOne({ _id: id }, { $pull: { images: image } });
        fs.unlink(path.join(__dirname, "../uploads", image), (err) => {
            if (err) console.error("Error deleting file:", err);
            console.log("File deleted successfully");
        });
        return res.status(httpStatus.OK).json({ success: true, message: "Image removed successfully" });
    } catch (err) {
        console.error("Error in remove product image:", err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "An error occurred" });
    }
}

const addProductImage = async (req, res) => {
    try {
        const { id } = req.body;
        let files = req.files.map((file) => file.filename);
        const product = await productModel.findOne({ _id: id });
        if (!product) {
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Invalid request" });
        }
        await productModel.updateOne({ _id: id }, { $push: { images: { $each: files } } });
        return res.status(httpStatus.OK).json({ success: true, message: "Image added successfully" });
    } catch (err) {
        console.error("Error in add product image:", err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "An error occurred" });
    }
}

const productOptions = async (req, res) => {
    try {
        const { id, action } = req.body;
        await productModel.updateOne({ _id: id }, { $set: { listed: action } });
        return res.status(httpStatus.OK).json({ success: true, message: `Product ${action == 'true' ? 'listed' : 'unlisted'} successfully` });
    } catch (error) {
        console.log("Error in Product otions" + error)
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "An error occurred" });
    }
};

const editProductForm = async (req, res) => {
    try {
        let { id, variants } = req.body;
        const parsed_variants = JSON.parse(variants);

        const variant_list = Object.keys(parsed_variants).map((variant_name) => {
            const colors = Object.keys(parsed_variants[variant_name]).map((color) => {
                const { price, quantity } = parsed_variants[variant_name][color];
                return { color, price: parseFloat(price), quantity: parseInt(quantity) };
            });
            return { name: variant_name, colors };
        });

        let data = { ...req.body, variants: variant_list };
        await productModel.updateOne({ _id: id }, { $set: data });
        return res.status(httpStatus.OK).json({ success: true, message: `Product Updated` })
    } catch (err) {
        console.log("Error in edit product form" + err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: `An error occurred ${err}` });
    }
};


const addProductPage = async (req, res) => {
    const categories = await categoryModel.find({});
    const brands = await brandModel.find({});
    const offers = await offerModel.find({});
    return res.render(
        "admin/add_product",
        {
            title: "Products",
            page: "Add Product",
            categories,
            brands,
            offers
        }
    );
}

const editProductPage = async (req, res) => {
    const { id } = req.params;
    const categories = await categoryModel.find({});
    const brands = await brandModel.find({});
    const offers = await offerModel.find({});
    const product = await productModel.findOne({ _id: id });
    return res.render(
        "admin/edit_product",
        {
            title: "Products",
            page: "Edit Product",
            categories,
            brands,
            offers,
            product
        }
    );
}

module.exports = {
    loadProducts,
    getProducts,
    addProductForm,
    deleteProduct,
    removeProductImage,
    addProductImage,
    productOptions,
    editProductForm,
    addProductPage,
    editProductPage
}