const winston = require('winston');
const path = require('path');

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

// Add http level support (used by Morgan)
winston.addColors({ http: 'magenta' });

// Human readable format for development
const devFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});

// JSON format for production — easy to parse by log aggregators
const prodFormat = combine(
    timestamp(),
    errors({ stack: true }),
    json()
);

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'http',
    format: process.env.NODE_ENV === 'production'
        ? prodFormat
        : combine(
            colorize(),
            timestamp({ format: 'HH:mm:ss' }),
            errors({ stack: true }),
            devFormat
        ),
    transports: [
        new winston.transports.Console(),

        // Error logs go to separate file
        new winston.transports.File({
            filename: path.join('logs', 'error.log'),
            level: 'error',
            format: prodFormat
        }),

        // All logs combined
        new winston.transports.File({
            filename: path.join('logs', 'combined.log'),
            format: prodFormat
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join('logs', 'exceptions.log'),
            format: prodFormat
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join('logs', 'rejections.log'),
            format: prodFormat
        })
    ]
});

module.exports = logger;