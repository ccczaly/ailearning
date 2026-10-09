import { reactive } from 'vue';
import { api, ApiError, clearCsrf, refreshCsrf } from './api';
export interface User { id: number; username: string; displayName: string; roles: string[] }
export const auth = reactive<{ user: User | null; ready: boolean }>({ user: null, ready: false });
window.addEventListener('auth-expired', () => { auth.user = null; clearCsrf(); });
export async function restore() {
  try { auth.user = await api<User>('/me', {}, auth.ready); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    auth.user = null;
  }
  auth.ready = true;
}
export async function login(username: string, password: string) {
  await refreshCsrf();
  await api('/auth/login', { method: 'POST', body: new URLSearchParams({ username, password }) }, false);
  clearCsrf();
  await restore();
}
export async function logout() {
  await refreshCsrf();
  await api('/auth/logout', { method: 'POST' });
  auth.user = null;
  clearCsrf();
}
export async function register(username: string, password: string) {
  await api('/auth/register', { method: 'POST', body: new URLSearchParams({ username, password }) }, false);
}
