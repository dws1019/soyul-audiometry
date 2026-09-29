import { STIMULUS_FREQ_MAX, STIMULUS_FREQ_MIN } from '../config/constants'

export interface FrequencyValidation {
  value: number | null
  error: string | null
  /** 재생은 가능하지만 알려 둘 점 */
  warning: string | null
}

export function nyquist(sampleRate: number): number {
  return sampleRate / 2
}

/** 해당 샘플레이트에서 재생 가능한지 (나이퀴스트 주파수 미만). sampleRate가 아직 없으면 true */
export function isPlayableAt(frequency: number, sampleRate: number | null | undefined): boolean {
  return sampleRate == null || frequency < nyquist(sampleRate)
}

const fmt = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })

/**
 * Custom 주파수 입력 검증.
 * @param sampleRates 이 주파수를 재생·생성할 샘플레이트들 (파일 샘플레이트, 실시간 AudioContext 샘플레이트)
 */
export function validateStimulusFrequency(
  raw: string | number,
  sampleRates: ReadonlyArray<number | null | undefined>,
): FrequencyValidation {
  const text = String(raw).replace(/,/g, '').trim()
  if (text === '') return { value: null, error: '주파수를 입력하세요.', warning: null }
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return { value: null, error: '숫자로 입력하세요 (예: 4000).', warning: null }
  }
  const value = Number(text)
  if (!/^\d+(\.\d)?$/.test(text)) {
    return { value: null, error: '소수점은 첫째 자리까지 입력할 수 있습니다.', warning: null }
  }
  if (value < STIMULUS_FREQ_MIN || value > STIMULUS_FREQ_MAX) {
    return {
      value: null,
      error: `허용 범위는 ${fmt(STIMULUS_FREQ_MIN)} – ${fmt(STIMULUS_FREQ_MAX)} Hz입니다.`,
      warning: null,
    }
  }
  let warning: string | null = null
  for (const sr of sampleRates) {
    if (sr == null) continue
    if (value >= nyquist(sr)) {
      return {
        value: null,
        error: `샘플레이트 ${fmt(sr)} Hz에서는 나이퀴스트 주파수(${fmt(nyquist(sr))} Hz) 이상을 재생할 수 없습니다.`,
        warning: null,
      }
    }
    if (value > sr * 0.45) {
      warning = `샘플레이트 ${fmt(sr)} Hz의 상한에 가까워 재생 장치에 따라 소리가 약해질 수 있습니다.`
    }
  }
  return { value, error: null, warning }
}
