import type { Language } from '../../shared/settings'

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabic = ARABIC_DIGITS.indexOf(digit)
    if (arabic >= 0) return String(arabic)
    return String(PERSIAN_DIGITS.indexOf(digit))
  })
}

export function formatMoney(cents: number, currency: string): string {
  const value = Math.round(Number(cents) || 0)
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const whole = Math.floor(abs / 100).toLocaleString('en-US')
  const fraction = (abs % 100).toString().padStart(2, '0')
  const suffix = currency ? ` ${currency}` : ''
  return `${sign}${whole}.${fraction}${suffix}`
}

export function parseMoney(input: string): number | null {
  const text = normalizeDigits(input).trim().replace(/,/g, '').replace(/\s/g, '')
  if (!text) return null
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2))
}

export function centsToInput(cents: number): string {
  const abs = Math.abs(Math.round(Number(cents) || 0))
  const sign = cents < 0 ? '-' : ''
  return `${sign}${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, '0')}`
}

export function formatDateTime(iso: string | undefined, language: Language): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
}

export function isToday(iso: string | undefined): boolean {
  if (!iso) return false
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}
