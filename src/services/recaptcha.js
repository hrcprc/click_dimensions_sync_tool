const axios = require('axios');
const logger = require('../config/logger');

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

class RecaptchaService {
    async verify(token, remoteIp) {
        try {
            if (!token) {
                logger.warn('Captcha token was not submitted');
                return { success: false, score: 0, reason: 'No token provided' };
            }

            const response = await axios.post(RECAPTCHA_VERIFY_URL, null, {
                params: {
                    secret: process.env.GOOGLE_RECAPTCHA_SECRET_KEY,
                    response: token,
                    remoteip: remoteIp,
                },
            });

            logger.debug('reCAPTCHA response:', response.data);

            if (response.data.success) {
                return {
                    success: true,
                    score: response.data.score || 0,
                };
            }

            return {
                success: false,
                score: 0,
                errors: response.data['error-codes'],
            };
        } catch (error) {
            logger.error('reCAPTCHA verification error:', error);
            return {
                success: false,
                score: 0,
                reason: 'Verification failed',
            };
        }
    }
}

module.exports = new RecaptchaService();