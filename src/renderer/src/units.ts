import type { Language } from '../../shared/settings'
import { breakdown, type PackagingFields, type SaleUnit } from '../../shared/packaging'

export const UNIT_NAMES: Record<Language, Record<SaleUnit, string>> = {
  en: { box: 'Box', strip: 'Strip', pill: 'Pill' },
  ar: { box: 'علبة', strip: 'شريط', pill: 'قرص' }
}

const PLURAL: Record<Language, Record<SaleUnit, string>> = {
  en: { box: 'boxes', strip: 'strips', pill: 'pills' },
  ar: { box: 'علب', strip: 'شرائط', pill: 'أقراص' }
}

/** "4 boxes · 2 strips · 11 pills" (zero parts left out; "0 strips" when empty). */
export function stockText(stock: number, product: PackagingFields, language: Language): string {
  const b = breakdown(stock, product)
  const parts = (['box', 'strip', 'pill'] as const)
    .map((unit) => [unit, unit === 'box' ? b.boxes : unit === 'strip' ? b.strips : b.pills] as const)
    .filter(([, n]) => n > 0)
    .map(([unit, n]) => `${n} ${n === 1 ? UNIT_NAMES[language][unit].toLowerCase() : PLURAL[language][unit]}`)
  return parts.length ? parts.join(' · ') : `0 ${PLURAL[language].strip}`
}
