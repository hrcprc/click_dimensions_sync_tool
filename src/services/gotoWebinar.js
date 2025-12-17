const axios = require('axios');
const logger = require('../config/logger');

class GotoWebinarService {
    constructor() {
        this.baseUrl = 'https://api.getgo.com/G2W/rest/v2';
    }

    async addWebinarRegistrant(webinarKey, companyName, email, firstName, lastName) {
        try {
            const payload = {
                firstName,
                lastName,
                email,
                companyName: companyName || '',
            };

            const response = await axios.post(
                `${this.baseUrl}/webinars/${webinarKey}/registrants`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.GOTO_WEBINAR_TOKEN}`,
                    },
                }
            );

            logger.info(`GotoWebinar registrant added: ${email}`);
            return { status: 'success', data: response.data };
        } catch (error) {
            logger.error('GotoWebinar registration error:', error.response?.data || error.message);
            return { status: 'failed', error: error.message };
        }
    }
}

module.exports = new GotoWebinarService();