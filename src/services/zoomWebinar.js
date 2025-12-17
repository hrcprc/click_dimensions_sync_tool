const axios = require('axios');
const logger = require('../config/logger');

class ZoomWebinarService {
    constructor() {
        this.baseUrl = 'https://api.zoom.us/v2';
    }

    async addWebinarRegistrant(webinarId, email, firstName, lastName) {
        try {
            const payload = {
                first_name: firstName,
                last_name: lastName,
                email,
            };

            const response = await axios.post(
                `${this.baseUrl}/webinars/${webinarId}/registrants`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.ZOOM_ACCESS_TOKEN}`,
                    },
                }
            );

            logger.info(`Zoom registrant added: ${email}`);
            return { status: 'success', registrantId: response.data.id };
        } catch (error) {
            logger.error('Zoom registration error:', error.response?.data || error.message);
            return { status: 'failed', error: error.message };
        }
    }
}

module.exports = new ZoomWebinarService();