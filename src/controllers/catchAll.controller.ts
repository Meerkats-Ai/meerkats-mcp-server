import axios from 'axios';
import logger from '../utils/logger.js';

// Email service API endpoint
const EMAIL_SERVICE_URL = 'http://34.46.80.154/api/email';
// const EMAIL_SERVICE_URL = 'http://localhost:3009/api/email';
const API_KEY = 'jhfgkjghtucvfg'; // API key for the email service

/**
 * Guess email addresses based on name and domain
 */
const guessEmail = async (body: any) => {
    const { firstName, lastName, domain, fromEmail } = body;

    if (!firstName || !lastName || !domain) {
        throw new Error('First name, last name, and domain are required');
    }

    try {
        // Make a request to the email-services API
        const response = await axios.post(
            `${EMAIL_SERVICE_URL}/guess`,
            {
                firstName,
                lastName,
                domain,
                company: body.company // Optional
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': API_KEY
                }
            }
        );

        logger.info(`Email guess response:`, response.data);

        return response.data;
    } catch (error: any) {
        logger.error('Error guessing email:', error);
        
        throw new Error(`Failed to guess email: ${error.message}`);
    }
};

/**
 * Verify if an email address is valid
 */
const verifyEmail = async (email: string, fromEmail: string) => {
    if (!email) {
        throw new Error('Email is required');
    }

    try {
        // Make a request to the email-services API
        const response = await axios.post(
            `${EMAIL_SERVICE_URL}/verify`,
            {
                email,
                fromEmail
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': API_KEY
                }
            }
        );

        logger.info(`Email verification response:`, response.data);
        console.log(response.data);
        return response.data;
    } catch (error: any) {
        logger.error('Error verifying email:', error);
        
        throw new Error(`Failed to verify email: ${error.message}`);
    }
};
const isDomainCatchAll = async (domain: string) => {
    if (!domain) {
        throw new Error('Domain is required');
    }

    try {
        // Make a request to the email-services API
        const response = await axios.post(
            `${EMAIL_SERVICE_URL}/catchall`,
            {
                domain
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': API_KEY
                }
            }
        );

        logger.info(`Domain catch-all response:`, response.data);
        console.log(response.data);
        return response.data;
    } catch (error: any) {
        logger.error('Error checking domain catch-all:', error);
        
        throw new Error(`Failed to check domain catch-all: ${error.message}`);
    }
}
const domainMxRecords = async (domain: string) => {
    if (!domain) {
        throw new Error('Domain is required');
    }

    try {
        // Make a request to the email-services API
        const response = await axios.post(
            `${EMAIL_SERVICE_URL}/mx`,
            {
                domain
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': API_KEY
                }
            }
        );

        logger.info(`Domain MX records response:`, response.data);
        console.log(response.data);
        return response.data;
    } catch (error: any) {
        logger.error('Error getting domain MX records:', error);
        
        throw new Error(`Failed to get domain MX records: ${error.message}`);
    }
}
export default {
    guessEmail,
    verifyEmail,
    isDomainCatchAll,
    domainMxRecords
};
