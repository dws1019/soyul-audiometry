import type { ThresholdUnit } from '../types/audiometry'
import type { StimulusSettings } from '../types/stimulus'

/* ------------------------------------------------------------------ */
/* 검사 주파수                                                          */
/* ------------------------------------------------------------------ */

/**
 * 기본 검사 주파수(Hz). 이 배열만 바꾸면 버튼·결과표·Audiogram·분석이 함께 바뀝니다.
 * (예: 3000, 6000 Hz 추가 시 Audiogram은 로그 눈금이라 위치가 자동 계산됩니다.)
 */
export const TEST_FREQUENCIES: readonly number[] = [250, 500, 1000, 2000, 4000, 8000]

/** 임상에서 흔히 쓰는 검사 순서 (1 kHz부터 고음, 그다음 저음) — '다음 주파수' 버튼에 사용 */
export const CLINICAL_TEST_ORDER: readonly number[] = [1000, 2000, 4000, 8000, 500, 250]

/** 개인별 음향자극음 프리셋 주파수 */
export const STIMULUS_PRESET_FREQUENCIES: readonly number[] = [250, 500, 1000, 2000, 4000, 8000]

/** Custom 주파수 허용 범위 */
export const STIMULUS_FREQ_MIN = 125
export const STIMULUS_FREQ_MAX = 12000

/* ------------------------------------------------------------------ */
/* 신호 안전 · 레벨                                                      */
/* ------------------------------------------------------------------ */

/** 검사음 시작·종료 램프 (click/pop 방지, 20–50 ms 권장 범위 안) */
export const TONE_RAMP_SEC = 0.03

/** 긴급 정지 시 램프 — 순간 차단으로 인한 '딱' 소리만 막을 정도로 짧게 */
export const EMERGENCY_RAMP_SEC = 0.012

/** 재생 중 레벨을 바꿀 때 gain 변화의 시간 상수 (갑작스러운 음량 변화 방지) */
export const GAIN_SMOOTHING_SEC = 0.02

/** 디지털 출력의 최대 피크 진폭. 0 dBFS까지 쓰지 않고 여유를 둡니다. */
export const MAX_PEAK_AMPLITUDE = 0.9

/**
 * 검사 출력 레벨(%)의 눈금 범위. 100 % = MAX_PEAK_AMPLITUDE, 1 %마다 0.8 dB,
 * 0 % = 무음. (로그 눈금이어야 낮은 레벨에서도 세밀하게 조절됩니다.)
 * 화면에는 %만 표시하며 dB HL/SPL로 표시하지 않습니다.
 */
export const TEST_LEVEL_RANGE_DB = 80

/** 자극음 마스터 볼륨(%)의 눈금 범위. 100 % = 0 dB, 1 %마다 0.4 dB */
export const MASTER_RANGE_DB = 40

/** 자극음 합성: 상대 음량 50일 때 각 순음의 진폭 (A 0.35 + B 0.35 = 0.7) */
export const MIX_BASE_GAIN = 0.35

/** 자극음 합성: 한 채널 순음 진폭 합의 상한. 넘으면 비율을 유지한 채 전체를 줄입니다. */
export const MIX_PEAK_LIMIT = 0.9

export interface LevelScale {
  unit: ThresholdUnit
  min: number
  max: number
  step: number
  /** 최초 실행·단위 변경 시 시작 레벨 (낮게) */
  initial: number
  /** 이 값 이상이면 경고 표시 */
  warnAt: number
  /** 이 값을 넘으려면 '고출력 허용'을 켜야 함 */
  lockAbove: number
  /** 간이 검사 모드: 들림 → 내림 / 안 들림 → 올림 */
  stepDown: number
  stepUp: number
  suffix: string
}

export const RELATIVE_SCALE: LevelScale = {
  unit: 'relative',
  min: 0,
  max: 100,
  step: 1,
  initial: 20,
  warnAt: 70,
  lockAbove: 80,
  stepDown: 10,
  stepUp: 5,
  suffix: '%',
}

export const DBHL_SCALE: LevelScale = {
  unit: 'dBHL',
  min: -10,
  max: 120,
  step: 5,
  initial: 30,
  warnAt: 80,
  lockAbove: 90,
  stepDown: 10,
  stepUp: 5,
  suffix: 'dB HL',
}

export function scaleFor(unit: ThresholdUnit): LevelScale {
  return unit === 'dBHL' ? DBHL_SCALE : RELATIVE_SCALE
}

/** 자극음 마스터 볼륨 경고·잠금 */
export const MASTER_DEFAULT = 35
export const MASTER_WARN_AT = 70
export const MASTER_LOCK_ABOVE = 80

/* ------------------------------------------------------------------ */
/* 자극음 기본값                                                         */
/* ------------------------------------------------------------------ */

export const DURATION_PRESETS: ReadonlyArray<{ label: string; seconds: number }> = [
  { label: '30초', seconds: 30 },
  { label: '1분', seconds: 60 },
  { label: '5분', seconds: 300 },
  { label: '10분', seconds: 600 },
  { label: '30분', seconds: 1800 },
]

export const DURATION_MIN_SEC = 5
export const DURATION_MAX_SEC = 60 * 60

export const PREVIEW_SECONDS = 8

export const DEFAULT_STIMULUS: StimulusSettings = {
  freqA: 4000,
  freqB: 8000,
  freqC: 2000,
  freqD: 4000,
  volumeA: 50,
  volumeB: 50,
  volumeC: 50,
  volumeD: 50,
  masterVolume: MASTER_DEFAULT,
  outputMode: 'both',
  durationSec: 600,
  fadeSec: 3,
  sampleRate: 44100,
  format: 'wav',
  mp3Bitrate: 192,
}

/* ------------------------------------------------------------------ */
/* 문구                                                                 */
/* ------------------------------------------------------------------ */

export const UNCALIBRATED_WARNING =
  '비교정 장비에서는 출력 레벨(%)이 실제 dB HL 또는 dB SPL을 의미하지 않습니다.'

export const TONE_GENERATOR_DISCLAIMER =
  '본 프로그램의 음 발생 기능은 검사 보조 목적으로 설계되었습니다. 정확한 임상 청력역치(dB HL)를 측정하려면 교정된 청력검사 장비와 헤드폰이 필요합니다.'

export const VULNERABLE_MEANING = '검사상 상대적으로 역치가 높은 주파수'
