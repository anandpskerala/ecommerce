const offer = require('../../models/offer_model');
const timer = require('../../utils/time');
const httpStatus = require("../../utils/httpStatus");

const createOffer = async (req, res) => {
    try {
        const { name } = req.body;
        const exists = await offer.findOne({name: {$regex: new RegExp(`^${name}$`, 'i')}});
        if (exists) {
            return res.status(httpStatus.BAD_REQUEST).json({success: false, message: "Offer already exists"});
        }
        
        const offers = await offer.create(req.body);
        return res.status(httpStatus.CREATED).json({success: true, message: "Offer added successfully"});
    } catch (err) {
        console.error("Error in create offer:", err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({success: false, message: "An error occurred"});
    }
};

const loadOffers = async (req, res) => {
    return res.render(
        "admin/offers", 
        {
            title: "Offers", 
            page: "Offers", 
        }
    );
};

const getOffers = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.body;
        const offers = await offer.find().sort({createdAt: -1}).skip((page - 1) * limit).limit(Number(limit));
        const total = await offer.countDocuments();
        return res.status(httpStatus.OK).json(
            {
                success: true,
                offers,
                time: timer,
                totalPages: Math.ceil(total / limit),
                currentPage: Number(page),
            }
        );
    } catch (error) {
        console.log("Error in getting offers", error);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({success: false, message: "An error occurred"});
    }
};

const deleteOffer = async (req, res) => {
    const { id } = req.params;
    const exists = await offer.findOne({_id: id})
    if (!exists) {
        return res.status(httpStatus.BAD_REQUEST).json({success: false, message: "Invalid request"});
    }
    await offer.deleteOne({_id: id});
    return res.status(httpStatus.OK).json({success: true, message: "Offer deleted successfully"});
};

module.exports = {
    createOffer,
    loadOffers,
    deleteOffer,
    getOffers
}