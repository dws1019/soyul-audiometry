/**
 * 레벨 변환과 교정(calibration) 계산.
 *
 * 비교정 모드에서는 출력 레벨(%)을 디지털 진폭으로만 바꾸며, 어떤 경우에도 dB HL/SPL로 환산하지 않습니다.
 * dB HL 계산은 CalibrationProfile(장비별 교정표)이 있는 귀·주파수에서만 이루어집니다.
 */
import { MASTER_RANGE_DB, MAX_PEAK_AMPLITUDE, TEST_LEVEL_RANGE_DB } from '../config/constants'
import type { Ear, EarSelection, ThresholdUnit } from '../types/audiometry'
import type { CalibrationProfile } from '../types/calibration'

/** % → 감쇠량(dB). 100 % = 0 dB, 0 % = -Infinity(무음) */
export function percentToDb(percent: number, rangeDb: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return -Infinity
  const p = Math.min(100, percent)
  return ((p - 100) * rangeDb) / 100
}

export function dbToGain(db: number): number {
  return db === -Infinity ? 0 : 10 ** (db / 20)
}

export function gainToDbfs(gain: number): number {
  return gain > 0 ? 20 * Math.log10(gain) : -Infinity
}

export function percentToGain(percent: number, rangeDb: number): number {
  return dbToGain(percentToDb(percent, rangeDb))
}

/** 검사 출력 레벨(%) → 사인파 피크 진폭 */
export function relativeLevelToPeak(percent: number): number {
  return MAX_PEAK_AMPLITUDE * percentToGain(percent, TEST_LEVEL_RANGE_DB)
}

/** 자극음 마스터 볼륨(%) → 배율 */
export function masterToGain(percent: number): number {
  return percentToGain(percent, MASTER_RANGE_DB)
}

/* ------------------------------------------------------------------ */
/* Calibration                                                          */
/* ------------------------------------------------------------------ */

export function referenceDbfs(
  profile: CalibrationProfile | null,
  ear: Ear,
  frequency: number,
): number | null {
  const v = profile?.referenceDbfs[ear]?.[frequency]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function isCalibratedFor(
  profile: CalibrationProfile | null,
  ear: Ear,
  frequency: number,
): boolean {
  return referenceDbfs(profile, ear, frequency) !== null
}

/** 교정표 기준, 최대 피크 진폭 안에서 낼 수 있는 가장 큰 dB HL (5 dB 단위로 내림) */
export function maxPresentableHl(
  profile: CalibrationProfile | null,
  ear: Ear,
  frequency: number,
): number | null {
  const ref = referenceDbfs(profile, ear, frequency)
  if (ref === null) return null
  return Math.floor((gainToDbfs(MAX_PEAK_AMPLITUDE) - ref) / 5) * 5
}

/** dB HL → 피크 진폭. 교정값이 없거나 최대 출력을 넘으면 null */
export function hlToPeak(
  hl: number,
  profile: CalibrationProfile | null,
  ear: Ear,
  frequency: number,
): number | null {
  const ref = referenceDbfs(profile, ear, frequency)
  if (ref === null) return null
  const gain = dbToGain(ref + hl)
  return gain <= MAX_PEAK_AMPLITUDE + 1e-9 ? gain : null
}

export interface PresentationGains {
  left: number
  right: number
  /** 제시할 수 없는 이유 (있으면 재생하지 않음) */
  error: string | null
}

const EAR_KO: Record<Ear, string> = { L: '왼쪽 귀', R: '오른쪽 귀' }
const hz = (f: number) => `${f.toLocaleString('ko-KR')} Hz`

/**
 * 현재 레벨·단위·귀 선택으로 좌우 채널 진폭을 계산합니다.
 * 이 함수가 '레벨 → 실제 신호' 변환의 유일한 관문입니다.
 */
export function computePresentationGains(
  level: number,
  unit: ThresholdUnit,
  ears: EarSelection,
  frequency: number,
  profile: CalibrationProfile | null,
): PresentationGains {
  const wantL = ears === 'L' || ears === 'both'
  const wantR = ears === 'R' || ears === 'both'

  if (unit === 'relative') {
    const g = relativeLevelToPeak(level)
    return { left: wantL ? g : 0, right: wantR ? g : 0, error: null }
  }

  const result: PresentationGains = { left: 0, right: 0, error: null }
  const targets: Ear[] = [...(wantL ? (['L'] as const) : []), ...(wantR ? (['R'] as const) : [])]
  for (const ear of targets) {
    if (!isCalibratedFor(profile, ear, frequency)) {
      return { left: 0, right: 0, error: `${EAR_KO[ear]} ${hz(frequency)} 교정값이 없어 dB HL로 제시할 수 없습니다.` }
    }
    const g = hlToPeak(level, profile, ear, frequency)
    if (g === null) {
      const max = maxPresentableHl(profile, ear, frequency)
      return {
        left: 0,
        right: 0,
        error: `${EAR_KO[ear]} ${hz(frequency)}는 이 장비에서 최대 ${max} dB HL까지만 제시할 수 있습니다.`,
      }
    }
    if (ear === 'L') result.left = g
    else result.right = g
  }
  return result
}
