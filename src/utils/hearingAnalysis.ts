/**
 * 검사 결과 분석.
 *
 * 여기서 계산하는 것은 '검사상 상대적으로 역치가 높은 주파수'의 순위뿐입니다.
 * 치료 주파수를 정하거나 추천하지 않으며, 음향자극 주파수는 의료진이 직접 선택합니다.
 */
import type { LevelScale } from '../config/constants'
import type {
  Ear,
  EarThresholds,
  RankedFrequency,
  StaircaseResponse,
  StaircaseState,
  ThresholdMap,
  VulnerabilityReport,
} from '../types/audiometry'

export function emptyThresholds(frequencies: readonly number[]): EarThresholds {
  const blank = (): ThresholdMap => Object.fromEntries(frequencies.map((f) => [f, null]))
  return { L: blank(), R: blank() }
}

/** 입력된 값만, 역치가 높은(=상대적으로 듣기 어려운) 순서로 정렬. 같은 값은 같은 순위. */
export function rankEar(map: ThresholdMap, frequencies: readonly number[]): RankedFrequency[] {
  const entered = frequencies
    .map((frequency) => ({ frequency, value: map[frequency] }))
    .filter((e): e is { frequency: number; value: number } => typeof e.value === 'number' && Number.isFinite(e.value))
    .sort((a, b) => b.value - a.value || a.frequency - b.frequency)

  return entered.map((e) => ({
    ...e,
    rank: 1 + entered.filter((o) => o.value > e.value).length,
  }))
}

export function analyzeHearing(
  thresholds: EarThresholds,
  frequencies: readonly number[],
): VulnerabilityReport {
  return { L: rankEar(thresholds.L, frequencies), R: rankEar(thresholds.R, frequencies) }
}

/**
 * Audiogram·표에서 강조할 항목 (귀별 1–2위).
 * 값이 2개 미만이거나, 그 귀의 최솟값과 같은 항목(=상대적으로 높지 않음)은 강조하지 않습니다.
 */
export function emphasizedEntries(ranked: RankedFrequency[]): RankedFrequency[] {
  if (ranked.length < 2) return []
  const min = Math.min(...ranked.map((r) => r.value))
  return ranked.filter((r) => r.rank <= 2 && r.value > min)
}

export function emphasisKey(ear: Ear, frequency: number): string {
  return `${ear}:${frequency}`
}

export function emphasisMap(report: VulnerabilityReport): Map<string, number> {
  const map = new Map<string, number>()
  for (const ear of ['L', 'R'] as const) {
    for (const r of emphasizedEntries(report[ear])) map.set(emphasisKey(ear, r.frequency), r.rank)
  }
  return map
}

/** 4분법 평균 (500·1k·2k·4k Hz). 네 값이 모두 있어야 계산 */
export function fourFrequencyAverage(map: ThresholdMap): number | null {
  const vals = [500, 1000, 2000, 4000].map((f) => map[f])
  if (vals.some((v) => typeof v !== 'number')) return null
  return (vals as number[]).reduce((a, b) => a + b, 0) / 4
}

export function countEntered(thresholds: EarThresholds): number {
  return (['L', 'R'] as const).reduce(
    (n, ear) => n + Object.values(thresholds[ear]).filter((v) => typeof v === 'number').length,
    0,
  )
}

/* ------------------------------------------------------------------ */
/* 간이 검사 모드 (들림 / 안 들림)                                        */
/* ------------------------------------------------------------------ */

export function emptyStaircase(): StaircaseState {
  return { trials: [], ascendingHits: {}, threshold: null }
}

export interface StaircaseStep {
  next: StaircaseState
  nextLevel: number
  /** 이번 반응으로 새로 판정된 역치 */
  thresholdFound: number | null
}

/**
 * 수정 Hughson-Westlake 방식을 단순화한 단계:
 * - 들림 → stepDown만큼 내림, 안 들림 → stepUp만큼 올림
 * - '안 들림' 다음의 제시(상승 제시)에서 같은 레벨에 2회 '들림' → 그 레벨을 역치로 판정
 * 최종 기록 여부와 값은 의료진이 확인·수정합니다.
 */
export function applyStaircaseResponse(
  state: StaircaseState,
  level: number,
  response: StaircaseResponse,
  scale: LevelScale,
  maxLevel: number,
): StaircaseStep {
  const last = state.trials[state.trials.length - 1]
  const ascending = last?.response === 'notHeard'
  const trials = [...state.trials, { level, response, ascending }]
  const ascendingHits = { ...state.ascendingHits }
  let thresholdFound: number | null = null

  if (response === 'heard' && ascending) {
    ascendingHits[level] = (ascendingHits[level] ?? 0) + 1
    if (ascendingHits[level] >= 2) thresholdFound = level
  }

  const raw = response === 'heard' ? level - scale.stepDown : level + scale.stepUp
  const nextLevel = Math.max(scale.min, Math.min(maxLevel, raw))

  return {
    next: { trials, ascendingHits, threshold: thresholdFound ?? state.threshold },
    nextLevel,
    thresholdFound,
  }
}
