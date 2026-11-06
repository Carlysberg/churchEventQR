// Usage: npm run qr
// To use a different site address: npm run qr -- https://your-domain.example
// Makes one QR code per ticket, plus a printable sheet, in qr-codes/.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { encode, toPng, toSvg } from '../lib/qr.mjs';

const base = (process.argv[2] || 'https://churcheventqr.vercel.app').replace(/\/+$/, '');
if (!/^https:\/\/[^\s/]+$/.test(base)) {
  console.error('The site address must look like https://churcheventqr.vercel.app');
  process.exit(1);
}
const rows = readFileSync('data/tickets.csv', 'utf8').trim().split(/\r?\n/).slice(1).map((l) => l.split(','));
mkdirSync('qr-codes/png', { recursive: true });
mkdirSync('qr-codes/svg', { recursive: true });

const links = [['ticket', 'link']];
let sheet = '';
for (const [ticket, token] of rows) {
  const link = `${base}/t/${token}`;
  const m = encode(link);
  writeFileSync(`qr-codes/png/ticket-${ticket}.png`, toPng(m));
  writeFileSync(`qr-codes/svg/ticket-${ticket}.svg`, toSvg(m));
  links.push([ticket, link]);
  sheet += `<figure>${toSvg(m)}<figcaption><b>Ticket ${ticket}</b><br>${link}</figcaption></figure>`;
}
writeFileSync('qr-codes/links.csv', links.map((r) => r.join(',')).join('\n') + '\n');
writeFileSync('qr-codes/print-sheet.html', `<!doctype html><meta charset="utf-8"><title>Youth Dinner ticket QR codes</title>
<style>body{font-family:Arial,sans-serif;margin:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}figure{margin:0;break-inside:avoid;text-align:center}figcaption{font-size:9px;word-break:break-all}figcaption b{font-size:12px}</style>${sheet}`);

const test = rows.length ? readFileSync('data/test-token.txt', 'utf8').trim() : '';
writeFileSync('data/test-link.txt', `${base}/t/${test}\n`);
console.log(`Made ${rows.length} QR codes for ${base} in qr-codes/`);
