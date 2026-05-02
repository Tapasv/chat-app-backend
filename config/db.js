const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        logger.info('Connected to MongoDB');
    } catch (err) {
        logger.error('MongoDB connection error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;