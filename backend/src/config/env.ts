import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(200),
  JWT_SECRET: z.string().min(24),
  JWT_EXPIRES_IN: z.string().default('12h'),
  AUTH_COOKIE_NAME: z.string().min(1).default('cais_meeting_ai_auth'),
  AUTH_COOKIE_MAX_AGE_DAYS: z.coerce.number().int().positive().default(7),
  TRANSCRIPTION_ENGINE: z.enum(['GROQ', 'LOCAL_FALLBACK']).default('GROQ'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_STT_MODEL: z.string().min(1).default('whisper-large-v3'),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().min(1).default('deepseek-chat'),
  DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com'),
  FRONTEND_APP_URL: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional()
});

export const env = envSchema.parse(process.env);
