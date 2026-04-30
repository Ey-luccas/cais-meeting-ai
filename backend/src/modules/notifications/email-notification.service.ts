import nodemailer from 'nodemailer';

import { env } from '../../config/env';
import { logger } from '../../shared/logger';

type SendNotificationEmailInput = {
  toEmail: string;
  recipientName?: string;
  title: string;
  message: string;
  targetHref?: string | null;
};

type SmtpConfig = {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
};

const buildFrontendBaseUrl = (): string | null => {
  const configuredUrl = env.FRONTEND_APP_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  const firstCorsOrigin = env.CORS_ORIGIN.split(',')
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0);

  return firstCorsOrigin ? firstCorsOrigin.replace(/\/$/, '') : null;
};

const toAbsoluteTargetUrl = (targetHref?: string | null): string | null => {
  if (!targetHref) {
    return null;
  }

  if (/^https?:\/\//i.test(targetHref)) {
    return targetHref;
  }

  const baseUrl = buildFrontendBaseUrl();

  if (!baseUrl) {
    return targetHref;
  }

  return targetHref.startsWith('/') ? `${baseUrl}${targetHref}` : `${baseUrl}/${targetHref}`;
};

const parsePort = (value: string | undefined): number => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return 587;
  }

  const parsed = Number.parseInt(trimmed, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 587;
  }

  return parsed;
};

export class EmailNotificationService {
  private transporter: nodemailer.Transporter | null = null;

  private resolveSmtpConfig(): SmtpConfig | null {
    const host = env.SMTP_HOST?.trim();

    if (!host) {
      return null;
    }

    return {
      host,
      port: parsePort(env.SMTP_PORT),
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
      secure: config.port === 465,
      auth: config.user && config.pass
        ? {
            user: config.user,
            pass: config.pass
          }
        : undefined
    });

    return this.transporter;
  }

  async sendNotificationEmail(input: SendNotificationEmailInput): Promise<boolean> {
    const config = this.resolveSmtpConfig();

    if (!config) {
      logger.warn('SMTP não configurado. Notificação por e-mail foi ignorada.', {
        title: input.title,
        toEmail: input.toEmail
      });
      return false;
    }

    const targetEmail = input.toEmail.trim();

    if (!targetEmail || !targetEmail.includes('@')) {
      logger.warn('E-mail do destinatário inválido para envio de notificação.', {
        title: input.title,
        toEmail: input.toEmail
      });
      return false;
    }

    const absoluteTargetUrl = toAbsoluteTargetUrl(input.targetHref);

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <p>Olá${input.recipientName ? `, ${input.recipientName}` : ''}.</p>
        <p>${input.message}</p>
        ${absoluteTargetUrl ? `<p><a href="${absoluteTargetUrl}" style="display:inline-block;padding:10px 14px;background:#0f5ab0;color:#fff;border-radius:8px;text-decoration:none;">Abrir no Cais Teams</a></p>` : ''}
        ${absoluteTargetUrl ? `<p style="font-size:12px;color:#64748b;">Se o botão não funcionar, copie o link: ${absoluteTargetUrl}</p>` : ''}
        <p>Equipe Cais Teams</p>
      </div>
    `;

    try {
      const transporter = this.getTransporter(config);

      await transporter.sendMail({
        from: config.from,
        to: targetEmail,
        subject: `[Cais Teams] ${input.title}`,
        html: htmlBody,
        text: [
          `Olá${input.recipientName ? `, ${input.recipientName}` : ''}.`,
          '',
          input.message,
          '',
          absoluteTargetUrl ? `Acesse: ${absoluteTargetUrl}` : null,
          '',
          'Equipe Cais Teams'
        ]
          .filter(Boolean)
          .join('\n')
      });

      return true;
    } catch (error) {
      logger.error('Falha ao enviar notificação por e-mail.', {
        title: input.title,
        toEmail: targetEmail,
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }
}

export const emailNotificationService = new EmailNotificationService();
