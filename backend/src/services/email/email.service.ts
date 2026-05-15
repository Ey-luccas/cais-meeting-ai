import nodemailer from 'nodemailer';

import { env } from '../../config/env';
import { logger } from '../../shared/logger';

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const parsePort = (value: string | undefined): number => {
  const parsed = Number.parseInt(value?.trim() ?? '587', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 587;
  }

  return parsed;
};

const resolveAppUrl = (): string => {
  const appUrl = env.APP_URL?.trim();
  if (appUrl) {
    return appUrl.replace(/\/$/, '');
  }

  const frontendAppUrl = env.FRONTEND_APP_URL?.trim();
  if (frontendAppUrl) {
    return frontendAppUrl.replace(/\/$/, '');
  }

  const firstOrigin = env.CORS_ORIGIN.split(',')
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0);

  if (firstOrigin) {
    return firstOrigin.replace(/\/$/, '');
  }

  return 'http://localhost:3000';
};

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  getAppUrl(path?: string): string {
    const base = resolveAppUrl();

    if (!path) {
      return base;
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  }

  private resolveSmtpConfig(): SmtpConfig | null {
    const host = env.SMTP_HOST?.trim();

    if (!host) {
      return null;
    }

    const port = parsePort(env.SMTP_PORT);

    return {
      host,
      port,
      secure: port === 465,
      user: env.SMTP_USER?.trim() || undefined,
      pass: env.SMTP_PASS?.trim() || undefined,
      from: env.SMTP_FROM?.trim() || 'Cais Teams <noreply@localhost>'
    };
  }

  isConfigured(): boolean {
    return Boolean(this.resolveSmtpConfig());
  }

  private getTransporter(config: SmtpConfig): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth:
        config.user && config.pass
          ? {
              user: config.user,
              pass: config.pass
            }
          : undefined
    });

    return this.transporter;
  }

  async sendEmail(input: SendEmailInput): Promise<boolean> {
    const config = this.resolveSmtpConfig();

    if (!config) {
      logger.warn('SMTP não configurado. E-mail não enviado.', {
        to: input.to,
        subject: input.subject
      });
      return false;
    }

    try {
      const transporter = this.getTransporter(config);
      await transporter.sendMail({
        from: config.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text
      });

      return true;
    } catch (error) {
      logger.error('Falha ao enviar e-mail via SMTP.', {
        to: input.to,
        subject: input.subject,
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }
}

export const emailService = new EmailService();
