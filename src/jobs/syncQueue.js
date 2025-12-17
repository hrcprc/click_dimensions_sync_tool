const FormQueue = require('../models/FormQueue');
const formProcessor = require('../services/formProcessor');
const gotoWebinarService = require('../services/gotoWebinar');
const zoomWebinarService = require('../services/zoomWebinar');
const logger = require('../config/logger');

class SyncQueueJob {
    async processForceSyncQueue() {
        logger.info('Processing force sync queue...');
        try {
            const cases = await FormQueue.getByStatus('force_sync');

            for (const caseData of cases) {
                try {
                    const formData = JSON.parse(caseData.data);
                    let debug = '';

                    const location = await formProcessor.submitForm(
                        caseData.capture_form_key,
                        formData,
                        caseData.ip,
                        caseData.job_id,
                        false
                    );

                    await FormQueue.update(caseData.job_id, {
                        status: location ? 'synced' : 'unsuccessful',
                        synced_at: new Date(),
                        sync_attempt: caseData.sync_attempt + 1,
                        debug: `<FORCE SYNC> ${new Date().toISOString()}\n${debug}</FORCE SYNC>\n${caseData.debug}`,
                    });
                } catch (error) {
                    logger.error(`Error syncing case ${caseData.job_id}:`, error);
                }
            }
        } catch (error) {
            logger.error('Force sync queue processing error:', error);
        }
    }

    async processGotoWebinarRetries() {
        logger.info('Processing GotoWebinar retries...');
        try {
            const cases = await FormQueue.getRetryGotoWebinar();

            for (const caseData of cases) {
                try {
                    const formData = JSON.parse(caseData.data);

                    await gotoWebinarService.addWebinarRegistrant(
                        formData.GotoWebinarKey,
                        formData.CompanyName || '',
                        formData.Email,
                        formData.FirstName,
                        formData.LastName
                    );

                    await FormQueue.update(caseData.job_id, {
                        debug: `<GOTOWEBINAR RESYNC> ${new Date().toISOString()}</GOTOWEBINAR RESYNC>\n${caseData.debug}`,
                        retry_sync_with_gotowebinar: 0,
                    });
                } catch (error) {
                    logger.error(`GotoWebinar retry error for ${caseData.job_id}:`, error);
                }
            }
        } catch (error) {
            logger.error('GotoWebinar retry processing error:', error);
        }
    }

    async processZoomRetries() {
        logger.info('Processing Zoom retries...');
        try {
            const cases = await FormQueue.getRetryZoom();

            for (const caseData of cases) {
                try {
                    const formData = JSON.parse(caseData.data);

                    const result = await zoomWebinarService.addWebinarRegistrant(
                        formData.ZoomKey,
                        formData.Email,
                        formData.FirstName,
                        formData.LastName
                    );

                    await FormQueue.update(caseData.job_id, {
                        debug: `<ZOOM RESYNC> ${new Date().toISOString()}</ZOOM RESYNC>\n${caseData.debug}`,
                        retry_sync_with_gotowebinar: result.status === 'failed' ? 2 : 0,
                        sync_attempt: caseData.sync_attempt + 1,
                    });
                } catch (error) {
                    logger.error(`Zoom retry error for ${caseData.job_id}:`, error);
                }
            }
        } catch (error) {
            logger.error('Zoom retry processing error:', error);
        }
    }
}

module.exports = new SyncQueueJob();