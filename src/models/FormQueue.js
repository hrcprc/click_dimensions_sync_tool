const pool = require('../config/database');
const logger = require('../config/logger');

class FormQueue {
    async insert(formData) {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.execute(
                `INSERT INTO cd_forms_queue 
        (captcha_score, status, created_at, data, debug, ip, capture_form_key) 
        VALUES (?, ?, NOW(), ?, ?, ?, ?)`,
                [
                    formData.captchaScore,
                    formData.status || 'undue',
                    JSON.stringify(formData.data),
                    formData.debug || '',
                    formData.ip,
                    formData.captureFormKey,
                ]
            );
            return result.insertId;
        } finally {
            connection.release();
        }
    }

    async getByStatus(status) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                `SELECT * FROM cd_forms_queue 
        WHERE status = ? 
        ORDER BY created_at DESC`,
                [status]
            );
            return rows;
        } finally {
            connection.release();
        }
    }

    async update(jobId, updateData) {
        const connection = await pool.getConnection();
        try {
            const updates = [];
            const values = [];

            Object.entries(updateData).forEach(([key, value]) => {
                updates.push(`${key} = ?`);
                values.push(value);
            });

            values.push(jobId);

            const query = `UPDATE cd_forms_queue SET ${updates.join(', ')} WHERE job_id = ?`;
            await connection.execute(query, values);
        } finally {
            connection.release();
        }
    }

    async deleteOlderThan(days) {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.execute(
                `DELETE FROM cd_forms_queue 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
                [days]
            );
            return result.affectedRows;
        } finally {
            connection.release();
        }
    }

    async getRetryGotoWebinar() {
        return this.getByStatus('retry_goto_webinar');
    }

    async getRetryZoom() {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                `SELECT * FROM cd_forms_queue 
        WHERE retry_sync_with_gotowebinar = 2 
        ORDER BY created_at DESC`
            );
            return rows;
        } finally {
            connection.release();
        }
    }
}

module.exports = new FormQueue();