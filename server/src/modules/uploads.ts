import { Elysia, t } from 'elysia';
import path from 'path';
import { jwtPlugin } from '../lib/jwt-plugin';
import { resolveUser } from '../lib/user';
import { isProducer } from '../lib/auth';
import { uploadsDir } from '../lib/uploads';

const extFor = (mime: string) => {
  switch (mime) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/svg+xml':
      return '.svg';
    default:
      return '.png';
  }
};

// Authenticated upload endpoint for channel logos. Files land in
// server/uploads/logos and are served back via /uploads/logos/<name>.
export const uploads = new Elysia({ prefix: '/api/uploads' })
  .use(jwtPlugin())
  .derive(async (ctx) => ({ user: await resolveUser(ctx) }))
  .post(
    '/logo',
    async ({ body, user, set }) => {
      if (!isProducer(user)) {
        set.status = 403;
        return { message: 'Forbidden' };
      }
      const file = body.file;
      const dir = uploadsDir('logos');
      const name = `${crypto.randomUUID()}${extFor(file.type)}`;
      await Bun.write(path.join(dir, name), file);
      return { url: `/uploads/logos/${name}` };
    },
    {
      body: t.Object({
        file: t.File({ type: 'image', maxSize: 5 * 1024 * 1024 }),
      }),
    }
  );

// Static serving for /uploads/* (logos etc.).
export const uploadsStatic = new Elysia().get('/uploads/*', async ({ params, set }) => {
  const rel = params['*'] as string | undefined;
  if (!rel || rel.includes('..')) {
    set.status = 404;
    return { message: 'Not found' };
  }
  const file = Bun.file(path.join(uploadsDir(''), rel));
  if (!(await file.exists())) {
    set.status = 404;
    return { message: 'Not found' };
  }
  return new Response(file);
});