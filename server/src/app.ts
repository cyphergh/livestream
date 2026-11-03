import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { config } from './config';
import { auth } from './modules/auth/auth';
import { publicChannels, adminChannels } from './modules/channels/channels';
import { mediaAuth } from './modules/media/auth';
import { whip } from './modules/media/whip';
import { whepProxy } from './modules/media/whep';
import { hlsProxy } from './modules/media/hls';
import { ingest } from './modules/ingest/ingest';
import { realtime } from './modules/realtime';
import { uploads, uploadsStatic } from './modules/uploads';
import { publicMedia, adminMedia } from './modules/media';
import { publicContent, adminSettings } from './modules/cms';
import { publicGuide, adminPrograms } from './modules/programs';

export const app = new Elysia()
  .use(
    cors({
      origin: config.CLIENT_URL,
      credentials: true,
    })
  )
  .get('/health', () => ({ status: 'ok', uptime: process.uptime() }))
  .use(uploadsStatic)
  .use(auth)
  .use(mediaAuth)
  .use(whip)
  .use(whepProxy)
  .use(hlsProxy)
  .use(publicChannels)
  .use(publicGuide)
  .use(publicMedia)
  .use(publicContent)
  .use(adminChannels)
  .use(adminPrograms)
  .use(adminMedia)
  .use(adminSettings)
  .use(ingest)
  .use(realtime)
  .use(uploads)
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