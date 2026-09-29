/** 검사 대상 귀. 기록은 항상 한쪽 귀 단위로 합니다. */
export type Ear = 'L' | 'R'

/** 검사음을 보낼 귀. 'both'는 제시만 가능하고 역치 기록에는 쓰지 않습니다. */
export type EarSelection = Ear | 'both'

/**
 * 역치 기록 단위.
 * - relative: 비교정 환경의 상대역치(출력 레벨 %). 같은 장비·같은 설정 안에서만 비교할 수 있습니다.
 * - dBHL: 교정 프로필이 적용된 경우에만 사용합니다.
 */
export type ThresholdUnit = 'relative' | 'dBHL'

/** 주파수(Hz) → 역치. 비어 있으면 null. */
export type ThresholdMap = Record<number, number | null>

export interface EarThresholds {
  L: ThresholdMap
  R: ThresholdMap
}

export interface AudiometryResult {
  unit: ThresholdUnit
  thresholds: EarThresholds
  /** dB HL 기록 시 사용한 교정 프로필 id */
  calibrationProfileId: string | null
}

export type PlayMode = 'hold' | 'timed'

/** 검사상 상대적으로 역치가 높은 주파수 (치료 주파수가 아님) */
export interface RankedFrequency {
  frequency: number
  value: number
  /** 1부터 시작하는 순위. 같은 값은 같은 순위(1, 2, 2, 4 …) */
  rank: number
}

export interface VulnerabilityReport {
  L: RankedFrequency[]
  R: RankedFrequency[]
}

export type StaircaseResponse = 'heard' | 'notHeard'

export interface StaircaseTrial {
  level: number
  response: StaircaseResponse
  /** 직전 반응이 '안 들림'이었던 뒤의 제시(상승 제시)인지 */
  ascending: boolean
}

/** 간이 검사 모드(들림/안 들림)의 귀·주파수별 진행 상태 */
export interface StaircaseState {
  trials: StaircaseTrial[]
  /** 레벨별 상승 제시에서 '들림' 횟수 */
  ascendingHits: Record<number, number>
  /** 자동 판정된 역치 (상승 제시에서 2회 반응한 가장 낮은 레벨) */
  threshold: number | null
}
