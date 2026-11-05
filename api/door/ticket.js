import { rpc, isDoorStaff, fail } from '../../lib/server.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!isDoorStaff(req)) return res.status(401).json({ error: 'unauthorized' });
  const { ticket, action } = req.body ?? {};
  if (typeof ticket !== 'string' || !['scan', 'reset'].includes(action)) return res.status(400).json({ error: 'bad_request' });
  const args = { p_ticket: ticket, p_door_key: process.env.DOOR_KEY };
  try {
    if (action === 'reset') {
      const [row] = await rpc('reset_ticket', args);
      return res.status(200).json({ ok: Boolean(row), ticket });
    }
    const [row] = await rpc('record_scan_by_number', args);
    if (!row) return res.status(200).json({ ok: false, ticket });
    return res.status(200).json({ ok: true, ticket: row.ticket, status: row.status, scans: row.scans, at: row.scanned_at });
  } catch (err) {
    return fail(res, err);
  }
}
