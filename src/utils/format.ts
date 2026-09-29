import type { Ear, EarSelection, ThresholdUnit } from '../types/audiometry'
import type { OutputMode, StimulusSettings } from '../types/stimulus'

export function formatNumber(n: number, digits = 1): string {
  return n.toLocaleString('ko-KR', { maximumFractionDigits: digits })
}

/** 4000 → "4,000 Hz" */
export function formatHz(f: number): string {
  return `${formatNumber(f)} Hz`
}

/** 4000 → "4 kHz", 500 → "500 Hz" */
export function formatHzShort(f: number): string {
  return f >= 1000 ? `${formatNumber(f / 1000, 2)} kHz` : `${formatNumber(f)} Hz`
}

export function formatDuration(sec: number): string {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const parts: string[] = []
  if (h) parts.push(`${h}시간`)
  if (m) parts.push(`${m}분`)
  if (r || parts.length === 0) parts.push(`${r}초`)
  return parts.join(' ')
}

/** 파일명용: 30 → "30s", 600 → "10min", 90 → "1m30s" */
export function durationTag(sec: number): string {
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m === 0) return `${r}s`
  if (r === 0) return `${m}min`
  return `${m}m${r}s`
}

function freqTag(f: number): string {
  return String(f).replace('.', 'p')
}

/** 로컬 시간 기준 YYYY-MM-DD */
export function todayLocalIso(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function compactDate(d = new Date()): string {
  return todayLocalIso(d).replace(/-/g, '')
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${todayLocalIso(d)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${formatNumber(bytes / 1024)} KB`
  if (bytes < 1024 ** 3) return `${formatNumber(bytes / 1024 ** 2)} MB`
  return `${formatNumber(bytes / 1024 ** 3, 2)} GB`
}

export function unitLabel(unit: ThresholdUnit): string {
  return unit === 'dBHL' ? 'dB HL' : '%'
}

export function unitLongLabel(unit: ThresholdUnit): string {
  return unit === 'dBHL' ? '청력역치 (dB HL)' : '상대역치 (출력 %)'
}

export function formatLevel(value: number | null | undefined, unit: ThresholdUnit): string {
  if (value == null) return '—'
  return unit === 'dBHL' ? `${formatNumber(value)} dB HL` : `${formatNumber(value)} %`
}

export const EAR_LABEL: Record<Ear, string> = { L: '왼쪽 귀', R: '오른쪽 귀' }
export const EAR_SYMBOL: Record<Ear, string> = { L: 'X', R: 'O' }
export const EAR_SELECTION_LABEL: Record<EarSelection, string> = {
  L: '왼쪽 귀',
  R: '오른쪽 귀',
  both: '양쪽 귀',
}
export const EAR_SELECTION_EN: Record<EarSelection, string> = {
  L: 'LEFT EAR',
  R: 'RIGHT EAR',
  both: 'BOTH EARS',
}

export const OUTPUT_MODE_LABEL: Record<OutputMode, string> = {
  both: '양쪽 동일',
  left: '왼쪽 귀만',
  right: '오른쪽 귀만',
  split: '좌우 각각 다른 설정',
}

/** A:B 음량 비율 (합이 100이 되도록) */
export function volumeRatio(a: number, b: number): string {
  const sum = a + b
  if (sum <= 0) return '0 : 0'
  const pa = Math.round((a / sum) * 100)
  return `${pa} : ${100 - pa}`
}

/**
 * 다운로드 파일명. 환자 이름·ID 등 개인식별정보는 넣지 않습니다.
 * 예: soundtherapy_4000Hz_8000Hz_10min_20260929.wav
 */
export function buildStimulusFileName(s: StimulusSettings, date = new Date()): string {
  const dur = durationTag(s.durationSec)
  const day = compactDate(date)
  const ab = `${freqTag(s.freqA)}Hz_${freqTag(s.freqB)}Hz`
  let body: string
  switch (s.outputMode) {
    case 'split':
      body = `L${freqTag(s.freqA)}-${freqTag(s.freqB)}Hz_R${freqTag(s.freqC)}-${freqTag(s.freqD)}Hz_${dur}`
      break
    case 'left':
      body = `${ab}_${dur}_Lonly`
      break
    case 'right':
      body = `${ab}_${dur}_Ronly`
      break
    default:
      body = `${ab}_${dur}`
  }
  return `soundtherapy_${body}_${day}.${s.format}`
}
