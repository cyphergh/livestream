import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { http } from '../../../lib/api';
import type { MediaAsset } from '../../../types';

interface PendingUpload {
  id: string;
  name: string;
  progress: number;
  state: 'uploading' | 'uploaded' | 'error';
  error?: string;
}

const fmtDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Upload with real progress reporting via XHR (multipart to the CMS endpoint).
function uploadFile(
  file: File,
  onProgress: (p: number) => void
): Promise<{ asset: MediaAsset }> {
  const form = new FormData();
  form.append('file', file);
  form.append('name', file.name.replace(/\.[^.]+$/, ''));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/media');
    const token = useAuthStore.getState().accessToken;
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as { asset: MediaAsset });
      } else {
        let msg = 'Upload failed';
        try {
          msg = (JSON.parse(xhr.responseText) as { message?: string }).message ?? msg;
        } catch {
          /* ignore */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
}

type AssetPatch = { name?: string; description?: string | null; published?: boolean };

export default function MediaLibrary() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [pends, setPends] = useState<PendingUpload[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(
    () => http.get<{ items: MediaAsset[] }>('/admin/media').then((d) => setAssets(d.items)),
    []
  );

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // While any asset is still processing, poll until everything is READY/FAILED.
  useEffect(() => {
    const hasProcessing = assets.some((a) => a.status === 'PROCESSING');
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (hasProcessing) {
      pollRef.current = setInterval(() => {
        refresh().catch(() => {});
      }, 2500);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [assets, refresh]);

  const pushFiles = (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    for (const file of list) {
      const pend: PendingUpload = { id: crypto.randomUUID(), name: file.name, progress: 0, state: 'uploading' };
      setPends((p) => [...p, pend]);
      uploadFile(file, (p) => {
        setPends((prev) => prev.map((x) => (x.id === pend.id ? { ...x, progress: p } : x)));
      })
        .then(() => {
          setPends((prev) => prev.map((x) => (x.id === pend.id ? { ...x, state: 'uploaded' } : x)));
          refresh().catch(() => {});
        })
        .catch((e: Error) => {
          setPends((prev) =>
            prev.map((x) => (x.id === pend.id ? { ...x, state: 'error', error: e.message } : x))
          );
        });
    }
  };

  const patch = async (id: string, data: AssetPatch) => {
    try {
      const res = await http.patch<{ asset: MediaAsset }>(`/admin/media/${id}`, data);
      setAssets((prev) => prev.map((a) => (a.id === id ? res.asset : a)));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const remove = async (a: MediaAsset) => {
    if (!window.confirm(`Delete "${a.name}"? This permanently removes the file.`)) return;
    try {
      await http.del(`/admin/media/${a.id}`);
      setAssets((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const busyUploads = pends.filter((p) => p.state === 'uploading').length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand-400">Media library</p>
          <h2 className="mt-1 text-2xl font-bold text-white">Images & videos</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Upload photos and sermons. Videos are transcoded to HLS automatically; toggle{' '}
            <span className="font-medium text-zinc-300">publish</span> to surface them on the landing page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:brightness-110"
        >
          + Upload media
        </button>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pushFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`mb-8 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
          dragOver
            ? 'border-brand-500 bg-brand-500/10'
            : 'border-zinc-700 bg-zinc-900/50 hover:border-brand-600/50 hover:bg-zinc-900'
        }`}
      >
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-400 text-xl text-white">
          ⤴
        </div>
        <p className="font-medium text-white">Drop media here or click to browse</p>
        <p className="mt-1 text-xs text-zinc-500">Images (jpg, png, webp, gif) · Videos (mp4, webm, mov, mkv) up to 2 GB</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) pushFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Pending uploads */}
      {pends.length > 0 && (
        <div className="mb-8 space-y-2">
          {pends.map((p) => (
            <div key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="truncate font-medium text-zinc-200">{p.name}</span>
                <span className="text-xs text-zinc-500">
                  {p.state === 'uploading' ? `${Math.round(p.progress * 100)}%` : p.state === 'error' ? 'Failed' : 'Uploaded'}
                </span>
              </div>
              {p.state === 'uploading' ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400 transition-all"
                    style={{ width: `${Math.round(p.progress * 100)}%` }}
                  />
                </div>
              ) : (
                <p className="text-xs text-zinc-500">{p.error ?? 'Queued for processing; transcoding videos may take a minute.'}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Assets grid */}
      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : assets.length === 0 && busyUploads === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-12 text-center text-zinc-400">
          No media yet. Upload your first image or sermon video above.
        </div>
      ) : (
        <div>
          {assets.some((a) => a.status === 'PROCESSING') && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2.5 text-sm text-cyan-200">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
              Transcoding in progress — video cards will update automatically.
            </div>
          )}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((a) => (
              <AssetCard key={a.id} asset={a} onPatch={(d) => patch(a.id, d)} onDelete={() => remove(a)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AssetCard({
  asset,
  onPatch,
  onDelete,
}: {
  asset: MediaAsset;
  onPatch: (d: AssetPatch) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(asset.name);
  const [description, setDescription] = useState(asset.description ?? '');

  const thumb = asset.posterUrl ?? asset.url;

  return (
    <div
      className={`group overflow-hidden rounded-2xl border bg-zinc-900/70 shadow-lg shadow-black/20 transition hover:shadow-xl ${
        asset.status === 'FAILED' ? 'border-red-500/40' : asset.status === 'PROCESSING' ? 'border-cyan-500/30' : 'border-zinc-800'
      }`}
    >
      <div className="relative aspect-video overflow-hidden bg-zinc-800">
        {asset.status === 'PROCESSING' ? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950">
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400/60 border-t-transparent" />
              <span className="text-xs">Transcoding…</span>
            </div>
          </div>
        ) : asset.status === 'FAILED' ? (
          <div className="flex h-full w-full items-center justify-center bg-red-950/40 text-sm text-red-300">
            Processing failed
          </div>
        ) : thumb ? (
          <img src={thumb} alt={asset.name} className="h-full w-full object-cover" />
        ) : null}
        <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {asset.type === 'VIDEO' ? 'Video' : 'Image'}
        </span>
        {asset.type === 'VIDEO' && asset.duration != null && asset.duration > 0 && (
          <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {fmtDuration(asset.duration)}
          </span>
        )}
      </div>

      <div className="space-y-2 p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== asset.name && onPatch({ name })}
          placeholder="Untitled"
          className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-white focus:border-zinc-700 focus:bg-zinc-800"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (asset.description ?? '') && onPatch({ description: description || null })}
          placeholder="Add a description…"
          className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs text-zinc-400 placeholder-zinc-600 focus:border-zinc-700 focus:bg-zinc-800"
        />
        <div className="flex items-center justify-between pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
            <button
              type="button"
              role="switch"
              aria-checked={asset.published}
              onClick={() => onPatch({ published: !asset.published })}
              className={`relative h-5 w-9 rounded-full transition-colors ${asset.published ? 'bg-emerald-500' : 'bg-zinc-700'}`}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                style={{ left: asset.published ? 'calc(100% - 18px)' : '2px' }}
              />
            </button>
            {asset.published ? 'Published' : 'Draft'}
          </label>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/30"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}