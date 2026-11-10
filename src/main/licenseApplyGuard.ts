// D-LIC-16 containment guard for license:apply. Removed with the activation form in B3.
// Messages stay plain text like the existing PHM1 errors: D-LIC-10 forbids new error codes.

export const APPLY_LIMIT = 5
export const APPLY_WINDOW_MS = 60 * 60 * 1000

/** Refusal checked before the code is verified. Prunes `attempts` (ms timestamps) in place. */
export function preApplyRefusal(status: string, attempts: number[], now: number): string | null {
  while (attempts.length && now - attempts[0] >= APPLY_WINDOW_MS) attempts.shift()
  if (attempts.length >= APPLY_LIMIT) return 'Too many license attempts. Try again in an hour.'
  if (status === 'valid') return 'A valid license is already installed.'
  return null
}

/** Refusal checked after the code is verified. Times are PHM1 milliseconds. */
export function expiryRefusal(installedExpiresAt: string | undefined, newExpMs: number, now: number): string | null {
  if (newExpMs <= now) return 'This license code has already expired'
  if (installedExpiresAt && newExpMs < Date.parse(installedExpiresAt)) return 'This license code expires earlier than the installed license.'
  return null
}
