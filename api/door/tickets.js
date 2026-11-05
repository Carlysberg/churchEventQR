import { rpc, isDoorStaff, fail } from '../../lib/server.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (!isDoorStaff(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    return res.status(200).json(await rpc('list_tickets', { p_door_key: process.env.DOOR_KEY }));
  } catch (err) {
    return fail(res, err);
  }
}
