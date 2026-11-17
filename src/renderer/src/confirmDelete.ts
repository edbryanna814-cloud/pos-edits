import type { Language } from '../../shared/settings'

const strings = {
  en: {
    ask: (name: string) => `Delete "${name}"? This cannot be undone.`,
    errors: {
      PRODUCT_ON_OPEN_ORDER: 'This product is on a purchase order that is not received or cancelled yet.',
      SUPPLIER_HAS_ORDERS: 'This supplier has purchase orders; mark it inactive instead.',
      PERMISSION_DENIED: 'You are not allowed to delete this.'
    } as Record<string, string>,
    failed: 'It could not be deleted.'
  },
  ar: {
    ask: (name: string) => `حذف "${name}"؟ لا يمكن التراجع عن ذلك.`,
    errors: {
      PRODUCT_ON_OPEN_ORDER: 'هذا المنتج موجود في أمر شراء لم يُستلم أو يُلغَ بعد.',
      SUPPLIER_HAS_ORDERS: 'لهذا المورد أوامر شراء؛ اجعله غير نشط بدلًا من الحذف.',
      PERMISSION_DENIED: 'غير مسموح لك بالحذف.'
    } as Record<string, string>,
    failed: 'تعذّر الحذف.'
  }
}

export const deleteLabel = (language: Language) => (language === 'ar' ? 'حذف' : 'Delete')

/** Asks first; returns an error text to show, or '' when deleted or cancelled. */
export async function confirmDelete(language: Language, name: string, remove: () => Promise<unknown>, onDone: () => void): Promise<string> {
  const text = strings[language]
  if (!window.confirm(text.ask(name))) return ''
  try {
    await remove()
    onDone()
    return ''
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err)
    const key = Object.keys(text.errors).find((k) => m.includes(k))
    return key ? text.errors[key] : text.failed
  }
}
