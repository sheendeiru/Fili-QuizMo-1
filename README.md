# Fili-QuizMo

Fili-QuizMo is a responsive quiz platform website built with Next.js, React, and Tailwind CSS. Admin and teacher authentication use separate Supabase roles; admin access also requires TOTP multi-factor authentication. Dashboard summary cards and charts remain demo data; the search lists use demo rows in development and the Supabase search views in production.

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
| `/signup`            | Account sign-up with school ID                       |
| `/teacher-login`     | Teacher login                                        |
| `/admin-login`       | Admin login                                          |
| `/teacher-dashboard` | Teacher dashboard with quizzes, students, and scores |
| `/admin-dashboard`   | Admin dashboard for quizzes and teacher management   |
| `/api/export`       | Authenticated, role-scoped CSV and Excel exports     |

## Supabase authentication setup

1. Create a Supabase project and copy its project URL and publishable key into `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   Set `NEXT_PUBLIC_SITE_URL` to the deployed app origin in production; it is used to resolve social metadata images.

2. Create admin and teacher users through Supabase Auth or another trusted provisioning process. Set each user's trusted `app_metadata.role` to exactly `admin` or `teacher`, respectively. The admin login rejects teacher accounts, and the teacher login rejects admin accounts. Role values in user-editable `user_metadata` are not used for authorization.
3. Do not allow public sign-up to assign roles. Only a trusted administrator or server-side process should set `app_metadata.role`; never expose a Supabase service-role/secret key in browser code.
4. On an admin's first password sign-in, the admin is prompted to enroll an authenticator app and verify its current TOTP code. Subsequent admin sign-ins require that code. The `/admin-dashboard` server route independently verifies the authenticated user, `admin` role, and AAL2 before rendering.
5. The `/teacher-dashboard` server route independently verifies the authenticated user and `teacher` role. Both dashboard routes enforce authorization on the server; the proxy refreshes Supabase cookies but is not the authorization boundary.
6. Keep database access protected with Row Level Security. Policies for admin-only data should validate trusted admin metadata and `auth.jwt()->>'aal' = 'aal2'`; teacher policies should validate the trusted teacher role. Route protection does not replace database authorization.

The Supabase anon/publishable key is intended for browser use and does not bypass Row Level Security. Never expose a Supabase service-role/secret key in a `NEXT_PUBLIC_*` variable or client-side code.

## Session cleanup

Dashboard logout revokes the Supabase session globally, clears form controls and browser storage/cache data, aborts registered dashboard requests, and replaces the current history entry with the role's login page. Logout is broadcast to other tabs; protected pages are marked `private, no-store`, and pages restored from the back-forward cache after a session change are reloaded through the server-side access checks. The browser boundary also handles Supabase `SIGNED_OUT` events and API `401` responses.

## Dashboard search and filters

The reusable dashboard search UI calls `GET /api/search`. The server derives the user's role and teacher ID from the authenticated Supabase session and membership tables; callers cannot select a role or teacher scope.

Example:

```http
GET /api/search?entity=participants&q=maria&status=completed&session=SESS-1042&from=2026-09-01&to=2026-10-01&sort=date&dir=desc&page=1&pageSize=20
```

Supported query fields are `entity` (`students`, `quizzes`, `participants`, or admin-only `teachers`), `q`, `status`, teacher username, admin-only `accountStatus`, participant `quiz` and `session`, `from`, `to`, `sort` (`name`, `date`, `status`), `dir`, `page`, and `pageSize` (capped at 100). The response contains `items`, server-side `pagination`, and role/scope metadata. Errors use `{ "error": { "code": "...", "message": "..." } }`. Search/filter/sort/page state is reflected in the dashboard URL. Passwords are never searched or returned.

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
      "sessionCode": "SESS-SCI-2081",
      "studentSchoolId": "LES-2026-001",
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
      "accountStatus": null,
      "teacher": "",
      "quiz": "",
      "session": "SESS-1042",
      "from": "2026-09-01",
      "to": "2026-10-01"
    },
    "sort": "date",
    "dir": "desc",
    "searchableFields": [
      "Participant username",
      "Participant status",
      "Quiz title",
      "School ID",
      "Email"
    ]
  }
}
```

For local development, the endpoint defaults to deterministic mock data; use `SEARCH_DATA_SOURCE=mock` or `SEARCH_DATA_SOURCE=supabase` to choose explicitly. Production defaults to Supabase. Apply `supabase/migrations/202610290001_search_views_and_indexes.sql` before enabling the Supabase source. That migration assumes `public.student`, `public.teacher`, `public.quiz`, `public.quiz_session`, and `public.participant` with the columns used by the search views. Adapt those view definitions and indexes if the deployed schema differs. The views use `security_invoker`; existing table grants and RLS policies must allow teachers only their own rows and admins only their permitted rows (including the existing AAL2 requirement). The API also applies a trusted teacher scope before all user filters; participant rows are scoped by the linked student's `teacher_id`, so unlinked/guest participants and another teacher's students are not exposed to teachers.

The migration adds B-tree indexes for teacher/status/date/join columns and `pg_trgm` GIN indexes for substring-matched text columns. Trigram indexes support the `%term%` `ILIKE` searches without requiring a separate full-text search language configuration. Password columns are intentionally absent from views and indexes.

To add a filter field, add its key to `SearchFilterKey`, define role/entity visibility in `FILTER_DEFINITIONS`, expose the field in the corresponding `entityConfigs` view/select/filter configuration, parse and validate it in `validation.ts`, apply it in `query-builder.ts`, then add its control/chip in `SearchFilter` and any required view/index changes to a migration. Add query-builder and role-scope tests for the new field.

## Dashboard exports

Teachers and admins can export the available dashboard datasets as Excel (`.xlsx`) or CSV. Exports use the authenticated session, the same role scope and applicable filters as dashboard search, and the Supabase search views protected by the existing grants and RLS policies.

```http
GET /api/export?entity=participants&format=xlsx&q=maria&status=completed
GET /api/export?entity=participants&format=csv&q=maria&status=completed
```

Exports include all matching rows, not just the current dashboard page, and are streamed in batches. A single export is capped at 100,000 rows; narrow the filters if a dataset exceeds that limit. CSV output includes a UTF-8 BOM, escaped cells, and protection against spreadsheet formula injection.

## Notes

- Both login forms use Supabase Auth. Account registration and dashboard summary data remain mock implementations; provision roles in trusted `app_metadata` before the account can enter its role's dashboard.
- The Android package is available at `public/assets/Fili-QuizMo-1.0.0.apk`.
- The app favicon is generated from `Fili-QuizMo Logo.png`.
