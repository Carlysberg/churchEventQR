# Youth Dinner ticket check-in

The first scan of a ticket shows **CONFIRMED**. The second and every later scan show **SEATED**. Any other code shows **INVALID**.

Hosted on Vercel, with scans stored in Supabase. There are no packages to install.

| Page | Address | Who uses it |
| --- | --- | --- |
| Scan result | `/t/<ticket code>` | Opens when a ticket QR code is scanned |
| Door check-in | `/door` | Door staff, with the door key: live counts, search, record a scan by number, reset a ticket |

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

The publishable key can't read the tickets table. It can only call the functions in `schema.sql`, and those need either a ticket code or the door key.

**Moving an existing project from the secret key:** run `supabase/schema.sql` again (not `seed.sql`, your tickets stay as they are), then do steps 3 and 4. Deploy the new code straight after, because the old code stops working once the schema changes.

### 2. Vercel

1. Upload this folder to a private GitHub repository and import it into Vercel, or run `vercel` from this folder.
2. Name the project `youth-dinner-2026`. The supplied QR codes point to `https://youth-dinner-2026.vercel.app`.
3. Add these environment variables (see `.env.example`), then redeploy:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `DOOR_KEY`: the door key you saved in Supabase. If the two values differ, the door page says "Could not refresh. Check the connection." To change the key, update both.

### 3. Check the address before printing

If your live address is not exactly `https://youth-dinner-2026.vercel.app`, for example because the name was taken or you use your own domain, remake the codes with Node 18 or newer:

```bash
npm run qr -- https://your-real-address
```

This replaces everything in `qr-codes/`. Decide on the final address before printing, because printed codes cannot be changed.

### 4. Test

1. Open the link in `data/test-link.txt`. It should show CONFIRMED, then SEATED when you open it again. The TEST ticket isn't included in the door counts.
2. Open `/door`, enter your door key, and confirm that it shows 100 tickets.
3. To reuse the test link, enter `TEST` on the door page and press **Reset**.
4. Print one real ticket and scan it with several phones. Then press **Reset** on the door page for that ticket number.

## Good to know

- **Any scan counts.** A guest scanning their own ticket uses up CONFIRMED. Refreshing the result page also counts as a scan. Door staff can reset a ticket.
- **Link previews don't count.** A scan is recorded only when the page runs in a browser, so previews from chat apps don't use up a ticket.
- **Keep the codes private.** `data/`, `qr-codes/` and `supabase/seed.sql` contain the ticket codes. They are listed in `.gitignore`, so keep them out of your repository.
- **Supabase free plan.** Free projects can pause after a period of inactivity. Check that yours is active the day before the event.
