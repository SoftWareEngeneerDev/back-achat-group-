import twilio from 'twilio';
import { config } from '../config/env';
import { logger } from './logger.util';

// Créer le client Twilio
const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

interface SmsOptions {
  to: string;
  message: string;
}

/**
 * Envoyer un SMS
 */
export async function sendSms(options: SmsOptions): Promise<void> {
  try {
    await twilioClient.messages.create({
      body: options.message,
      from: config.twilio.phoneNumber,
      to: options.to,
    });

    logger.info(`SMS sent to ${options.to}`);
  } catch (error) {
    logger.error('Error sending SMS:', error);
    throw error;
  }
}
