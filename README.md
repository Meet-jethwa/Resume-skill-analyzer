# Resume Skill Analyzer

Resume Skill Analyzer is a full-stack web app that analyzes resume content (text or PDF), detects skills, suggests roles, calculates a score, and stores history in Supabase.

This project is configured for Vercel deployment with serverless API routes in the root api folder.

## Architecture

- Frontend: Vite + React in client
- Backend: Vercel Serverless Functions in api
- Database: Supabase PostgreSQL
- AI Skill Extraction: Hugging Face Inference API

## Project Structure

```text
resume-skill-analyzer/
|-- api/
|   |-- analyze.js
|   `-- history.js
|-- client/
|   |-- src/
|   |   |-- components/
|   |   |   |-- History.jsx
|   |   |   `-- ResumeForm.jsx
|   |   |-- App.jsx
|   |   |-- App.css
|   |   `-- index.css
|   |-- package.json
|   `-- vite.config.js
|-- package.json                # Root package for Vercel build + API deps
|-- vercel.json
`-- README.md
```

Required deployment shape:

```text
resume-skill-analyzer/
|-- api/
|   |-- analyze.js
|   `-- history.js
`-- package.json
```

## Features

- Resume text analysis
- PDF upload support
- Skill detection + suggested roles
- Resume score out of 10
- Job description match percentage + missing skills
- Analysis history with delete support

## Prerequisites

- Node.js 18+
- npm
- Supabase project
- Hugging Face token
- Vercel account

## Environment Variables

Create these in Vercel Project Settings and optionally in local env files.

### Required

- SUPABASE_URL
- SUPABASE_ANON_KEY
- HF_TOKEN
- VITE_API_URL (optional for Vercel, required for local split frontend/backend)

### Local Example

.env.local

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
HF_TOKEN=hf_your_huggingface_token
VITE_API_URL=http://localhost:3000
```

For Vercel production, you can leave VITE_API_URL unset because frontend falls back to same-origin /api.

## Supabase Table Setup

Run this SQL in Supabase SQL Editor:

```sql
create extension if not exists "pgcrypto";

create table if not exists public.resume_results (
  id uuid primary key default gen_random_uuid(),
  input_text text not null,
  detected_skills text[] not null default '{}',
  suggested_roles text[] not null default '{}',
  resume_score numeric(3,1),
  job_description text,
  skill_match jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_resume_results_created_at
  on public.resume_results (created_at desc);
```

If RLS is enabled, add policies for anon access:

```sql
alter table public.resume_results enable row level security;

create policy "resume_results_select"
on public.resume_results
for select
to anon
using (true);

create policy "resume_results_insert"
on public.resume_results
for insert
to anon
with check (true);

create policy "resume_results_delete"
on public.resume_results
for delete
to anon
using (true);
```

## Local Development

Install dependencies:

```bash
# root deps for /api functions
npm install

# frontend deps
npm --prefix client install
```

Run frontend only:

```bash
npm --prefix client run dev
```

Run frontend + serverless API together (recommended):

```bash
npm i -g vercel
vercel dev
```

## Vercel Deployment Guide (Step-by-Step)

### 1. Push to GitHub

```bash
git add .
git commit -m "migrate to vercel serverless api"
git push
```

### 2. Import Project in Vercel

- Open Vercel dashboard
- Click New Project
- Select this GitHub repository
- Keep root directory as repository root

### 3. Build Settings

This repo already includes vercel.json with:

- installCommand: npm install && npm --prefix client install
- buildCommand: npm run build
- outputDirectory: client/dist
- functions: api/*.js on nodejs@20.x

No manual build override is required unless you changed config.

### 4. Add Environment Variables in Vercel

Project Settings > Environment Variables:

- SUPABASE_URL
- SUPABASE_ANON_KEY
- HF_TOKEN
- VITE_API_URL (optional; set to your deployed URL only if needed)

### 5. Deploy

- Click Deploy
- Wait for build to complete
- Open deployed URL

## API Routes (Vercel)

- POST /api/analyze
- GET /api/history
- GET /api/history?id=<uuid>
- DELETE /api/history?id=<uuid>

## Frontend Integration (React)

Use same-origin API calls in production:

```js
async function analyzeResume(text) {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input_text: text }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Analyze failed');
  return data;
}

async function getHistory() {
  const res = await fetch('/api/history');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'History fetch failed');
  return data;
}
```

## Troubleshooting

### 1. EADDRINUSE locally

A local port is occupied. Kill the process on that port and restart.

### 2. Supabase PGRST204 missing column

Your resume_results schema is incomplete. Re-run the SQL table setup above.

### 3. Hugging Face endpoint warning

Use latest @huggingface/inference (already configured in root package.json).

### 4. README not rendering correctly on GitHub

Ensure README.md is UTF-8 and does not include accidental appended lines.

## Security Note

If any key or token was accidentally exposed in screenshots, logs, or commits, rotate it immediately.

## License

MIT
