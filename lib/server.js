import { createHash, timingSafeEqual } from 'node:crypto';

export async function rpc(name, args = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not set');
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Supabase ${name} failed with status ${res.status}`);
  return res.json();
}

const digest = (value) => createHash('sha256').update(String(value)).digest();

export function isDoorStaff(req) {
  const expected = process.env.DOOR_KEY;
  if (!expected) return false;
  return timingSafeEqual(digest(req.headers['x-door-key'] ?? ''), digest(expected));
}

export function fail(res, err) {
  console.error(err);
  res.status(500).json({ error: 'server_error' });
}
