# NATM Super Admin

Platform-wide administration app for the NATM/IEP platform monorepo -- schools CRUD, School Admin invites, and a global cross-school audit log. Separate app from `apps/staff` on purpose: `super_admin` profiles have no `school_id` (see `initial_schema.sql`), and this needs to read/write across every school rather than being scoped to one.

## Local development

```
pnpm --filter @natm/super-admin dev
```

Needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` (same values as `apps/staff`/`apps/student-parent` -- same Supabase project).

## Edge functions this app depends on

- `create-school` -- creates a school, optionally invites its first School Admin in the same call
- `create-school-admin` -- invites an additional School Admin to an existing school
- `delete-school` -- hard-deletes a school, blocked unless it has zero students and zero staff (use Deactivate for anything with real data)

All three are `super_admin`-only, enforced server-side.
