// A ticket's QR link opened by anything other than the door scanner goes to the venue map.
// Nothing is recorded here: only the scanner on the door page can record a scan.
const LOCATION = 'https://www.google.com/maps/place/Kosayo+Green+Hotel/@6.8426,-1.397692,17z/data=!4m6!3m5!1s0xfdbc4859fb1ca51:0x3a7630863312c820!8m2!3d6.8426!4d-1.397692!16s%2Fg%2F11b6_v8wy5?entry=ttu&g_ep=EgoyMDI2MTEwMy4wIKXMDSoASAFQAw%3D%3D';

export default function handler(req, res) {
  res.writeHead(302, { Location: LOCATION, 'Cache-Control': 'no-store' });
  res.end();
}
