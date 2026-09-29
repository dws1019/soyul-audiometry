/**
 * 저장·가져오기 데이터 검증.
 * LocalStorage나 JSON 파일에서 읽은 값은 신뢰하지 않고, 알려진 필드만 형식을 확인해 새 객체로 만듭니다.
 */
import { DEFAULT_STIMULUS, DURATION_MAX_SEC, DURATION_MIN_SEC, TEST_FREQUENCIES } from '../config/constants'
import type { EarThresholds, ThresholdMap } from '../types/audiometry'
import type { CalibrationProfile } from '../types/calibration'
import type { TestSession } from '../types/patient'
import type { StimulusPreset, StimulusRecord, StimulusSettings } from '../types/stimulus'
import { analyzeHearing } from './hearingAnalysis'
import { createId } from './id'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
/** 범위 안의 숫자만 인정하고, 아니면 fallback (값을 임의로 끌어올리거나 내리지 않음) */
const inRange = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = num(v)
  return n !== null && n >= lo && n <= hi ? n : fallback
}
const isoOr = (v: unknown, fallback: string) =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : fallback

function sanitizeThresholdMap(raw: unknown): ThresholdMap {
  const out: ThresholdMap = Object.fromEntries(TEST_FREQUENCIES.map((f) => [f, null]))
  if (!isObj(raw)) return out
  for (const [k, v] of Object.entries(raw)) {
    const f = Number(k)
    if (!Number.isFinite(f) || f <= 0 || f > 24000) continue
    const n = num(v)
    // 검사 기록은 값을 보정하지 않음: 범위를 벗어난 값은 비워 둠
    out[f] = n !== null && n >= -20 && n <= 140 ? n : null
  }
  return out
}

function sanitizeThresholds(raw: unknown): EarThresholds {
  const o = isObj(raw) ? raw : {}
  return { L: sanitizeThresholdMap(o.L), R: sanitizeThresholdMap(o.R) }
}

export function sanitizeStimulus(raw: unknown): StimulusSettings {
  const o = isObj(raw) ? raw : {}
  const d = DEFAULT_STIMULUS
  const freq = (v: unknown, fb: number) => {
    const n = num(v)
    return n !== null && n >= 20 && n <= 24000 ? n : fb
  }
  // 잘못된 음량 값은 최댓값으로 맞추지 않고 기본값(낮은 값)으로 되돌림
  const vol = (v: unknown, fb: number) => inRange(v, 0, 100, fb)
  const outputModes = ['both', 'left', 'right', 'split'] as const
  const outputMode = outputModes.find((m) => m === o.outputMode) ?? d.outputMode
  const sampleRate = o.sampleRate === 48000 ? 48000 : 44100
  const format = o.format === 'mp3' ? 'mp3' : 'wav'
  const bitrates = [128, 192, 256, 320] as const
  const mp3Bitrate = bitrates.find((b) => b === o.mp3Bitrate) ?? d.mp3Bitrate
  return {
    freqA: freq(o.freqA, d.freqA),
    freqB: freq(o.freqB, d.freqB),
    freqC: freq(o.freqC, d.freqC),
    freqD: freq(o.freqD, d.freqD),
    volumeA: vol(o.volumeA, d.volumeA),
    volumeB: vol(o.volumeB, d.volumeB),
    volumeC: vol(o.volumeC, d.volumeC),
    volumeD: vol(o.volumeD, d.volumeD),
    masterVolume: vol(o.masterVolume, d.masterVolume),
    outputMode,
    durationSec: inRange(o.durationSec, DURATION_MIN_SEC, DURATION_MAX_SEC, d.durationSec),
    fadeSec: inRange(o.fadeSec, 0.05, 30, d.fadeSec),
    sampleRate,
    format,
    mp3Bitrate,
  }
}

function sanitizeRecord(raw: unknown): StimulusRecord | null {
  if (!isObj(raw)) return null
  const now = new Date().toISOString()
  return {
    id: str(raw.id, 100) || createId(),
    createdAt: isoOr(raw.createdAt, now),
    fileName: str(raw.fileName, 300),
    format: raw.format === 'mp3' ? 'mp3' : 'wav',
    sizeBytes: Math.max(0, num(raw.sizeBytes) ?? 0),
    peakDbfs: num(raw.peakDbfs) ?? -Infinity,
    settings: sanitizeStimulus(raw.settings),
  }
}

export function sanitizeSession(raw: unknown): TestSession | null {
  if (!isObj(raw)) return null
  const now = new Date().toISOString()
  const patient = isObj(raw.patient) ? raw.patient : {}
  const audio = isObj(raw.audiometry) ? raw.audiometry : {}
  const thresholds = sanitizeThresholds(audio.thresholds)
  const testDate = str(patient.testDate, 10)
  return {
    id: str(raw.id, 100) || createId(),
    schemaVersion: 1,
    patient: {
      patientId: str(patient.patientId, 60),
      testDate: /^\d{4}-\d{2}-\d{2}$/.test(testDate) ? testDate : now.slice(0, 10),
      memo: str(patient.memo, 4000),
    },
    createdAt: isoOr(raw.createdAt, now),
    updatedAt: isoOr(raw.updatedAt, now),
    audiometry: {
      unit: audio.unit === 'dBHL' ? 'dBHL' : 'relative',
      thresholds,
      calibrationProfileId: str(audio.calibrationProfileId, 100) || null,
    },
    // 저장된 스냅샷을 믿지 않고 결과에서 다시 계산
    vulnerable: analyzeHearing(thresholds, TEST_FREQUENCIES),
    stimulus: sanitizeStimulus(raw.stimulus),
    stimulusLog: Array.isArray(raw.stimulusLog)
      ? raw.stimulusLog.map(sanitizeRecord).filter((r): r is StimulusRecord => r !== null).slice(0, 500)
      : [],
  }
}

export function sanitizePreset(raw: unknown): StimulusPreset | null {
  if (!isObj(raw)) return null
  const name = str(raw.name, 60).trim()
  if (!name) return null
  return {
    id: str(raw.id, 100) || createId(),
    name,
    createdAt: isoOr(raw.createdAt, new Date().toISOString()),
    settings: sanitizeStimulus(raw.settings),
  }
}

export function sanitizeCalibration(raw: unknown): CalibrationProfile | null {
  if (!isObj(raw)) return null
  const refs = isObj(raw.referenceDbfs) ? raw.referenceDbfs : {}
  const earMap = (v: unknown): Record<number, number | null> => {
    const out: Record<number, number | null> = {}
    if (!isObj(v)) return out
    for (const [k, val] of Object.entries(v)) {
      const f = Number(k)
      const n = num(val)
      if (Number.isFinite(f) && f > 0) out[f] = n !== null && n >= -160 && n <= 0 ? n : null
    }
    return out
  }
  return {
    id: str(raw.id, 100) || createId(),
    name: str(raw.name, 80),
    transducer: str(raw.transducer, 80),
    measuredAt: str(raw.measuredAt, 10),
    notes: str(raw.notes, 2000),
    referenceDbfs: { L: earMap(refs.L), R: earMap(refs.R) },
  }
}
