const clickDimensionsService = require('./clickDimensions');
const gotoWebinarService = require('./gotoWebinar');
const zoomWebinarService = require('./zoomWebinar');
const FormQueue = require('../models/FormQueue');
const validator = require('../utils/validators');
const logger = require('../config/logger');
const constants = require('../config/constants');

class FormProcessor {
    async processFormSubmission(formData, remoteIp, captchaScore) {
        try {
            // Validate CD form action
            const cdCaptureFormKey = validator.validateCaptureFormAction(formData.cd_action);

            // Get form structure from CD API
            const captureFields = await clickDimensionsService.getFormCaptureFields(cdCaptureFormKey);
            const formFields = await clickDimensionsService.getFormFields();

            if (!captureFields || !formFields) {
                throw new Error('Failed to fetch form configuration');
            }

            // Validate form fields
            const validationErrors = this.validateFormFields(
                formData.cd,
                captureFields,
                formFields
            );

            if (Object.keys(validationErrors).length > 0) {
                return {
                    success: false,
                    errors: validationErrors,
                };
            }

            // Sanitize email fields
            Object.keys(formData.cd).forEach((fieldId) => {
                const value = formData.cd[fieldId];
                if (value && this.isEmailField(fieldId, formFields)) {
                    formData.cd[fieldId] = validator.sanitizeEmail(value);
                }
            });

            // Queue the form
            const jobId = await FormQueue.insert({
                captchaScore,
                status: 'undue',
                data: formData.cd,
                debug: '',
                ip: remoteIp,
                captureFormKey: cdCaptureFormKey,
            });

            let result = {
                success: false,
                lowRating: captchaScore < constants.RECAPTCHA_MIN_SCORE,
                jobId,
            };

            if (result.lowRating) {
                logger.warn(`Low reCAPTCHA score: ${captchaScore}`);
                // Send notification email
                await this.sendLowScoreNotification(captchaScore);
            } else {
                // Process immediately
                const location = await this.submitForm(
                    cdCaptureFormKey,
                    formData.cd,
                    remoteIp,
                    jobId,
                    true
                );

                if (location) {
                    result.success = true;
                    result.location = location;
                    await FormQueue.update(jobId, {
                        status: 'synced',
                        synced_at: new Date(),
                    });
                }
            }

            return result;
        } catch (error) {
            logger.error('Form processing error:', error);
            throw error;
        }
    }

    async submitForm(captureFormKey, formData, remoteIp, jobId, fromFrontend = false) {
        let debug = '';

        try {
            const referer = `https://${process.env.WP_SERVER_NAME}`;
            const options = {};

            if (fromFrontend) {
                options.connectTimeout = constants.FORM_SYNC_CONNECT_TIMEOUT_MS;
                options.execTimeout = constants.FORM_SYNC_TIMEOUT_MS;
            }

            const response = await clickDimensionsService.submitForm(
                captureFormKey,
                formData,
                referer,
                options
            );

            logger.debug(`CD Response Status: ${response.statusCode}`);
            logger.debug(`CD Response Headers:`, response.headers);

            if (response.statusCode === 302 && response.headers.location) {
                const location = response.headers.location;
                const parsedUrl = new URL(location);
                const errorMessage = parsedUrl.searchParams.get('errorMessage');

                if (errorMessage) {
                    debug += `CD location:\n${location}\n`;
                    debug += `CD response:\n${response.data}\n`;

                    if (fromFrontend) {
                        await this.sendErrorNotification(
                            'Unsuccessful CD-form submission',
                            `CD returned errors during sync:\n${debug}`
                        );
                    }
                    return null;
                } else {
                    // Determine language code from referer
                    const langCode = await this.extractLanguageCode();

                    // Try to register with webinar services
                    if (formData.GotoWebinarKey) {
                        await this.registerWithGotoWebinar(
                            formData,
                            jobId,
                            fromFrontend
                        );
                    }

                    if (formData.ZoomKey) {
                        await this.registerWithZoom(
                            formData,
                            jobId,
                            fromFrontend
                        );
                    }

                    // Return localized success URL
                    return this.getLocalizedUrl(location, langCode);
                }
            } else {
                debug += `CD response:\n${response.data}\n`;

                if (fromFrontend) {
                    await this.sendErrorNotification(
                        'Something is wrong with ClickDimensions',
                        `Failed to submit CD-form:\n${debug}`
                    );
                }
                return null;
            }
        } catch (error) {
            logger.error('Form submission error:', error);
            debug += `Error: ${error.message}\n`;

            if (fromFrontend) {
                await this.sendErrorNotification(
                    'Something is wrong with ClickDimensions',
                    `Failed to submit CD-form:\n${debug}`
                );
            }
            return null;
        }
    }

    async registerWithGotoWebinar(formData, jobId, fromFrontend) {
        try {
            await gotoWebinarService.addWebinarRegistrant(
                formData.GotoWebinarKey,
                formData.CompanyName || '',
                formData.Email,
                formData.FirstName,
                formData.LastName
            );
        } catch (error) {
            logger.error('GotoWebinar registration failed:', error);
            await FormQueue.update(jobId, {
                retry_sync_with_gotowebinar: 1,
            });

            if (fromFrontend) {
                await this.sendErrorNotification(
                    'GotoWebinar registration failed',
                    error.message
                );
            }
        }
    }

    async registerWithZoom(formData, jobId, fromFrontend) {
        try {
            const result = await zoomWebinarService.addWebinarRegistrant(
                formData.ZoomKey,
                formData.Email,
                formData.FirstName,
                formData.LastName
            );

            if (result.status === 'failed') {
                await FormQueue.update(jobId, {
                    retry_sync_with_gotowebinar: 2,
                });
            }
        } catch (error) {
            logger.error('Zoom registration failed:', error);
            await FormQueue.update(jobId, {
                retry_sync_with_gotowebinar: 2,
            });

            if (fromFrontend) {
                await this.sendErrorNotification(
                    'Zoom registration failed',
                    error.message
                );
            }
        }
    }

    validateFormFields(formData, captureFields, formFields) {
        const errors = {};

        captureFields.forEach((captureField) => {
            const formField = formFields[captureField.FormFieldKey];
            if (!formField) {
                throw new Error(`Form field ${captureField.FormFieldKey} not found`);
            }

            const value = formData[formField.FormFieldId] || '';
            const fieldErrors = validator.validateFormField(
                captureField,
                formField,
                value
            );

            if (fieldErrors.length > 0) {
                errors[formField.FormFieldId] = fieldErrors;
            }

            // Truncate if needed
            if (value && value.length > formField.Length) {
                formData[formField.FormFieldId] = validator.truncateField(
                    value,
                    formField.Length
                );
            }
        });

        return errors;
    }

    isEmailField(fieldId, formFields) {
        return Object.values(formFields).some(
            (field) => field.FormFieldId === fieldId && field.Type === 'EMAIL'
        );
    }

    extractLanguageCode() {
        // Extract from HTTP_REFERER or use default
        return 'en';
    }

    getLocalizedUrl(url, langCode) {
        // Implement localization logic if needed
        return url;
    }

    async sendLowScoreNotification(score) {
        logger.warn(`Low reCAPTCHA score notification: ${score}`);
        // Implement email sending
    }

    async sendErrorNotification(subject, message) {
        logger.error(`Notification: ${subject} - ${message}`);
        // Implement email sending
    }
}

module.exports = new FormProcessor();