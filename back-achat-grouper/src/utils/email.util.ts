import nodemailer from 'nodemailer';
import { config } from '../config/env';
import { logger } from './logger.util';

// Créer le transporteur email
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey',
    pass: config.sendgrid.apiKey,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Envoyer un email
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from: `${config.sendgrid.fromName} <${config.sendgrid.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    logger.info(`Email sent to ${options.to}`);
  } catch (error) {
    logger.error('Error sending email:', error);
    throw error;
  }
}

/**
 * Templates d'emails
 */
export const emailTemplates = {
  welcome: (firstName: string, otpCode: string) => ({
    subject: 'Bienvenue sur GroupBuy !',
    html: `
      <h1>Bienvenue ${firstName} !</h1>
      <p>Merci de vous être inscrit sur GroupBuy.</p>
      <p>Votre code de vérification est : <strong style="font-size: 24px;">${otpCode}</strong></p>
      <p>Ce code expire dans 10 minutes.</p>
    `,
  }),

  groupSuccess: (groupName: string, finalPayment: number) => ({
    subject: 'Groupe réussi ! 🎉',
    html: `
      <h1>Félicitations !</h1>
      <p>Le groupe "${groupName}" a atteint son objectif.</p>
      <p>Montant restant à payer : <strong>${finalPayment} FCFA</strong></p>
      <p>Veuillez procéder au paiement final dans les prochaines 48h.</p>
    `,
  }),

  groupFailed: (groupName: string) => ({
    subject: 'Groupe non abouti',
    html: `
      <h1>Groupe non abouti</h1>
      <p>Le groupe "${groupName}" n'a pas atteint le nombre minimum de participants.</p>
      <p>Votre dépôt sera automatiquement remboursé sous 72h.</p>
    `,
  }),

  orderShipped: (orderNumber: string, trackingNumber: string) => ({
    subject: 'Commande expédiée 📦',
    html: `
      <h1>Votre commande a été expédiée !</h1>
      <p>Numéro de commande : <strong>${orderNumber}</strong></p>
      <p>Numéro de suivi : <strong>${trackingNumber}</strong></p>
      <p>Vous recevrez votre colis dans les prochains jours.</p>
    `,
  }),
};
