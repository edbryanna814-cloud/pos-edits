import { useState } from 'react'
import type { ProductImportPreview } from '../../../shared/ipc'
import type { Language } from '../../../shared/settings'
import { formatMoney } from '../money'
import { UNIT_NAMES } from '../units'

// Import products from Excel/CSV: pick the file, check every row on screen, then confirm.

const strings = {
  en: {
    open: 'Import from Excel',
    columns: 'First row: Name, SKU, Barcode, Unit (box / strip / pill), Strips per box, Pills per strip, Price, Cost, Stock, Min stock, Expiry. Name and Price are required; Price is for one unit of the product’s type; Stock is in that unit.',
    file: 'File',
    line: 'Row', name: 'Name', sku: 'SKU', unit: 'Unit', price: 'Price', stock: 'Stock', status: 'Check',
    ok: 'OK',
    confirm: (n: number) => `Add ${n} product${n === 1 ? '' : 's'}`,
    cancel: 'Cancel',
    bad: (n: number) => `${n} row${n === 1 ? '' : 's'} with problems will be skipped.`,
    done: (a: number, s: number) => `Added ${a} product${a === 1 ? '' : 's'}${s ? `, skipped ${s}` : ''}.`,
    reasons: {
      NAME_MISSING: 'no name', SKU_MISSING: 'no SKU or barcode', SKU_EXISTS: 'SKU already in the pharmacy', SKU_REPEATED: 'SKU repeated in the file',
      UNIT_INVALID: 'unit must be box, strip or pill', SPLIT_INVALID: 'strips / pills must be whole numbers', PRICE_INVALID: 'price missing or not a number',
      COST_INVALID: 'cost is not a number', STOCK_INVALID: 'stock / minimum must be whole numbers', EXPIRY_INVALID: 'expiry date not understood'
    } as Record<string, string>,
    errors: {
      IMPORT_COLUMNS_MISSING: 'The first row must name the columns, with at least Name and Price.',
      SHEET_TYPE_UNSUPPORTED: 'Choose an .xlsx or .csv file (save old .xls files as .xlsx).',
      SHEET_UNREADABLE: 'The file could not be read. Open it in Excel and save it again as .xlsx.',
      SHEET_TOO_LARGE: 'The file is too large (10 MB / 20,000 rows at most).',
      IMPORT_EXPIRED: 'The check expired. Choose the file again.',
      other: 'The import failed.'
    } as Record<string, string>
  },
  ar: {
    open: 'استيراد من إكسل',
    columns: 'الصف الأول: الاسم، الكود، الباركود، الوحدة (علبة / شريط / قرص)، عدد الشرائط، عدد الأقراص، السعر، التكلفة، الكمية، الحد الأدنى، الصلاحية. الاسم والسعر مطلوبان؛ السعر لوحدة واحدة من نوع المنتج، والكمية بنفس الوحدة.',
    file: 'الملف',
    line: 'الصف', name: 'الاسم', sku: 'الكود', unit: 'الوحدة', price: 'السعر', stock: 'الكمية', status: 'الفحص',
    ok: 'سليم',
    confirm: (n: number) => `إضافة ${n} منتج`,
    cancel: 'إلغاء',
    bad: (n: number) => `سيتم تخطي ${n} صف به مشاكل.`,
    done: (a: number, s: number) => `تمت إضافة ${a} منتج${s ? `، وتخطي ${s}` : ''}.`,
    reasons: {
      NAME_MISSING: 'بدون اسم', SKU_MISSING: 'بدون كود أو باركود', SKU_EXISTS: 'الكود موجود بالفعل', SKU_REPEATED: 'الكود مكرر في الملف',
      UNIT_INVALID: 'الوحدة يجب أن تكون علبة أو شريط أو قرص', SPLIT_INVALID: 'الشرائط / الأقراص يجب أن تكون أعدادًا صحيحة', PRICE_INVALID: 'السعر غير موجود أو غير رقمي',
      COST_INVALID: 'التكلفة غير رقمية', STOCK_INVALID: 'الكمية / الحد الأدنى يجب أن تكون أعدادًا صحيحة', EXPIRY_INVALID: 'تاريخ الصلاحية غير مفهوم'
    } as Record<string, string>,
    errors: {
      IMPORT_COLUMNS_MISSING: 'يجب أن يحتوي الصف الأول على أسماء الأعمدة، وعلى الأقل الاسم والسعر.',
      SHEET_TYPE_UNSUPPORTED: 'اختر ملف .xlsx أو .csv (احفظ ملفات .xls القديمة بصيغة .xlsx).',
      SHEET_UNREADABLE: 'تعذّرت قراءة الملف. افتحه في إكسل واحفظه مرة أخرى بصيغة .xlsx.',
      SHEET_TOO_LARGE: 'الملف كبير جدًا (10 ميجابايت / 20,000 صف كحد أقصى).',
      IMPORT_EXPIRED: 'انتهت صلاحية الفحص. اختر الملف مرة أخرى.',
      other: 'فشل الاستيراد.'
    } as Record<string, string>
  }
}

export default function ImportProducts({ language, currency, onDone }: { language: Language; currency: string; onDone: () => void }) {
  const text = strings[language]
  const [preview, setPreview] = useState<ProductImportPreview | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const errorText = (err: unknown) => {
    const m = err instanceof Error ? err.message : String(err)
    return text.errors[Object.keys(text.errors).find((k) => m.includes(k)) ?? 'other']
  }

  async function run(action: () => Promise<void>): Promise<void> {
    setError('')
    setMessage('')
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const good = preview?.rows.filter((r) => r.errors.length === 0).length ?? 0
  const bad = (preview?.rows.length ?? 0) - good

  return (
    <div className="import-products">
      <button type="button" disabled={busy} onClick={() => void run(async () => setPreview(await window.api.invImportPreview()))}>{text.open}</button>
      {message ? <p className="success" role="status">{message}</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {preview ? (
        <div className="panel">
          <p className="muted">{text.file}: {preview.fileName}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{text.line}</th><th>{text.name}</th><th>{text.sku}</th><th>{text.unit}</th><th>{text.price}</th><th>{text.stock}</th><th>{text.status}</th></tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} className={r.errors.length ? 'row-muted' : ''}>
                    <td>{r.line}</td>
                    <td>{r.name}</td>
                    <td>{r.sku}</td>
                    <td>{UNIT_NAMES[language][r.packaging]}</td>
                    <td>{formatMoney(r.unitPriceCents, currency)}</td>
                    <td>{r.stock}</td>
                    <td className={r.errors.length ? 'danger-text' : 'ok-text'}>{r.errors.length ? r.errors.map((e) => text.reasons[e] ?? e).join(', ') : text.ok}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bad ? <p className="warning-text">{text.bad(bad)}</p> : null}
          <div className="form-actions">
            <button
              type="button"
              className="primary"
              disabled={busy || good === 0}
              onClick={() => void run(async () => {
                const r = await window.api.invImportConfirm(preview.batchId)
                setPreview(null)
                setMessage(text.done(r.added, r.skipped))
                onDone()
              })}
            >
              {text.confirm(good)}
            </button>
            <button type="button" onClick={() => setPreview(null)}>{text.cancel}</button>
          </div>
        </div>
      ) : (
        <p className="hint">{text.columns}</p>
      )}
    </div>
  )
}
