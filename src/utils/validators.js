const logger = require('../config/logger');

class FormValidator {
    validateCaptureFormAction(action) {
        const match = action.match(/https:\/\/analytics-eu\.clickdimensions\.com\/forms\/h\/(.*)/);
        if (!match || !match[1]) {
            throw new Error('Wrong CD-form action');
        }
        return match[1];
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validateFormField(captureField, formField, value) {
        const errors = [];

        if (captureField.Required && !value) {
            errors.push('Field is required');
        }

        if (formField.Length && value && value.length > formField.Length) {
            // Will be truncated
            logger.warn(`Field ${formField.FormFieldId} will be truncated`);
        }

        if (formField.Type === 'EMAIL' && value) {
            if (!this.validateEmail(value)) {
                errors.push('Wrong format');
            }
        }

        if (
            !captureField.Required &&
            ['CHECKBOX', 'DROP_DOWN'].includes(formField.Type) &&
            value &&
            !formField.Options[value]
        ) {
            errors.push('Unknown value');
        }

        return errors;
    }

    sanitizeEmail(email) {
        return email.toLowerCase().trim();
    }

    truncateField(value, maxLength) {
        if (value && maxLength && value.length > maxLength) {
            return value.substring(0, maxLength);
        }
        return value;
    }
}

module.exports = new FormValidator();