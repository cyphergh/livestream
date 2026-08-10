import { Elysia, t } from 'elysia';
import path from 'path';
import fs from 'node:fs/promises';
import { prisma } from '../lib/db';
import { jwtPlugin } from '../lib/jwt-plugin';
import { resolveUser } from '../lib/user';
import { isAdmin } from '../lib/auth';
import { uploadsDir, deleteUploadedFile } from '../lib/uploads';

// CMS media library: admin uploads images and videos. Images are stored as-is
// with a small generated thumbnail; videos are transcoded to VOD HLS with
// ffmpeg asynchronously (status PROCESSING -> READY | FAILED). Publishing an
// asset exposes it on the public landing page via /api/media.

const imageExt = (mime: string) => {
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

const videoExt = (mime: string) => {
  switch (mime) {
    case 'video/mp4':
      return '.mp4';
    case 'video/webm':
      return '.webm';
    case 'video/quicktime':
      return '.mov';
    case 'video/x-matroska':
      return '.mkv';
    default:
      return '.mp4';
  }
};

const serialize = (a: any) => ({
  id: a.id,
  type: a.type,
  name: a.name,
  description: a.description,
  mime: a.mime,
  size: a.size,
  status: a.status,
  url: a.url,
  posterUrl: a.posterUrl,
  duration: a.duration,
  published: a.published,
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
});

const runFfmpeg = (args: string[]) =>
  Bun.spawn(['ffmpeg', ...args], { stdout: 'ignore', stderr: 'ignore' }).exited;

const probeDuration = async (input: string): Promise<number> => {
  try {
    const proc = Bun.spawn(
      ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', input],
      { stdout: 'pipe', stderr: 'ignore' }
    );
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    return Math.round(parseFloat(out.trim()) || 0);
  } catch {
    return 0;
  }
};

const deleteMediaFiles = async (a: any) => {
  if (a.type === 'VIDEO') {
    // Entire per-asset directory (original, HLS segments, poster).
    const dir = path.join(uploadsDir('cms/videos'), a.id);
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    return;
  }
  await deleteUploadedFile(a.url);
  await deleteUploadedFile(a.posterUrl);
};

// Kick off ffmpeg transcoding in the background and flip the asset status.
async function processVideo(asset: any, dir: string, inputName: string) {
  const input = path.join(dir, inputName);
  try {
    const duration = await probeDuration(input);
    const [poster, hls] = await Promise.all([
      runFfmpeg(['-y', '-i', input, '-frames:v', '1', '-vf', "scale='min(720,iw)':-2", '-q:v', '4', path.join(dir, 'poster.jpg')]),
      runFfmpeg([
        '-y',
        '-i', input,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-vf', "scale='min(1280,iw)':-2",
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', path.join(dir, 'seg_%04d.ts'),
        path.join(dir, 'index.m3u8'),
      ]),
    ]);
    if (poster !== 0 || hls !== 0) throw new Error(`ffmpeg exited with code ${poster || hls}`);
    await Bun.file(input).unlink().catch(() => {});
    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        status: 'READY',
        url: `/uploads/cms/videos/${asset.id}/index.m3u8`,
        posterUrl: `/uploads/cms/videos/${asset.id}/poster.jpg`,
        duration,
      },
    });
  } catch (e) {
    console.error('[media] transcode failed', asset.id, (e as Error).message);
    await prisma.mediaAsset
      .update({ where: { id: asset.id }, data: { status: 'FAILED' } })
      .catch(() => {});
  }
}

export const publicMedia = new Elysia({ prefix: '/api' })
  .get('/media', async () => {
    const items = await prisma.mediaAsset.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
    });
    return { items: items.map(serialize) };
  });

export const adminMedia = new Elysia({ prefix: '/api/admin/media' })
  .use(jwtPlugin())
  .derive(async (ctx) => ({ user: await resolveUser(ctx) }))
  .get('/', async ({ user, set }) => {
    if (!isAdmin(user)) {
      set.status = 403;
      return { message: 'Forbidden' };
    }
    const items = await prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' } });
    return { items: items.map(serialize) };
  })
  .post(
    '/',
    async ({ body, user, set }) => {
      if (!isAdmin(user)) {
        set.status = 403;
        return { message: 'Forbidden' };
      }
      const file = body.file;
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        set.status = 422;
        return { message: 'File must be an image or video' };
      }

      const name = body.name?.trim() || file.name || 'Untitled';
      const type = isImage ? 'IMAGE' : 'VIDEO';

      if (isImage) {
        const id = crypto.randomUUID();
        const dir = uploadsDir(`cms/images`);
        const filePath = path.join(dir, `${id}${imageExt(file.type)}`);
        await Bun.write(filePath, file);
        const thumbPath = path.join(dir, `${id}-thumb.jpg`);
        const code = await runFfmpeg([
          '-y', '-i', filePath,
          '-vf', "scale='min(480,iw)':-2", '-q:v', '5', thumbPath,
        ]);
        const thumb = code === 0 ? `/uploads/cms/images/${id}-thumb.jpg` : `/uploads/cms/images/${id}${imageExt(file.type)}`;
        const asset = await prisma.mediaAsset.create({
          data: {
            type,
            name,
            description: body.description ?? null,
            mime: file.type,
            size: file.size,
            status: 'READY',
            url: `/uploads/cms/images/${id}${imageExt(file.type)}`,
            posterUrl: thumb,
            uploadedById: user!.id,
          },
        });
        return { asset: serialize(asset) };
      }

      // Video: store original, transcode to HLS in the background. Files live
      // under uploads/cms/videos/<assetId>/ so the DB urls and delete cleanup
      // always agree on the same directory name.
      const id = crypto.randomUUID();
      const asset = await prisma.mediaAsset.create({
        data: {
          id,
          type,
          name,
          description: body.description ?? null,
          mime: file.type,
          size: file.size,
          status: 'PROCESSING',
          url: `/uploads/cms/videos/${id}/index.m3u8`,
          uploadedById: user!.id,
        },
      });
      const dir = uploadsDir(`cms/videos/${id}`);
      await fs.mkdir(dir, { recursive: true });
      const inputName = `original${videoExt(file.type)}`;
      await Bun.write(path.join(dir, inputName), file);
      processVideo(asset, dir, inputName);
      return { asset: serialize(asset) };
    },
    {
      body: t.Object({
        file: t.File({ maxSize: 2 * 1024 * 1024 * 1024 }),
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
      }),
    }
  )
  .patch(
    '/:id',
    async ({ params, body, user, set }) => {
      if (!isAdmin(user)) {
        set.status = 403;
        return { message: 'Forbidden' };
      }
      const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
      if (!asset) {
        set.status = 404;
        return { message: 'Not found' };
      }
      const data: any = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.published !== undefined) data.published = body.published;
      const updated = await prisma.mediaAsset.update({ where: { id: asset.id }, data });
      return { asset: serialize(updated) };
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.Nullable(t.String())),
        published: t.Optional(t.Boolean()),
      }),
    }
  )
  .delete('/:id', async ({ params, user, set }) => {
    if (!isAdmin(user)) {
      set.status = 403;
      return { message: 'Forbidden' };
    }
    const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
    if (!asset) {
      set.status = 404;
      return { message: 'Not found' };
    }
    await deleteMediaFiles(asset);
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
    return { ok: true };
  });