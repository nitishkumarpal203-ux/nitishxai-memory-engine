# AI Memory System MVP

A clean Next.js App Router MVP for memory-aware chat:

- Chat page where the user sends a message.
- Messages are saved directly into Supabase with optional vector embeddings.
- Local mock AI returns a successful response.
- Memories page lists, edits, deletes, keyword searches, and AI-searches saved memories.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres
- Supabase pgvector
- Supabase Auth with Google
- Local mock embeddings

## Folder Structure

```txt
app/
  auth/callback/page.tsx # Completes Google OAuth sign in
  api/
    chat/route.ts        # Validate message and save memory
    memories/route.ts    # List, keyword search, and semantic search memories
    memories/[id]/route.ts # Edit and delete memories
  chat/page.tsx
  login/page.tsx
  memories/page.tsx
components/
  auth/
  chat/chat-client.tsx
  memories/memory-search.tsx
  app-shell.tsx
  memory-card.tsx
lib/
  ai.ts                  # Local mock AI helpers
  embeddings.ts          # Server-only local mock embedding helper
  memories.ts            # Supabase memory queries
  supabase/server.ts     # Server-only Supabase admin client
supabase/
  schema.sql             # Table, vector column, indexes, search RPC
types/
  memory.ts
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a Supabase project, then open the Supabase SQL editor and run:

```sql
-- paste the SQL from supabase/schema.sql
```

3. Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

4. Fill in the values:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://your-site.example
```

5. In Supabase, enable the Google provider under Authentication providers.

6. Add this callback URL in Supabase Auth settings for every origin you use:

```bash
<your-current-site-origin>/auth/callback
```

7. Start the app:

```bash
npm run dev
```

8. Open the login page on the URL printed by the dev server and sign in with Google.

9. Open the Memories page and enable `AI Semantic Search` to rank results by meaning.

## Vercel Deployment

1. Push this project to GitHub.

2. In Vercel, import the repository and keep the framework preset as Next.js.

3. Add these Vercel environment variables:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://your-vercel-domain.vercel.app
```

4. In Supabase, run `supabase/schema.sql` if the memories table, embedding column, vector index, or `match_memories` RPC are not already installed.

5. In Supabase Authentication URL settings, set:

```bash
Site URL: https://your-vercel-domain.vercel.app
Redirect URLs:
<your-local-dev-origin>/auth/callback
https://your-vercel-domain.vercel.app/auth/callback
```

6. In Supabase Authentication providers, enable Google and configure the Google OAuth credentials. In Google Cloud, the authorized redirect URI should be:

```bash
https://your-project-ref.supabase.co/auth/v1/callback
```

7. Deploy from Vercel, then test:

```bash
https://your-vercel-domain.vercel.app/login
https://your-vercel-domain.vercel.app/
https://your-vercel-domain.vercel.app/memories
```

8. Confirm the production flow: login with Google, send a voice or typed chat message, see the success reply, then edit/delete/search that memory on the dashboard.

## How The Flow Works

1. The user submits a chat message.
2. The client sends the Supabase access token to `app/api/chat/route.ts`.
3. The route validates the token with Supabase Auth and uses `user.id`.
4. The message is inserted into `public.memories` as `memory_text` with `user_id`.
5. A deterministic local mock embedding is saved in `embedding` when the vector column exists.
6. The API returns `{ "reply": "Memory saved successfully.", "saved": true }`.
7. The Memories page reads only the authenticated user's rows.
8. When `AI Semantic Search` is enabled, `/api/memories?query=...&ai=true` calls the `match_memories` RPC and returns semantic matches. If the RPC is unavailable, the app falls back to local semantic ranking.

## MVP Notes

- Google authentication is required for private memory access.
- Supabase access happens in server routes with `SUPABASE_SERVICE_ROLE_KEY`; routes validate the browser access token before querying.
- Row Level Security policies are included so authenticated users can access only their own memories if you later query with the anon client.
- Chat replies and semantic search both stay in local mock mode with no external AI API calls.
- If the vector column or RPC is unavailable, memory saves still work and semantic search falls back to local ranking or keyword results.
