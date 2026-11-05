import { rpc, fail } from '../lib/server.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const token = req.body?.token;
  if (typeof token !== 'string' || !/^[A-Za-z0-9]{6,32}$/.test(token)) return res.status(200).json({ ok: false });
  try {
    const [row] = await rpc('record_scan_by_token', { p_token: token });
    if (!row) return res.status(200).json({ ok: false });
    return res.status(200).json({ ok: true, ticket: row.ticket, status: row.status, scans: row.scans, at: row.scanned_at });
  } catch (err) {
    return fail(res, err);
  }
}
