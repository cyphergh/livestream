import path from 'path';

// Uploads live under server/uploads (gitignored). import.meta.dir is
// server/src/lib, so the root resolves to server/uploads.
export const uploadsRoot = path.join(import.meta.dir, '../../uploads');

// Resolve a subdirectory under the uploads root (created on demand).
export function uploadsDir(sub: string): string {
  return path.join(uploadsRoot, sub);
}

// Remove an uploaded file referenced by a public URL (e.g. "/uploads/logos/x.png").
// Safe no-op for external URLs, missing files, or null/empty values.
export async function deleteUploadedFile(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith('/uploads/')) return;
  const rel = url.slice('/uploads/'.length);
  if (!rel || rel.includes('..')) return;
  const target = path.join(uploadsRoot, rel);
  const f = Bun.file(target);
  try {
    if (await f.exists()) await f.unlink();
  } catch {
    /* ignore missing/permission errors */
  }
}