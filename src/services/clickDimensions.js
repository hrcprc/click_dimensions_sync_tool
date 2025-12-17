const axios = require('axios');
const logger = require('../config/logger');

class ClickDimensionsService {
    constructor() {
        this.accountKey = process.env.CLICK_DEMENTIA_ACCOUNT_KEY;
        this.token = process.env.CLICK_DEMENTIA_TOKEN;
        this.baseUrl = 'https://analytics-eu.clickdimensions.com';
    }

    async getFormCaptureFields(captureFormKey) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/api/forms/capture-fields/${captureFormKey}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                    },
                }
            );
            return response.data;
        } catch (error) {
            logger.error('Error fetching capture fields:', error);
            throw new Error('SyncCD: Failed to fetch capture fields');
        }
    }

    async getFormFields() {
        try {
            const response = await axios.get(
                `${this.baseUrl}/api/forms/fields`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                    },
                }
            );
            return response.data;
        } catch (error) {
            logger.error('Error fetching form fields:', error);
            throw new Error('SyncCD: Failed to fetch form fields');
        }
    }

    async submitForm(captureFormKey, formData, referer, options = {}) {
        try {
            const url = `${this.baseUrl}/forms/h/${captureFormKey}`;

            const config = {
                timeout: options.execTimeout || 65000,
                maxRedirects: 0,
                headers: {
                    'Referer': referer,
                    'User-Agent': 'Node.js CD-Sync Service',
                },
            };

            const response = await axios.post(url, formData, config);

            return {
                statusCode: response.status,
                headers: response.headers,
                data: response.data,
            };
        } catch (error) {
            if (error.response) {
                return {
                    statusCode: error.response.status,
                    headers: error.response.headers,
                    data: error.response.data,
                };
            }
            logger.error('Click Dimensions form submission error:', error);
            throw error;
        }
    }
}

module.exports = new ClickDimensionsService();