const FormQueue = require('../models/FormQueue');
const logger = require('../config/logger');
const constants = require('../config/constants');

class CleanupQueueJob {
    async deleteOldEntries() {
        logger.info('Starting cleanup of old queue entries...');
        try {
            const deleted = await FormQueue.deleteOlderThan(constants.QUEUE_RETENTION_DAYS);
            logger.info(`Deleted ${deleted} old queue entries`);
        } catch (error) {
            logger.error('Cleanup job error:', error);
        }
    }
}

module.exports = new CleanupQueueJob();