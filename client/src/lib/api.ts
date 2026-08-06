import { useAuthStore } from '../stores/authStore';

const API = '/api';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { getState } = useAuthStore;
  const accessToken = getState().accessToken;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API}${path}`, { ...options, headers, credentials: 'include' });

  if (res.status === 401) {
    // Try silent refresh once, then retry.
    const ok = await getState().refresh();
    if (ok) return apiFetch<T>(path, options);
    getState().logout();
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data?.message ?? `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export const http = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
  // Multipart file upload (do NOT set Content-Type; the browser adds the boundary).
  upload: async <T>(path: string, file: File) => {
    const accessToken = useAuthStore.getState().accessToken;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      body: form,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      credentials: 'include',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ApiError(res.status, data?.message ?? `Upload failed (${res.status})`);
    }
    return res.json() as Promise<T>;
  },
};