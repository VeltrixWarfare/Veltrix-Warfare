# VELTRIX ACADEMY LMS — deployment notes

## Included
- Admin-managed courses, chapters, lessons, drafts, publishing and archiving.
- Lesson text editor and private file uploads (up to 25 MB per file).
- Member read access restricted to published content and active memberships.
- Supabase Row Level Security policies for all Academy tables and Storage.
- Realtime refresh when Academy content changes.

## Required one-time Supabase step
1. Open the Supabase project used by this Vercel deployment.
2. Open **SQL Editor**.
3. Run the complete file `supabase/migrations/202611010001_academy_lms.sql`.
4. Confirm the signed-in administrator already has `profiles.role = 'admin'`.
   The project already uses `public.is_admin()` for the admin panel. If the account is not an admin, promote only the intended account from the Supabase SQL Editor, replacing the email:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('YOUR-ADMIN-EMAIL@example.com');
```

5. Confirm Vercel has the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables. Do not add a service-role key to the frontend.
6. Deploy the project.

## Using Academy
- Admin: open Academy, choose **New course**, then add chapters and lessons.
- New items save as **draft**. Use the check/publish action to publish them.
- Upload attachments from inside a lesson.
- Use the status filters to find published, draft, and archived courses.
- Deleting a course/chapter/lesson asks for confirmation and removes associated Academy files from private Storage first.
- Members need an active membership and can only read published courses, chapters, lessons, and their attachments.

## Security
Admin actions are protected by database RLS policies that call the existing `public.is_admin()` function. Frontend visibility is not the security boundary. Academy file storage is private; downloads use short-lived signed URLs. Never expose a Supabase service-role key in client-side code.
