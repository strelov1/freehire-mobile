/**
 * The OAuth callback deep link parser. After the provider flow, the backend
 * redirects to `freehiremobile://auth-callback?code=…` (or `?auth_error=oauth`).
 * This pulls the `code` or the error out of that URL — tolerant of the value
 * living in the query string or the fragment, and never throwing on a malformed
 * or unrelated URL (it just returns neither). Pure; the one branchy piece of the
 * OAuth flow, so it carries the unit tests.
 */

export type CallbackResult = { code?: string; error?: string };

/** Read one param from anywhere in the URL (query or fragment). The leading
 *  `[?&#]` anchors on a real delimiter so `zipcode` never matches `code`. */
function param(url: string, name: string): string | undefined {
  const m = url.match(new RegExp(`[?&#]${name}=([^&#]*)`));
  if (!m) return undefined;
  try {
    return decodeURIComponent(m[1] ?? '');
  } catch {
    return m[1]; // malformed percent-encoding — hand back the raw value
  }
}

export function codeFromCallbackUrl(url: string): CallbackResult {
  if (!url) return {};
  const code = param(url, 'code');
  if (code) return { code };
  const error = param(url, 'auth_error');
  if (error) return { error };
  return {};
}
