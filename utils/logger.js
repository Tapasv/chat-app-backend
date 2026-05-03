const winston = require('winston');
const path = require('path');
const fs = require('fs');

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

winston.addColors({ http: 'magenta' });

const devFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});

const prodFormat = combine(
    timestamp(),
    errors({ stack: true }),
    json()
);

// Only create file transports if we can write to disk
const isProduction = process.env.NODE_ENV === 'production';
const fileTransports = [];

if (!isProduction) {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    fileTransports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            format: prodFormat
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            format: prodFormat
        })
    );
}

const logger = winston.createLogger({
    level: isProduction ? 'info' : 'http',
    format: isProduction
        ? prodFormat
        : combine(
            colorize(),
            timestamp({ format: 'HH:mm:ss' }),
            errors({ stack: true }),
            devFormat
        ),
    transports: [
        new winston.transports.Console(),
        ...fileTransports
    ],
    exceptionHandlers: [
        new winston.transports.Console(),
        ...(!isProduction ? fileTransports : [])
    ],
    rejectionHandlers: [
        new winston.transports.Console(),
        ...(!isProduction ? fileTransports : [])
    ]
});

module.exports = logger;