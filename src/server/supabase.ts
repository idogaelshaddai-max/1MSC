import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null | undefined;

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
  // Normalize if the user pasted the /rest/v1 or /rest/v1/ endpoint URL
  trimmed = trimmed.replace(/\/rest\/v1\/?$/i, '');
  trimmed = trimmed.replace(/\/+$/, '');
  return trimmed;
}

export function getSupabaseKeyRoleIssue(rawKey?: string): string | null {
  const key = stripQuotes(rawKey);
  if (!key) return 'SUPABASE_SERVICE_ROLE_KEY is not set.';
  if (key.startsWith('sb_publishable_')) {
    return 'SUPABASE_SERVICE_ROLE_KEY is currently set to a public sb_publishable_ key. Please replace it with your private Secret / service_role key from Supabase Dashboard -> Project Settings -> API Keys.';
  }
  if (key.startsWith('eyJ')) {
    try {
      const parts = key.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (payload?.role === 'anon') {
          return 'SUPABASE_SERVICE_ROLE_KEY is currently set to an anon JWT key. Please replace it with your private service_role key from Supabase Dashboard -> Project Settings -> API Keys.';
        }
      }
    } catch {
      // Ignore parse issues and let Supabase validate
    }
  }
  return null;
}

export function isSupabaseConfigured(): boolean {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const serviceKey = stripQuotes(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return Boolean(url && serviceKey && !getSupabaseKeyRoleIssue(serviceKey));
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const serviceKey = stripQuotes(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const keyIssue = getSupabaseKeyRoleIssue(serviceKey);

  if (!url || !serviceKey || keyIssue) {
    if (url && keyIssue) {
      console.warn(`[Supabase] ${keyIssue} Using local JSON fallback until fixed.`);
    }
    cachedClient = null;
    return null;
  }

  cachedClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}
