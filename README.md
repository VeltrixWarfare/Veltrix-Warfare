# VELTRIX WARFARE

React + TypeScript + Vite frontend. The current UI design is retained.

## Supabase setup

The Supabase client is prepared in `src/lib/supabase.ts`, but authentication, member tables, admin authorization, payments, news, economic calendar, and historical market data are not yet fully integrated. Do not treat the preview UI as production-ready.

Set these variables in Vercel Project Settings → Environment Variables:
- `VITE_SUPABASE_URL` — your Supabase Project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase publishable key (the modern `sb_publishable_...` key is accepted here despite the variable's legacy name)

Never place a Supabase `service_role` or secret key in frontend code or GitHub. Configure Row Level Security (RLS) before storing member data.

## Build

```sh
npm install
npm run build
```

The project pins the Vercel build runtime to Node.js 22.x. If deployment still fails, inspect the complete build log and fix the first actual error.

## Deploying from GitHub on Android

Vercel deploys the repository contents, not a ZIP uploaded as a file. Extract this archive first, then replace/add the project files in the repository while preserving the top-level folder structure. Do not upload the ZIP itself as the only project file.
