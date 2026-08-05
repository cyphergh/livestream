import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { config } from './config';
import { auth } from './modules/auth/auth';
import { publicChannels, adminChannels } from './modules/channels/channels';

export const app = new Elysia()
  .use(
    cors({
      origin: config.CLIENT_URL,
      credentials: true,
    })
  )
  .get('/health', () => ({ status: 'ok', uptime: process.uptime() }))
  .use(auth)
  .use(publicChannels)
  .use(adminChannels)
  .onError(({ code, error, set }) => {
    const message = error instanceof Error ? error.message : String(error);
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { message: 'Not found' };
    }
    if (code === 'VALIDATION') {
      set.status = 422;
      return { message: 'Validation failed' };
    }
    set.status = 500;
    console.error('Unhandled error:', error);
    return { message: 'Internal server error' };
  });