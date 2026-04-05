import { API_BASE_URL } from './api';

export async function mobileLogin(email: string, password: string) {
  // 1. Fetch CSRF token (NextAuth requirement)
  const csrfRes = await fetch(`${API_BASE_URL}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;

  if (!csrfToken) throw new Error('Failed to obtain CSRF token');

  // 2. Post credentials
  const loginRes = await fetch(`${API_BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      csrfToken,
      email,
      password,
      json: true,
      redirect: false
    }),
  });

  const loginData = await loginRes.json();
  if (!loginData.url || loginData.error) {
    throw new Error(loginData.error || 'Authentication failed');
  }

  // 3. Fetch Session
  const sessionRes = await fetch(`${API_BASE_URL}/api/auth/session`);
  return await sessionRes.json();
}

export async function getMobileSession() {
  const sessionRes = await fetch(`${API_BASE_URL}/api/auth/session`);
  const data = await sessionRes.json();
  return Object.keys(data).length > 0 ? data : null;
}
