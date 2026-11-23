export function sanitizeExternalUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function assertSafeOptionalUrl(rawUrl: unknown, fieldName: string): string | undefined {
  if (rawUrl === undefined || rawUrl === null) return undefined;
  if (typeof rawUrl !== 'string') {
    throw new Error(`${fieldName} must be a valid URL string.`);
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  const safe = sanitizeExternalUrl(trimmed);
  if (!safe) {
    throw new Error(`${fieldName} must start with http:// or https://.`);
  }
  return safe;
}
