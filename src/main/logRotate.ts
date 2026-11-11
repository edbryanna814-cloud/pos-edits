import { rename, rm, stat } from 'node:fs/promises'

// Gate 1 S5: bounded logs. Called before a log file is opened (startup), so nothing is writing to it.
export const MAX_LOG_BYTES = 10 * 1024 * 1024
export const KEEP_ROTATED = 3

/** If `file` exceeds `maxBytes`, shift file -> file.1 -> … -> file.<keep>; the oldest is deleted. */
export async function rotateIfLarge(file: string, maxBytes = MAX_LOG_BYTES, keep = KEEP_ROTATED): Promise<boolean> {
  const size = await stat(file).then((s) => s.size, () => 0)
  if (size <= maxBytes) return false
  await rm(`${file}.${keep}`, { force: true })
  for (let i = keep - 1; i >= 1; i--) await rename(`${file}.${i}`, `${file}.${i + 1}`).catch(() => undefined)
  await rename(file, `${file}.1`)
  return true
}
