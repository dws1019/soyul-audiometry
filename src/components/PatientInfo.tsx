import { FilePlus, FolderOpen, Printer, Save, ShieldAlert } from 'lucide-react'
import type { PatientInfo as Patient } from '../types/patient'

interface Props {
  patient: Patient
  onChange: (patch: Partial<Patient>) => void
  knownPatientIds: string[]
  /** 같은 환자 ID로 저장된 이전 검사 수 */
  previousCount: number
  dirty: boolean
  savedLabel: string | null
  onNew: () => void
  onSave: () => void
  onPrint: () => void
  onShowHistory: () => void
}

/** 환자 선택/등록 — 개인식별정보는 받지 않고 원내 ID·날짜·메모만 */
export function PatientInfo({
  patient,
  onChange,
  knownPatientIds,
  previousCount,
  dirty,
  savedLabel,
  onNew,
  onSave,
  onPrint,
  onShowHistory,
}: Props) {
  return (
    <section className="card patient" aria-labelledby="patient-title">
      <div className="card__head">
        <div>
          <p className="eyebrow">PATIENT SESSION</p>
          <h2 id="patient-title" className="card__title">
            환자 · 검사 세션
          </h2>
        </div>
        <div className="patient__save-state" aria-live="polite">
          {dirty ? (
            <span className="tag tag--pending">저장하지 않은 변경</span>
          ) : savedLabel ? (
            <span className="tag">저장됨 {savedLabel}</span>
          ) : null}
        </div>
      </div>

      <div className="patient__grid">
        <div className="field">
          <label htmlFor="patient-id">환자 ID</label>
          <input
            id="patient-id"
            type="text"
            list="patient-id-list"
            autoComplete="off"
            maxLength={60}
            placeholder="예: 차트번호 A-1023"
            value={patient.patientId}
            onChange={(e) => onChange({ patientId: e.target.value })}
          />
          <datalist id="patient-id-list">
            {knownPatientIds.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
          {patient.patientId && previousCount > 0 && (
            <button type="button" className="link-btn" onClick={onShowHistory}>
              <FolderOpen size={16} aria-hidden="true" />이 환자의 이전 검사 {previousCount}건 보기
            </button>
          )}
        </div>
        <div className="field">
          <label htmlFor="test-date">검사 날짜</label>
          <input
            id="test-date"
            type="date"
            value={patient.testDate}
            onChange={(e) => onChange({ testDate: e.target.value })}
          />
        </div>
        <div className="field field--wide">
          <label htmlFor="memo">의료진 메모</label>
          <textarea
            id="memo"
            rows={2}
            maxLength={4000}
            placeholder="검사 조건, 헤드폰 종류, 환자 상태 등"
            value={patient.memo}
            onChange={(e) => onChange({ memo: e.target.value })}
          />
        </div>
      </div>

      <div className="patient__foot">
        <p className="patient__privacy">
          <ShieldAlert size={16} aria-hidden="true" />
          이름·주민등록번호는 입력하지 않습니다. 기록은 이 PC의 브라우저 안에만 저장되고 외부로 전송되지 않습니다.
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn--ghost" onClick={onNew}>
            <FilePlus size={18} aria-hidden="true" />새 검사
          </button>
          <button type="button" className="btn btn--ghost" onClick={onPrint}>
            <Printer size={18} aria-hidden="true" />
            결과 인쇄
          </button>
          <button type="button" className="btn btn--secondary" onClick={onSave}>
            <Save size={18} aria-hidden="true" />
            검사 저장
          </button>
        </div>
      </div>
    </section>
  )
}
