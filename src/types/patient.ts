import type { AudiometryResult, VulnerabilityReport } from './audiometry'
import type { StimulusRecord, StimulusSettings } from './stimulus'

/**
 * 환자 식별 정보는 최소한으로만 둡니다.
 * 이름·주민등록번호·연락처 필드는 의도적으로 두지 않았습니다.
 */
export interface PatientInfo {
  /** 차트 번호 등 원내 식별자 (선택) */
  patientId: string
  /** 검사 날짜 YYYY-MM-DD */
  testDate: string
  /** 의료진 메모 */
  memo: string
}

export interface TestSession {
  id: string
  schemaVersion: 1
  patient: PatientInfo
  createdAt: string
  updatedAt: string
  audiometry: AudiometryResult
  /** 저장 시점의 취약 주파수 분석 스냅샷 */
  vulnerable: VulnerabilityReport
  /** 의료진이 선택한 음향자극 설정 */
  stimulus: StimulusSettings
  /** 생성한 음원 기록 */
  stimulusLog: StimulusRecord[]
}
