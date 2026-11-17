export type Language = 'en' | 'ar'

export interface CompanySettings {
  companyName: string
  /** Printed on invoices; optional. */
  companyPhone: string
  currencyCode: string
  currencyPrecision: number
  taxRateBasisPoints: number
  defaultLanguage: Language
  backupDirectory: string
}

export interface StoredCompanySettings extends CompanySettings {
  updatedAt: string
}

export function validateSettings(input: unknown): CompanySettings {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Invalid settings payload')
  }

  const raw = input as Record<string, unknown>

  const companyName = typeof raw.companyName === 'string' ? raw.companyName.trim() : ''
  if (companyName.length < 1 || companyName.length > 120) {
    throw new Error('Company name is required and must be 1-120 characters')
  }

  const companyPhone = typeof raw.companyPhone === 'string' ? raw.companyPhone.trim() : ''
  if (companyPhone && !/^[+\d][\d\s-]{2,29}$/.test(companyPhone)) {
    throw new Error('Pharmacy phone: digits, spaces and dashes only')
  }

  const currencyCode =
    typeof raw.currencyCode === 'string' ? raw.currencyCode.trim().toUpperCase() : ''
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    throw new Error('Currency code must be a 3-letter ISO 4217 code')
  }

  const currencyPrecision = Number(raw.currencyPrecision)
  if (
    !Number.isInteger(currencyPrecision) ||
    currencyPrecision < 0 ||
    currencyPrecision > 4
  ) {
    throw new Error('Currency precision must be an integer from 0 to 4')
  }

  const taxRateBasisPoints = Number(raw.taxRateBasisPoints)
  if (
    !Number.isInteger(taxRateBasisPoints) ||
    taxRateBasisPoints < 0 ||
    taxRateBasisPoints > 10000
  ) {
    throw new Error('Tax rate must be between 0 and 10000 basis points')
  }

  const defaultLanguage =
    raw.defaultLanguage === 'ar' ? 'ar' : raw.defaultLanguage === 'en' ? 'en' : null
  if (!defaultLanguage) {
    throw new Error('Default language must be en or ar')
  }

  const backupDirectory =
    typeof raw.backupDirectory === 'string' ? raw.backupDirectory.trim() : ''

  return {
    companyName,
    companyPhone,
    currencyCode,
    currencyPrecision,
    taxRateBasisPoints,
    defaultLanguage,
    backupDirectory
  }
}
