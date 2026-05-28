# Supabase + Next.js Skill

## Client Patterns for Next.js 14 App Router

**Package:** `@supabase/ssr` — NEVER use `@supabase/supabase-js` directly in Next.js 14.

### Server Components and Route Handlers — `createServerClient`
```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

export async function createClient() {
  const cookieStore = await cookies()  // async in Next.js 14.2+
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // service_role for API routes
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        }
      }
    }
  )
}
```

### Client Components — `createBrowserClient`
```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // anon for browser
  )
}
```

---

## Migration File Naming

Format: `YYYYMMDDHHMMSS_description.sql`  
Example: `20240115120000_create_leads_table.sql`

```
supabase/migrations/
├── 20240101000000_initial_schema.sql
├── 20240115120000_add_consent_logs.sql
└── 20240120090000_add_calls_table.sql
```

Apply: `npx supabase db push`  
Local dev: `npx supabase db reset` (re-runs all migrations + seed)

---

## RLS Policy Pattern for This Project

All tables use `service_role` key from API routes — service_role bypasses RLS entirely. No user-facing auth in this project.

```sql
-- Enable RLS on all tables (required for Realtime, even if bypassed by service_role)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;

-- Block all public access (service_role bypasses this)
CREATE POLICY "no_public_access" ON leads FOR ALL USING (false);
```

Dashboard server components use `service_role` → reads work. No public or authenticated policies needed.

---

## Realtime for Dashboard

Subscribe to leads table changes for auto-refresh (client component):
```typescript
'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useLeadsRealtime(onUpdate: () => void) {
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => onUpdate()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, onUpdate])
}
```

**Note:** Realtime requires RLS to be enabled on the table (even if the policy blocks all access).

---

## Common Query Patterns

```typescript
const supabase = await createClient()

// Insert and return new row
const { data, error } = await supabase
  .from('leads')
  .insert({ name, phone, email, status: 'new' })
  .select()
  .single()

// Update by id
const { data, error } = await supabase
  .from('leads')
  .update({ status: 'called', call_id: callId })
  .eq('id', leadId)
  .select()
  .single()

// Fetch with join
const { data, error } = await supabase
  .from('leads')
  .select('*, calls(*)')
  .order('created_at', { ascending: false })

// Filter enum + limit
const { data, error } = await supabase
  .from('leads')
  .select('*')
  .eq('status', 'hot')
  .order('created_at', { ascending: false })
  .limit(50)

// Row might not exist — use maybeSingle()
const { data, error } = await supabase
  .from('leads')
  .select('*')
  .eq('email', email)
  .maybeSingle()  // returns null instead of throwing if no row
```

---

## TypeScript Type Generation

```bash
npx supabase gen types typescript --local > lib/database.types.ts
```

Usage pattern:
```typescript
import type { Database } from '@/lib/database.types'

type Lead = Database['public']['Tables']['leads']['Row']
type LeadInsert = Database['public']['Tables']['leads']['Insert']
type LeadUpdate = Database['public']['Tables']['leads']['Update']
```

---

## Gotchas

- `cookies()` is async in Next.js 14.2+ — always `await cookies()`
- `service_role` key **never** goes in `NEXT_PUBLIC_` env vars — browser bundle would expose it
- `.single()` throws if query returns 0 rows; use `.maybeSingle()` when row might not exist
- Supabase Realtime requires RLS to be enabled on the table even if policies allow nothing (it's the mechanism that gates change events)
- `@supabase/ssr` handles cookie refresh automatically; `@supabase/supabase-js` does not work correctly with Next.js App Router
- Service role key bypasses RLS — double-check you're not accidentally using it in client-side code
- `npx supabase db push` applies pending migrations; `db reset` wipes and replays all (dev only)
