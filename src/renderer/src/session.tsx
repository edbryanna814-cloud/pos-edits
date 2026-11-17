import { createContext, useContext, useState } from 'react'
import type { Language } from '../../shared/settings'

// Who is signed in, for showing or hiding things. The main process checks every call again;
// this only keeps buttons a user may not use off their screen.

export const SessionContext = createContext<{ role: string; permissions: string[] }>({ role: '', permissions: [] })

export const useCan = (permission: string) => useContext(SessionContext).permissions.includes(permission)
export const useIsAdmin = () => useContext(SessionContext).role === 'Administrator'

/** The record's database ID: Administrators only. */
export function RecordId({ id }: { id?: string }) {
  return useIsAdmin() && id ? <small className="record-id" dir="ltr">ID {id}</small> : null
}

const strings = {
  en: { label: 'Export', xlsx: 'Excel (.xlsx)', db: 'Database (.db)', done: (n: number, f: string) => `Exported ${n} records to ${f}.`, failed: 'The export failed.' },
  ar: { label: 'تصدير', xlsx: 'إكسل (.xlsx)', db: 'قاعدة بيانات (.db)', done: (n: number, f: string) => `تم تصدير ${n} سجل إلى ${f}.`, failed: 'فشل التصدير.' }
}

/** Export this section as Excel or as database records (Administrators only). */
export function ExportButton({ section, language }: { section: string; language: Language }) {
  const text = strings[language]
  const allowed = useCan('data.transfer')
  const [format, setFormat] = useState<'xlsx' | 'db'>('xlsx')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  if (!allowed) return null
  return (
    <span className="export-button">
      <select value={format} onChange={(e) => setFormat(e.target.value as 'xlsx' | 'db')} aria-label={`${text.label} ${section}`}>
        <option value="xlsx">{text.xlsx}</option>
        <option value="db">{text.db}</option>
      </select>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setNote('')
          try {
            const r = await window.api.exportSection(section, format)
            if (r) setNote(text.done(r.count, r.fileName))
          } catch {
            setNote(text.failed)
          } finally {
            setBusy(false)
          }
        }}
      >
        {text.label}
      </button>
      {note ? <small className="muted" role="status">{note}</small> : null}
    </span>
  )
}
