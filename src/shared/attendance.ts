export type AttendanceDay = {
  userNo: number
  username: string
  /** Local day, YYYY-MM-DD. */
  day: string
  firstIn: string | null
  lastOut: string | null
  workedMinutes: number
  breakMinutes: number
  /** Clocked in without clocking out: the open period is not counted. */
  open: boolean
}

export type SellerKpi = {
  userNo: number | null
  username: string
  role: string
  salesCount: number
  salesCents: number
  itemsSold: number
  returnsCount: number
  returnsCents: number
  daysPresent: number
  workedMinutes: number
  breakMinutes: number
}

export type AttendanceImportResult = { added: number; duplicates: number; skipped: number; unknownUserNos: number[] }
