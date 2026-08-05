import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_URL: z.string().default('http://localhost:3000'),
  CLIENT_URL: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  MEDIAMTX_API: z.string().default('http://localhost:9997'),
  MEDIAMTX_API_KEY: z.string().min(1),
  MEDIAMTX_HLS_URL: z.string().default('http://localhost:8888'),
  MEDIAMTX_WHEP_URL: z.string().default('http://localhost:8889'),
  MEDIAMTX_RTMP_ADDR: z.string().default('localhost:1935'),
  MEDIAMTX_RTSP_ADDR: z.string().default('localhost:8554'),
  MEDIAMTX_SRT_ADDR: z.string().default('localhost:8890'),
  PUBLIC_URL: z.string().default('http://localhost'),
});

const parsed = envSchema.safeParse(Bun.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
