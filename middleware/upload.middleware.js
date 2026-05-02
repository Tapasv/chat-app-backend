const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');

// Cloudinary storage for profile pictures
const profileStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'chatify-profiles',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto' }
        ]
    }
});

// Local disk storage for chat file uploads
const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + '-' + file.originalname);
    }
});

const imageFileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const valid = allowed.test(file.mimetype) && allowed.test(file.originalname.toLowerCase());
    if (valid) return cb(null, true);
    cb(new ApiError(400, 'Only image files are allowed'));
};

const uploadProfilePicture = multer({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter
}).single('profilePicture');

const uploadFile = multer({
    storage: diskStorage,
    limits: { fileSize: 100 * 1024 * 1024 }
}).single('file');

module.exports = { uploadProfilePicture, uploadFile };