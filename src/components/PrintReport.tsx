import logo from '../assets/brand/soyul-lockup-compact.svg'
import { TEST_FREQUENCIES, TONE_GENERATOR_DISCLAIMER, UNCALIBRATED_WARNING, VULNERABLE_MEANING } from '../config/constants'
import type { TestSession } from '../types/patient'
import {
  EAR_LABEL,
  formatDateTime,
  formatDuration,
  formatHz,
  formatLevel,
  OUTPUT_MODE_LABEL,
  unitLongLabel,
  volumeRatio,
} from '../utils/format'
import { emphasisMap, emphasizedEntries } from '../utils/hearingAnalysis'
import { Audiogram } from './Audiogram'

/** 인쇄 전용 결과지 (화면에서는 숨김) */
export function PrintReport({ session }: { session: TestSession }) {
  const { patient, audiometry, stimulus: s } = session
  const unit = audiometry.unit
  const emphasis = emphasisMap(session.vulnerable)

  return (
    <div className="print-report" aria-hidden="true">
      <header className="print-report__head">
        <img src={logo} alt="" height={30} />
        <div>
          <h1>순음청력검사 결과 (검사 보조 기록)</h1>
          <p>
            환자 ID {patient.patientId || '—'} · 검사일 {patient.testDate} · 출력 {formatDateTime(new Date().toISOString())}
          </p>
        </div>
      </header>

      <div className="print-report__grid">
        <Audiogram
          thresholds={audiometry.thresholds}
          unit={unit}
          frequencies={TEST_FREQUENCIES}
          emphasis={emphasis}
          interactive={false}
          caption={`검사일 ${patient.testDate} · 소율한의원`}
        />
        <table className="print-table">
          <thead>
            <tr>
              <th>주파수</th>
              <th>왼쪽 (X)</th>
              <th>오른쪽 (O)</th>
            </tr>
          </thead>
          <tbody>
            {TEST_FREQUENCIES.map((f) => (
              <tr key={f}>
                <th>{formatHz(f)}</th>
                <td>{formatLevel(audiometry.thresholds.L[f], unit)}</td>
                <td>{formatLevel(audiometry.thresholds.R[f], unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="print-report__note">
        기록 단위: {unitLongLabel(unit)}. {unit === 'relative' ? UNCALIBRATED_WARNING : ''}
      </p>

      <h2>취약 주파수 ({VULNERABLE_MEANING})</h2>
      <ul>
        {(['L', 'R'] as const).map((ear) => {
          const top = emphasizedEntries(session.vulnerable[ear])
          return (
            <li key={ear}>
              {EAR_LABEL[ear]}:{' '}
              {top.length ? top.map((r) => `${r.rank}위 ${formatHz(r.frequency)} (${formatLevel(r.value, unit)})`).join(', ') : '—'}
            </li>
          )
        })}
      </ul>

      <h2>개인별 음향자극음 (의료진 선택 주파수)</h2>
      <ul>
        <li>
          출력 방식: {OUTPUT_MODE_LABEL[s.outputMode]} ·{' '}
          {s.outputMode === 'split'
            ? `왼쪽 ${formatHz(s.freqA)} + ${formatHz(s.freqB)} (${volumeRatio(s.volumeA, s.volumeB)}), 오른쪽 ${formatHz(s.freqC)} + ${formatHz(s.freqD)} (${volumeRatio(s.volumeC, s.volumeD)})`
            : `${formatHz(s.freqA)} + ${formatHz(s.freqB)} (A:B ${volumeRatio(s.volumeA, s.volumeB)})`}
        </li>
        <li>
          재생 시간 {formatDuration(s.durationSec)} · 마스터 {s.masterVolume}% · {s.format.toUpperCase()}
        </li>
        {session.stimulusLog.length > 0 && <li>생성한 음원: {session.stimulusLog.map((r) => r.fileName).join(', ')}</li>}
      </ul>

      {patient.memo && (
        <>
          <h2>의료진 메모</h2>
          <p className="print-report__memo">{patient.memo}</p>
        </>
      )}

      <p className="print-report__foot">{TONE_GENERATOR_DISCLAIMER}</p>
    </div>
  )
}
