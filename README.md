# Youth Dinner ticket check-in

Door staff scan tickets with the camera on the door page. The first scan of a ticket shows **CONFIRMED**. The second and every later scan show **SEATED**. Any other code shows **INVALID**.

Scanning a ticket with anything else, such as a phone's camera app, opens the venue on Google Maps and records nothing.

Hosted on Vercel, with scans stored in Supabase. There are no packages to install. The scanner uses [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0), included in `public/vendor/`.

| Page | Address | Who uses it |
| --- | --- | --- |
| Door check-in | `/door` | Door staff, with the door key: camera scanner, live counts, search, record a scan by number, reset a ticket |
| Venue map | `/t/<ticket code>` | Anyone who scans a ticket outside the door page. Redirects to Google Maps |

## Set up

### 1. Supabase

1. Create a project at supabase.com.
2. In **SQL Editor**, run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Choose a long door key for door staff and save it in the database. Use the same value for `DOOR_KEY` in Vercel:

   ```sql
   insert into private.door_key (key_hash)
   values (sha256(convert_to('your-door-key', 'UTF8')))
   on conflict (id) do update set key_hash = excluded.key_hash;
   ```

4. Copy these from the project's settings:
   - the project URL
   - the **publishable** key (starts with `sb_publishable_`)

The publishable key can't read the tickets table. It can only call the functions in `schema.sql`, and those all need the door key.

**Moving an existing project from the secret key:** run `supabase/schema.sql` again (not `seed.sql`, your tickets stay as they are), then do steps 3 and 4. Deploy the new code straight after, because the old code stops working once the schema changes.

### 2. Vercel

1. Upload this folder to a private GitHub repository and import it into Vercel, or run `vercel` from this folder.
2. The site lives at `https://churcheventqr.vercel.app`, and the QR codes point there. Keep this Vercel project name.
3. Add these environment variables (see `.env.example`), then redeploy:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `DOOR_KEY`: the door key you saved in Supabase. If the two values differ, the door page says "Could not refresh. Check the connection." To change the key, update both.

### 3. Make the QR codes

With Node 18 or newer, make the codes for `https://churcheventqr.vercel.app`. The ticket codes stay the same each time:

```bash
npm run qr
```

To use a different address, such as your own domain, run `npm run qr -- https://your-real-address`. This replaces everything in `qr-codes/`. Decide on the final address before printing, because printed codes cannot be changed.

### 4. Test

1. Open `/door` on a phone, enter your door key, and confirm that it shows 100 tickets.
2. Press **Scan ticket**, allow the camera, and scan `qr-codes/test-ticket.png` on another screen. It should show CONFIRMED, then SEATED when you press **Scan next** and scan it again. Wait about 4 seconds between scans of the same code. The TEST ticket isn't included in the door counts.
3. To reuse the test code, enter `TEST` on the door page and press **Reset**.
4. Scan the same code with a phone's normal camera app. It should open the venue on Google Maps and record nothing.
5. Print one real ticket and scan it on the door page with each phone staff will use. Then press **Reset** for that ticket number.

## Good to know

- **Only the door page records scans.** Guests scanning their own tickets, and link previews from chat apps, don't use up a ticket. Door staff can reset a ticket scanned by mistake.
- **The scanner needs the camera and a connection.** If a phone's camera won't open, allow camera access for the site in the browser settings, or enter the ticket number and press **Record scan**.
- **Keep the codes private.** `data/`, `qr-codes/` and `supabase/seed.sql` contain the ticket codes. They are listed in `.gitignore`, so keep them out of your repository.
- **Supabase free plan.** Free projects can pause after a period of inactivity. Check that yours is active the day before the event.
