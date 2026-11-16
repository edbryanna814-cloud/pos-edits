import { describe, expect, it } from 'vitest'
import { parseMachineTime, parsePunches, summarizeDay, type PunchType } from '../../src/main/attendanceRules'

const at = (hhmm: string) => new Date(2026, 10, 16, +hhmm.slice(0, 2), +hhmm.slice(3, 5))
const day = (...list: [string, PunchType][]) => list.map(([t, type]) => ({ at: at(t), type }))

describe('fingerprint attendance', () => {
  it('reads the Excel export (header row, status words) and the attlog.dat text file', () => {
    const excel = parsePunches([
      ['AC-No.', 'Name', 'Date/Time', 'Status'],
      ['3', 'Ali', '16/11/2026 08:01:00', 'C/In'],
      ['3', 'Ali', '16/11/2026 1:05 PM', 'Break Out'],
      ['x', 'bad', 'never', 'C/In']
    ])
    expect(excel.skipped).toBe(1)
    expect(excel.punches.map((p) => [p.userNo, p.at.getHours(), p.at.getMinutes(), p.type])).toEqual([[3, 8, 1, 'in'], [3, 13, 5, 'break_out']])
    const dat = parsePunches([['1', '2026-11-16 17:00:05', '1', '1', '1', '0']])
    expect(dat.punches.map((p) => [p.userNo, p.at.getHours(), p.type])).toEqual([[1, 17, 'out']])
    const separate = parsePunches([['User ID', 'Date', 'Time'], ['7', '46342', '0.5']])
    expect(separate.punches[0].at.getHours()).toBe(12)
  })

  it('rejects impossible dates', () => {
    expect(parseMachineTime('2026-02-30 08:00')).toBeNull()
    expect(parseMachineTime('12/1/2026 12:30 AM')!.getHours()).toBe(0)
  })

  it('works out hours and break time for a day', () => {
    // 08:00 in, 13:00 break, 13:30 back, 17:00 out: 8h30 worked, 30 min break.
    const s = summarizeDay(day(['08:00', 'in'], ['13:00', 'break_out'], ['13:30', 'break_in'], ['17:00', 'out']))
    expect([s.workedMs / 60000, s.breakMs / 60000, s.open]).toEqual([510, 30, false])
    expect(s.firstIn!.getHours()).toBe(8)
    expect(s.lastOut!.getHours()).toBe(17)
  })

  it('punches without a status alternate; a missing clock-out is not counted', () => {
    expect(summarizeDay(day(['09:00', 'punch'], ['12:00', 'punch'], ['13:00', 'punch'], ['15:00', 'punch'])).workedMs / 60000).toBe(300)
    const open = summarizeDay(day(['09:00', 'in']))
    expect([open.workedMs, open.open]).toEqual([0, true])
  })
})
