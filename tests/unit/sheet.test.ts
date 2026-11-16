import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { excelDate, readSheet } from '../../src/main/sheet'

// A minimal .xlsx as Excel writes it: shared strings, an inline string, numbers, a gap (C1 empty).
const xlsx = zipSync({
  'xl/sharedStrings.xml': strToU8('<sst><si><t>Name</t></si><si><r><t>Para</t></r><r><t>cetamol &amp; Co</t></r></si></sst>'),
  'xl/worksheets/sheet1.xml': strToU8(
    '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Price</t></is></c><c r="D1" t="inlineStr"><is><t>Date</t></is></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>12.5</v></c><c r="D2"><v>46342.3340277778</v></c></row>' +
    '</sheetData></worksheet>'
  )
})

describe('reading sheets', () => {
  it('reads the first sheet of an .xlsx (shared, rich and inline text, numbers, empty cells)', () => {
    expect(readSheet(xlsx, 'products.XLSX')).toEqual([
      ['Name', 'Price', '', 'Date'],
      ['Paracetamol & Co', '12.5', '', '46342.3340277778']
    ])
  })

  it('reads CSV (quotes, BOM), semicolon and tab-separated machine exports', () => {
    expect(readSheet(strToU8('﻿name,price\n"Aspirin, 100mg",3\n'), 'a.csv')).toEqual([['name', 'price'], ['Aspirin, 100mg', '3']])
    expect(readSheet(strToU8('a;b\r\n1;2'), 'a.csv')).toEqual([['a', 'b'], ['1', '2']])
    expect(readSheet(strToU8('    1\t2026-11-16 08:01:22\t1\t0\n'), 'attlog.dat')).toEqual([['1', '2026-11-16 08:01:22', '1', '0']])
  })

  it('refuses other files, broken archives and oversized input', () => {
    expect(() => readSheet(strToU8('x'), 'old.xls')).toThrow('SHEET_TYPE_UNSUPPORTED')
    expect(() => readSheet(strToU8('not a zip'), 'bad.xlsx')).toThrow('SHEET_UNREADABLE')
    expect(() => readSheet(new Uint8Array(11 * 1024 * 1024), 'big.csv')).toThrow('SHEET_TOO_LARGE')
  })

  it('converts Excel day numbers to local date-times', () => {
    const d = excelDate('46342.3340277778')!
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 11, 16, 8, 1])
    expect(excelDate('abc')).toBeNull()
  })
})

describe('writing sheets', () => {
  it('writes an .xlsx that reads back the same (text, numbers, Arabic, symbols, gaps)', async () => {
    const { writeXlsx } = await import('../../src/main/sheetWrite')
    const rows = [['Name', 'Price', 'Note'], ['بنادول <أقراص> & "x"', 12.5, null], ['B', 0, 'ok']]
    expect(readSheet(writeXlsx(rows, 'Products'), 'out.xlsx')).toEqual([['Name', 'Price', 'Note'], ['بنادول <أقراص> & "x"', '12.5'], ['B', '0', 'ok']])
  })
})
