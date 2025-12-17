
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const logger = require('./config/logger');
const formsRouter = require('./routes/forms');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/forms', formsRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Error handling
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
    });
});

module.exports = app;