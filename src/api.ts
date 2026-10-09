type Csrf = { headerName: string; token: string };
let csrf: Csrf | undefined;
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}
export function clearCsrf() { csrf = undefined; }
export async function refreshCsrf() {
  const response = await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new ApiError(response.status, 'CSRF_UNAVAILABLE');
  csrf = await response.json() as Csrf;
  return csrf;
}
export async function api<T>(path: string, options: RequestInit = {}, notifyExpiry = true): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) {
    const token = csrf ?? await refreshCsrf();
    headers.set(token.headerName, token.token);
  }
  const response = await fetch(`/api${path}`, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (data.code === 'CSRF_INVALID') clearCsrf();
    if (response.status === 401 && notifyExpiry) window.dispatchEvent(new Event('auth-expired'));
    throw new ApiError(response.status, data.code ?? 'REQUEST_FAILED');
  }
  return response.status === 204 ? undefined as T : await response.json() as T;
}
