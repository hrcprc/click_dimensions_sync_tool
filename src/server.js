require('dotenv').config({
    path: '../../shared/.env'
    }

);
const app = require('./app');
const logger = require('./config/logger');
const syncQueueJob = require('./jobs/syncQueue');
const cleanupQueueJob = require('./jobs/cleanupQueue');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    logger.info(`CD Sync Service running on port ${PORT}`);
});

// Setup background jobs
// Run every 5 minutes
setInterval(() => {
    syncQueueJob.processForceSyncQueue();
    syncQueueJob.processGotoWebinarRetries();
    syncQueueJob.processZoomRetries();
},  30 * 1000);

// Run cleanup daily at midnight
const setupDailyCleanup = () => {
    const now = new Date();
    const night = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const msToMidnight = night.getTime() - now.getTime();

    setTimeout(() => {
        cleanupQueueJob.deleteOldEntries();
        setInterval(() => {
            cleanupQueueJob.deleteOldEntries();
        }, 24 * 60 * 60 * 1000);
    }, msToMidnight);
};

setupDailyCleanup();

process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
    });
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = server;