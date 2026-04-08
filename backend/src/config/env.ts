import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000,http://localhost:3001'),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(200),
  FFMPEG_BIN: z.string().min(1).default('ffmpeg'),
  FFPROBE_BIN: z.string().min(1).default('ffprobe'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_STT_MODEL: z.string().min(1).default('whisper-large-v3'),
  GROQ_MAX_CHUNK_MB: z.coerce.number().positive().default(25),
  AUDIO_CHUNK_SECONDS: z.coerce.number().int().positive().default(600),
  AUDIO_MIN_CHUNK_SECONDS: z.coerce.number().int().positive().default(60),
  GROQ_CHUNK_RETRY_ATTEMPTS: z.coerce.number().int().nonnegative().default(2),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().min(1).default('deepseek-chat'),
  DEEPSEEK_BASE_URL: z.string().min(1).default('https://api.deepseek.com')
});

export const env = envSchema.parse(process.env);
