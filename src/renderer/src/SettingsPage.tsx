import { useEffect, useState, type FormEvent } from 'react'
import { useCan } from './session'
import type { CompanySettings, Language, StoredCompanySettings } from '../../shared/settings'
import { t } from './i18n'
import DatabaseLocation from './DatabaseLocation'

interface Props {
  settings: StoredCompanySettings | null
  language: Language
  settingsError: string
  onSaved: (settings: StoredCompanySettings) => void
  onReload: () => void
  /** Only administrators see where the database lives. */
  canManageDatabase: boolean
}

interface FormState {
  companyName: string
  companyPhone: string
  companyAddress: string
  invoiceFooterNote: string
  currencyCode: string
  currencyPrecision: string
  taxEnabled: boolean
  taxRatePercent: string
  defaultLanguage: Language | ''
  backupDirectory: string
}

function toForm(settings: StoredCompanySettings | null): FormState {
  if (!settings) {
    return {
      companyName: '',
      companyPhone: '',
      companyAddress: '',
      invoiceFooterNote: '',
      currencyCode: '',
      currencyPrecision: '',
      taxEnabled: false,
      taxRatePercent: '',
      defaultLanguage: '',
      backupDirectory: ''
    }
  }

  return {
    companyName: settings.companyName,
    companyPhone: settings.companyPhone ?? '',
    companyAddress: settings.companyAddress ?? '',
    invoiceFooterNote: settings.invoiceFooterNote ?? '',
    currencyCode: settings.currencyCode,
    currencyPrecision: String(settings.currencyPrecision),
    taxEnabled: settings.taxRateBasisPoints > 0,
    taxRatePercent: settings.taxRateBasisPoints > 0 ? (settings.taxRateBasisPoints / 100).toFixed(2) : '',
    defaultLanguage: settings.defaultLanguage,
    backupDirectory: settings.backupDirectory
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// Stable backup codes from src/main/backupCrypto.ts, shown in the user's language.
function backupErrorText(language: Language, error: unknown): string {
  const message = errorMessage(error)
  if (message.includes('BACKUP_PASSPHRASE_REQUIRED')) return t(language, 'errBackupPassphrase')
  if (message.includes('BACKUP_DECRYPT_FAILED')) return t(language, 'errBackupDecrypt')
  return message
}

export default function SettingsPage({
  settings,
  language,
  settingsError,
  onSaved,
  onReload,
  canManageDatabase
}: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(settings))
  // Backups in or out: Administrators only.
  const canTransfer = useCan('data.transfer')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [passphrase, setPassphrase] = useState('')

  useEffect(() => {
    setForm(toForm(settings))
  }, [settings])

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setMessage('')
    setError('')

    const precision = Number(form.currencyPrecision)
    if (form.currencyPrecision === '' || !Number.isInteger(precision)) {
      setError(t(language, 'required'))
      return
    }

    const taxPercent = form.taxEnabled ? Number(form.taxRatePercent) : 0
    if (
      (form.taxEnabled && form.taxRatePercent === '') ||
      !Number.isFinite(taxPercent) ||
      taxPercent < 0 ||
      taxPercent > 100
    ) {
      setError(t(language, 'required'))
      return
    }

    if (!form.defaultLanguage) {
      setError(t(language, 'required'))
      return
    }

    const input: CompanySettings = {
      companyName: form.companyName,
      currencyCode: form.currencyCode,
      currencyPrecision: precision,
      taxRateBasisPoints: Math.round(taxPercent * 100),
      companyPhone: form.companyPhone,
      companyAddress: form.companyAddress,
      invoiceFooterNote: form.invoiceFooterNote,
      defaultLanguage: form.defaultLanguage,
      backupDirectory: form.backupDirectory
    }

    setSaving(true)
    try {
      const saved = await window.api.saveSettings(input)
      onSaved(saved)
      setMessage(t(language, 'saved'))
    } catch (saveError) {
      setError(`${t(language, 'settingsSaveError')}: ${errorMessage(saveError)}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleExport(): Promise<void> {
    setMessage('')
    setError('')
    try {
      if (passphrase.length < 12) {
        setError(t(language, 'errBackupPassphrase'))
        return
      }
      const result = await window.api.exportBackup({ passphrase })
      setMessage(
        result.canceled
          ? t(language, 'canceled')
          : `${t(language, 'backupExport')}: ${result.filePath}`
      )
    } catch (backupError) {
      setError(`${t(language, 'backupError')}: ${backupErrorText(language, backupError)}`)
    }
  }

  async function handleImport(): Promise<void> {
    setMessage('')
    setError('')
    try {
      const result = await window.api.importBackup({ passphrase })
      if (result.canceled) {
        setMessage(t(language, 'canceled'))
        return
      }
      setMessage(`${t(language, 'importedDocs')}: ${result.imported ?? 0}`)
      onReload()
    } catch (backupError) {
      setError(`${t(language, 'backupError')}: ${backupErrorText(language, backupError)}`)
    }
  }

  return (
    <section className="panel" aria-labelledby="settings-title">
      <div className="section-header">
        <div>
          <h2 id="settings-title">{t(language, 'settingsTitle')}</h2>
          <p className="muted">{t(language, 'settingsIntro')}</p>
        </div>
        {!settings ? <span className="tag">{t(language, 'notConfigured')}</span> : null}
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <label className="wide">
          <span>{t(language, 'companyName')}</span>
          <input
            value={form.companyName}
            onChange={(event) => update('companyName', event.target.value)}
            maxLength={120}
            required
          />
        </label>

        <label>
          <span>{t(language, 'currencyCode')}</span>
          <input
            value={form.currencyCode}
            onChange={(event) => update('currencyCode', event.target.value.toUpperCase())}
            maxLength={3}
            required
          />
        </label>

        <label>
          <span>{t(language, 'currencyPrecision')}</span>
          <input
            type="number"
            min={0}
            max={4}
            step={1}
            value={form.currencyPrecision}
            onChange={(event) => update('currencyPrecision', event.target.value)}
            required
          />
        </label>

        <label>
          <span>{t(language, 'companyPhone')}</span>
          <input dir="ltr" inputMode="tel" maxLength={30} value={form.companyPhone} onChange={(event) => update('companyPhone', event.target.value)} />
        </label>

        <label className="wide">
          <span>{language === 'ar' ? 'عنوان الصيدلية (للفاتورة)' : 'Company address (invoice)'}</span>
          <input maxLength={200} value={form.companyAddress} onChange={(event) => update('companyAddress', event.target.value)} />
        </label>

        <label className="wide">
          <span>{language === 'ar' ? 'ملاحظة تذييل الفاتورة' : 'Invoice footer note'}</span>
          <input maxLength={300} value={form.invoiceFooterNote} onChange={(event) => update('invoiceFooterNote', event.target.value)} />
        </label>

        <label className="checkbox">
          <input type="checkbox" checked={form.taxEnabled} onChange={(event) => setForm((f) => ({ ...f, taxEnabled: event.target.checked }))} />
          <span>{t(language, 'chargeTax')}</span>
        </label>

        {form.taxEnabled ? (
          <label>
            <span>{t(language, 'taxRate')}</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.taxRatePercent}
              onChange={(event) => update('taxRatePercent', event.target.value)}
              required
            />
          </label>
        ) : null}

        <label>
          <span>{t(language, 'defaultLanguage')}</span>
          <select
            value={form.defaultLanguage}
            onChange={(event) => update('defaultLanguage', event.target.value as Language | '')}
            required
          >
            <option value="">{t(language, 'selectLanguage')}</option>
            <option value="en">{t(language, 'english')}</option>
            <option value="ar">{t(language, 'arabic')}</option>
          </select>
        </label>

        <label className="wide">
          <span>{t(language, 'backupDirectory')}</span>
          <input
            value={form.backupDirectory}
            onChange={(event) => update('backupDirectory', event.target.value)}
          />
        </label>

        {canTransfer ? (
        <label className="wide">
          <span>{t(language, 'backupPassphrase')}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
          />
        </label>
        ) : null}

        <div className="form-actions wide">
          <button type="submit" className="primary" disabled={saving}>
            {saving ? t(language, 'saving') : t(language, 'save')}
          </button>
          {canTransfer ? (
            <>
              <button type="button" onClick={handleExport}>
                {t(language, 'backupExport')}
              </button>
              <button type="button" onClick={handleImport}>
                {t(language, 'backupImport')}
              </button>
            </>
          ) : null}
        </div>
      </form>

      {canTransfer ? <p className="hint">{t(language, 'backupNote')}</p> : null}
      {message ? (
        <p className="success" role="status">
          {message}
        </p>
      ) : null}
      {settingsError ? (
        <p className="error" role="alert">
          {t(language, 'settingsLoadError')}: {settingsError}
        </p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {canManageDatabase ? <DatabaseLocation language={language} /> : null}
    </section>
  )
}
