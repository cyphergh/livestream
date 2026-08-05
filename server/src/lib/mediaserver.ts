import { config } from '../config';

const base = config.MEDIAMTX_API;
const key = config.MEDIAMTX_API_KEY;

async function req(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MediaMTX ${init.method ?? 'GET'} ${path} => ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export interface MediaPath {
  name: string;
  sourceType?: string;
  ready: boolean;
  codecs?: string[];
  protocols?: string[];
  bytesReceived?: number;
  bytesSent?: number;
  readers?: number;
}

export const mediaServer = {
  listPaths(): Promise<{ items: MediaPath[] }> {
    return req('/v3/paths/list');
  },

  getPath(name: string): Promise<MediaPath> {
    return req(`/v3/paths/get/${encodeURIComponent(name)}`);
  },

  /** Add a static path (used for pull sources). Disabled = forwarded to external auth. */
  addPath(name: string, body: Record<string, unknown> = {}) {
    return req(`/v3/paths/add/${encodeURIComponent(name)}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  patchPath(name: string, body: Record<string, unknown>) {
    return req(`/v3/paths/patch/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deletePath(name: string) {
    return req(`/v3/paths/delete/${encodeURIComponent(name)}`, { method: 'DELETE' });
  },

  /** Whether MediaMTX reports the path as live (a publisher is connected). */
  async isLive(name: string): Promise<boolean> {
    try {
      const p = await this.getPath(name);
      return Boolean(p.ready);
    } catch {
      return false;
    }
  },
};

/** MediaMTX HLS playback URL for a given path. */
export function hlsUrl(path: string): string {
  return `${config.MEDIAMTX_HLS_URL}/${encodeURIComponent(path)}/index.m3u8`;
}

/** MediaMTX WHEP read URL for a given path. */
export function whepUrl(path: string): string {
  return `${config.MEDIAMTX_WHEP_URL}/${encodeURIComponent(path)}/whep`;
}

/** WHIP publish URL (unauthenticated in front of MediaMTX; gateway enforces). */
export function whipUrl(path: string): string {
  return `${config.PUBLIC_URL}/api/media/whip/${encodeURIComponent(path)}`;
}