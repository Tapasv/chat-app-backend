const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const errorMiddleware = (err, req, res, next) => {
    let error = err;

    if (!(error instanceof ApiError)) {
        const statusCode = error.statusCode || 500;
        const message = error.message || 'Something went wrong';
        error = new ApiError(statusCode, message, error?.errors || [], err.stack);
    }

    // Log all 500s as errors, everything else as warnings
    if (error.statusCode >= 500) {
        logger.error({
            message: error.message,
            statusCode: error.statusCode,
            stack: error.stack,
            path: req.path,
            method: req.method,
            userId: req.userID || 'unauthenticated'
        });
    } else {
        logger.warn({
            message: error.message,
            statusCode: error.statusCode,
            path: req.path,
            method: req.method,
            userId: req.userID || 'unauthenticated'
        });
    }

    const response = {
        statusCode: error.statusCode,
        message: error.message,
        success: false,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
        ...(error.errors?.length > 0 && { errors: error.errors })
    };

    return res.status(error.statusCode).json(response);
};

module.exports = errorMiddleware;