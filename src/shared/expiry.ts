// Product expiry warnings, shared by the dashboard, inventory and reports.
// "Expires soon" means less than 8 calendar months left (pharmacy shelf rule).
export const EXPIRY_WARNING_MONTHS = 8

export type ExpiryState = 'none' | 'expired' | 'soon' | 'ok'

export function expiryState(date: string | undefined | null, now: Date = new Date()): ExpiryState {
  if (!date) return 'none'
  const target = new Date(`${String(date).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(target.getTime())) return 'none'
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  if (target < today) return 'expired'
  const limit = new Date(today)
  limit.setMonth(limit.getMonth() + EXPIRY_WARNING_MONTHS)
  return target < limit ? 'soon' : 'ok'
}
