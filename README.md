# Fili-QuizMo

Fili-QuizMo is a responsive quiz platform website built with Next.js, React, and Tailwind CSS. Admin, teacher, and student access use live Supabase membership tables; admin access also requires TOTP multi-factor authentication. Dashboard summary cards, recent activity, and score charts read live Supabase data. The search lists use demo rows in development and the Supabase search views in production.

## Getting Started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Production Build

```bash
npm run build
npm start
```

The project is built with Webpack because the Turbopack native bindings are unavailable in the current Windows environment.

## Routes

| Route                | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `/`                  | Home page with app overview, carousel, and team      |
| `/about`             | About Us                                             |
| `/about-app`         | About the App with the APK download                  |
| `/signup`            | Student or pending-teacher account sign-up           |
| `/complete-profile`  | One-time username setup for confirmed accounts       |
| `/login`             | Shared login chooser                                 |
| `/student-login`     | Student login                                        |
| `/teacher-login`     | Teacher login                                        |
| `/admin-login`       | Admin login with TOTP multi-factor authentication    |
| `/change-password`   | Authenticated password change                        |
| `/student-dashboard` | Student profile and personal quiz history            |
| `/teacher-dashboard` | Teacher dashboard with quizzes, students, and scores |
| `/admin-dashboard`   | Admin dashboard for quizzes and teacher management   |
| `/api/search`        | Authenticated, role-scoped dashboard search          |
| `/api/export`        | Authenticated, role-scoped CSV and Excel exports     |
| `/api/admin/teachers/status` | Admin-only teacher approval mutation        |

## Supabase authentication setup

1. Create a Supabase project and copy its project URL and publishable key into `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   Set `NEXT_PUBLIC_SITE_URL` to the deployed app origin in production; it is used for auth redirects and social metadata images. In the Supabase dashboard, set the Auth Site URL to the same origin and add `/auth/confirm` and `/change-password` to the allowed redirect URLs.

2. Role membership lives in the live database, not in user-editable metadata:

   - `admins.user_id` grants admin access.
   - `teachers.user_id` with `teachers.status = 'approved'` grants teacher access.
   - `account_profiles.user_id` with `role = 'student'` grants student access.

3. Public sign-up creates only a student profile. Teacher sign-up is allowed but creates a `teachers` row with `status = 'pending'`; an admin must approve it before the teacher can sign in. Admin rows are never created by public sign-up. Provision admins through a trusted server-side process.

4. Email confirmation is required before a new account can sign in. `/auth/confirm` exchanges the confirmation link for a session and sends the user to `/complete-profile` when a username is still missing.

5. On an admin's first password sign-in, the admin is prompted to enroll an authenticator app and verify its current TOTP code. Subsequent admin sign-ins require that code. The `/admin-dashboard` server route independently verifies the authenticated user, admin membership, active state, and AAL2 before rendering.

6. The `/teacher-dashboard` and `/student-dashboard` server routes independently verify membership and active state. The proxy refreshes Supabase cookies but is not the authorization boundary.

7. Keep database access protected with Row Level Security. Admin policies use `is_admin()`; teacher policies use `current_teacher_id()` and `owns_quiz()`. Route protection does not replace database authorization.

The Supabase anon/publishable key is intended for browser use and does not bypass Row Level Security. Never expose a Supabase service-role/secret key in a `NEXT_PUBLIC_*` variable or client-side code.

## Session cleanup

Dashboard logout revokes the Supabase session globally, clears form controls and browser storage/cache data, aborts registered dashboard requests, and replaces the current history entry with the role's login page. Logout is broadcast to other tabs; protected pages are marked `private, no-store`, and pages restored from the back-forward cache after a session change are reloaded through the server-side access checks. The browser boundary also handles Supabase `SIGNED_OUT` events and API `401` responses.

## Dashboard search and filters

The reusable dashboard search UI calls `GET /api/search`. The server derives the user's role and teacher ID from the authenticated Supabase session and membership tables; callers cannot select a role or teacher scope.

Example:

```http
GET /api/search?entity=participants&q=maria&status=completed&session=FMBFE4&from=2026-09-01&to=2026-10-01&sort=date&dir=desc&page=1&pageSize=20
```

Supported query fields are `entity` (`students`, `quizzes`, `participants`, or admin-only `teachers`), `q`, `status`, admin-only `teacher` username, participant `quiz` and `session` (share code), `from`, `to`, `sort` (`name`, `date`, or `status` when the entity supports it), `dir`, `page`, and `pageSize` (capped at 100). The response contains `items`, server-side `pagination`, and role/scope metadata. Errors use `{ "error": { "code": "...", "message": "..." } }`. Search/filter/sort/page state is reflected in the dashboard URL. Passwords are never searched or returned.

Example success response:

```json
{
  "items": [
    {
      "entity": "participants",
      "id": "participant-id",
      "username": "maria.santos",
      "status": "completed",
      "score": 92,
      "quizId": "quiz-id",
      "quizTitle": "Science Fundamentals",
      "sessionId": "session-id",
      "sessionCode": "FMBFE4",
      "studentEmail": "maria@example.test",
      "teacherId": "teacher-id",
      "teacherUsername": "msantos",
      "joinedAt": "2026-09-10T09:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 },
  "meta": {
    "entity": "participants",
    "role": "teacher",
    "scope": "own-records",
    "dataSource": "supabase",
    "filters": {
      "q": "maria",
      "status": "completed",
      "teacher": "",
      "quiz": "",
      "session": "FMBFE4",
      "from": "2026-09-01",
      "to": "2026-10-01"
    },
    "sort": "date",
    "dir": "desc",
    "searchableFields": [
      "Participant username",
      "Participant status",
      "Quiz title",
      "Session code",
      "Email"
    ]
  }
}
```

For local development, the endpoint defaults to deterministic mock data; use `SEARCH_DATA_SOURCE=mock` or `SEARCH_DATA_SOURCE=supabase` to choose explicitly. Production defaults to Supabase. Apply `supabase/migrations/202610290001_search_views_and_indexes.sql` before enabling the Supabase source. The migration builds four `security_invoker` views on the live schema: `search_students` from `account_profiles` joined to managing teachers, `search_quizzes` from `quizzes`, `search_participants` from the `students` roster with the latest attempt/result, and `search_teachers` from `teachers`. The views expose only the columns listed in `src/lib/search/config.ts`. The API applies a trusted teacher scope before all user filters; participant rows are scoped by the quiz owner (`quizzes.teacher_id`), so another teacher's rows are not exposed.

The migration adds B-tree indexes for teacher/status/date/join columns and `pg_trgm` GIN indexes for substring-matched text columns. Trigram indexes support the `%term%` `ILIKE` searches without requiring a separate full-text search language configuration. Password columns are intentionally absent from views and indexes. `supabase/migrations/202611030001_guard_teacher_status.sql` optionally closes a pre-existing RLS gap that lets a teacher update their own `teachers.status`; apply it with the search migration or replace it with an equivalent policy change.

To add a filter field, add its key to `SearchFilterKey`, define role/entity visibility in `FILTER_DEFINITIONS`, expose the field in the corresponding `entityConfigs` view/select/filter configuration, parse and validate it in `validation.ts`, apply it in `query-builder.ts`, then add its control/chip in `SearchFilter` and any required view/index changes to a migration. Add query-builder and role-scope tests for the new field.

## Dashboard exports

Teachers and admins can export the available dashboard datasets as Excel (`.xlsx`) or CSV. Exports use the authenticated session, the same role scope and applicable filters as dashboard search, and the Supabase search views protected by the existing grants and RLS policies.

```http
GET /api/export?entity=participants&format=xlsx&q=maria&status=completed
GET /api/export?entity=participants&format=csv&q=maria&status=completed
```

Exports include all matching rows, not just the current dashboard page, and are streamed in batches. A single export is capped at 100,000 rows; narrow the filters if a dataset exceeds that limit. CSV output includes a UTF-8 BOM, escaped cells, and protection against spreadsheet formula injection.

## Notes

- Both login forms use Supabase Auth. Public sign-up creates student profiles or pending teacher accounts; admin access is provisioned in the `admins` table. Dashboard summary cards, recent activity, and score charts read the live tables allowed by RLS.
- The Android package is available at `public/assets/Fili-QuizMo-1.0.0.apk`.
- The app favicon is generated from `Fili-QuizMo Logo.png`.
