// ============================================================
// Supabase client factories
// Re-exports from the project's existing lib/supabase setup
// ============================================================

import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server'
import { createClientSupabase } from '@/lib/supabase/client'

// ── Server-side (Server Components & Server Actions) ───────

/**
 * Create a Supabase client for server-side use.
 * Automatically reads cookies for auth session.
 * Must be called inside a Server Component or Server Action.
 */
export const createServerClient = createServerSupabase

/**
 * Create a Supabase admin client (service role).
 * Bypasses RLS — use only for trusted server-side operations.
 */
export const createAdminClient = createAdminSupabase

// ── Client-side (Client Components) ────────────────────────

/**
 * Create a Supabase client for browser-side use.
 * Uses the anon key and reads/writes cookies for session management.
 */
export const createBrowserClient = createClientSupabase
