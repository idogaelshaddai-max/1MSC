import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null | undefined;
let cachedConfigError: string | null = null;

function stripQuotes(val?: string): string {
  if (!val) return '';
  let trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function normalizeSupabaseUrl(rawUrl?: string): string {
  let trimmed = stripQuotes(rawUrl);
  if (!trimmed) return '';
  trimmed = trimmed.replace(/\/rest\/v1\/?$/i, '');
  trimmed = trimmed.replace(/\/+$/, '');
  return trimmed;
}

export function getSupabaseUrlIssue(rawUrl?: string): string | null {
  const url = normalizeSupabaseUrl(rawUrl);
  if (!url) return 'SUPABASE_URL is not set.';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'SUPABASE_URL must start with https://.';
    }
  } catch {
    return 'SUPABASE_URL is not a valid URL.';
  }
  return null;
}

export function getSupabaseKeyRoleIssue(rawKey?: string): string | null {
  const key = stripQuotes(rawKey);
  if (!key) return 'SUPABASE_SERVICE_ROLE_KEY is not set.';
  if (key.startsWith('sb_publishable_')) {
    return 'SUPABASE_SERVICE_ROLE_KEY is currently set to a public sb_publishable_ key. Replace it with your private Secret / service_role key.';
  }
  if (key.startsWith('eyJ')) {
    try {
      const parts = key.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (payload?.role === 'anon') {
          return 'SUPABASE_SERVICE_ROLE_KEY is currently set to an anon JWT key. Replace it with your private service_role key.';
        }
      }
    } catch {
      // Ignore parse issues and let Supabase validate
    }
  }
  return null;
}

export function isSupabaseConfigured(): boolean {
  const urlIssue = getSupabaseUrlIssue(process.env.SUPABASE_URL);
  const keyIssue = getSupabaseKeyRoleIssue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return !urlIssue && !keyIssue;
}

export function getSupabaseConfigError(): string | null {
  const urlIssue = getSupabaseUrlIssue(process.env.SUPABASE_URL);
  if (urlIssue) return urlIssue;
  const keyIssue = getSupabaseKeyRoleIssue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (keyIssue) return keyIssue;
  return cachedConfigError;
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const serviceKey = stripQuotes(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const urlIssue = getSupabaseUrlIssue(url);
  const keyIssue = getSupabaseKeyRoleIssue(serviceKey);

  if (urlIssue || keyIssue) {
    cachedConfigError = urlIssue || keyIssue;
    if (url && cachedConfigError) {
      console.warn(`[Supabase] ${cachedConfigError}`);
    }
    cachedClient = null;
    return null;
  }

  try {
    cachedClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedConfigError = null;
    return cachedClient;
  } catch (err: any) {
    cachedConfigError = err?.message || 'Failed to initialize Supabase client.';
    console.error('[Supabase] Initialization error:', cachedConfigError);
    cachedClient = null;
    return null;
  }
}
