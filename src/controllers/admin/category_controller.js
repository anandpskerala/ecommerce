const path = require('path');
const fs = require('fs');
const category = require('../../models/category_model');
const timer = require('../../utils/time');
const offer_model = require('../../models/offer_model');
const httpStatus = require("../../utils/httpStatus");


const addCategoryForm = async (req, res) => {
    try {
        const {name, description} = req.body;
        const image = req.file.filename;
        const exists = await category.findOne({name: {$regex: new RegExp(`^${name}$`, 'i')}});
        if (exists) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting file:", err);
                console.log("File deleted successfully");
            });
            return res.status(httpStatus.BAD_REQUEST).json({success: false, message: "Category already exists"});
        }
        
        const cate = new category({name, description, image});
        await cate.save();
        return res.status(httpStatus.OK).json({success: true, message: "Category added"});
    } catch (err) {
        console.error("Error in add brand:", err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({success: false, message: "An error occurred" + err});
    }
}

const loadCategory = async (req, res) => {
    return res.render(
        "admin/categories", 
        {
            title: "Categories", 
            page: "Categories", 
        }
    );
}

const getCategories = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.body;
        const categories = await category.find().sort({createdAt: -1}).skip((page - 1) * limit).limit(Number(limit));
        const offers = await offer_model.find({type: "category"});
        const total = await category.countDocuments();
        return res.status(httpStatus.OK).json(
            {
                success: true,
                categories,
                offers,
                totalPages: Math.ceil(total / limit),
                currentPage: Number(page),
            }
        );
    } catch (error) {
        console.log("Error in getting categories", error)
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({success: false, message: "An error occurred"});
    }
}

const editCategory = async (req, res) => {
    try {
        const {id, name, description, status, offer} = req.body;
        const cate = await category.findOne({_id: id});
        if (req.file) {
            fs.unlink(path.join(__dirname, "../uploads", cate.image), (err) => {
                if (err) console.error("Error deleting file:", err);
                console.log("File deleted successfully");
            });
        }

        const data = req.file ? {name: name, description: description, status: status, image: req.file.filename, offer, updatedAt: Date.now()} : {name: name, description: description, status: status, offer, updatedAt: Date.now()};
        await category.updateOne({_id: id}, {$set: data});
        return res.status(httpStatus.OK).json({success: true, message: "Category updated successfully"});
    } catch (err) {
        console.log(err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({success: false, message: "An error occurred"});
    }
};

const deleteCategory = async (req, res) => {
    const { id } = req.params;
    const exists = await category.findOne({_id: id})
    if (!exists) {
        return res.status(httpStatus.BAD_REQUEST).json({success: false, message: "Invalid request"});
    }
    await category.deleteOne({_id: id});
    fs.unlink(path.join(__dirname, "../uploads", exists.image), (err) => {
        if (err) console.error("Error deleting file:", err);
        console.log("File deleted successfully");
    });
    return res.status(httpStatus.OK).json({success: true, message: "Category deleted successfully"});
};

module.exports = {
    addCategoryForm,
    loadCategory,
    getCategories,
    editCategory,
    deleteCategory,
};