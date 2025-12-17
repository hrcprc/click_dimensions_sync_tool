
const express = require('express');
const router = express.Router();
const recaptchaService = require('../services/recaptcha');
const formProcessor = require('../services/formProcessor');
const logger = require('../config/logger');

// Form submission endpoint
router.post('/submit', async (req, res) => {
    try {
        const { captcha_token, cd, cd_action, cd_visitorkey } = req.body;

        if (!cd || !cd_action) {
            return res.status(400).json({
                success: false,
                errors: { form: ['Missing required fields'] },
            });
        }

        // Verify reCAPTCHA
        const remoteIp = req.ip || req.connection.remoteAddress;
        const captchaResult = await recaptchaService.verify(captcha_token, remoteIp);

        if (!captchaResult.success) {
            logger.warn('reCAPTCHA verification failed', captchaResult);
            return res.status(400).json({
                success: false,
                errors: { captcha: ['reCAPTCHA verification failed'] },
            });
        }

        // Process form
        const result = await formProcessor.processFormSubmission(
            {
                cd_action,
                cd,
                cd_visitorkey: cd_visitorkey || '',
            },
            remoteIp,
            captchaResult.score
        );

        res.json(result);
    } catch (error) {
        logger.error('Form submission error:', error);
        res.status(500).json({
            success: false,
            errors: { form: ['Server error'] },
        });
    }
});

module.exports = router;