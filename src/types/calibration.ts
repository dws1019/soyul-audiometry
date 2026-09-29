import type { Ear } from './audiometry'

/**
 * 측정 모드.
 * - relative: 비교정. 출력 레벨은 0–100 %로만 표시하며 dB HL/SPL로 환산하지 않습니다.
 * - calibrated: 장비별 교정 프로필이 있을 때만. 교정값이 있는 귀·주파수에서만 dB HL로 제시·기록합니다.
 */
export type MeasurementMode = 'relative' | 'calibrated'

/**
 * 장비(PC·오디오 인터페이스·헤드폰) 조합 하나에 대한 교정표.
 *
 * referenceDbfs[ear][frequency] = 이 조합에서 0 dB HL에 해당하는 디지털 사인파 피크 레벨(dBFS).
 * 교정된 인공귀(artificial ear)와 음압계로 측정한 값을 넣어야 하며,
 * 운영체제 볼륨·오디오 드라이버 설정이 측정 당시와 같아야만 유효합니다.
 *
 *   제시 레벨(dBFS) = referenceDbfs + 목표 dB HL
 */
export interface CalibrationProfile {
  id: string
  name: string
  /** 예: 'TDH-39', 'DD45', 'HDA 300' */
  transducer: string
  /** 측정 일자 (YYYY-MM-DD) */
  measuredAt: string
  /** 측정자·장비 일련번호·OS 볼륨 설정 등 */
  notes: string
  referenceDbfs: Record<Ear, Record<number, number | null>>
}

export interface AppSettings {
  measurementMode: MeasurementMode
  calibration: CalibrationProfile | null
  educationOpen: boolean
}
