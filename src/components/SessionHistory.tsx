import { FileBraces, FileSpreadsheet, FolderOpen, Trash, Upload } from 'lucide-react'
import { useRef } from 'react'
import type { TestSession } from '../types/patient'
import { formatDateTime, formatHzShort } from '../utils/format'
import { emphasizedEntries } from '../utils/hearingAnalysis'

interface Props {
  sessions: TestSession[]
  filter: string
  onFilterChange: (v: string) => void
  currentId: string
  onLoad: (s: TestSession) => void
  onDelete: (s: TestSession) => void
  onExportJson: (list: TestSession[]) => void
  onExportCsv: (list: TestSession[]) => void
  onImport: (file: File) => void
}

function topText(s: TestSession, ear: 'L' | 'R'): string {
  const top = emphasizedEntries(s.vulnerable[ear])
  return top.length ? top.map((r) => formatHzShort(r.frequency)).join(', ') : '—'
}

/** 이전 검사 불러오기 · 내보내기 · 가져오기 */
export function SessionHistory(p: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const q = p.filter.trim().toLowerCase()
  const list = [...p.sessions]
    .filter((s) => !q || s.patient.patientId.toLowerCase().includes(q) || s.patient.testDate.includes(q))
    .sort((a, b) => b.patient.testDate.localeCompare(a.patient.testDate) || b.updatedAt.localeCompare(a.updatedAt))

  return (
    <section className="card history" aria-labelledby="history-title">
      <div className="card__head">
        <div>
          <p className="eyebrow">RECORDS</p>
          <h2 id="history-title" className="card__title">
            검사 기록
          </h2>
          <p className="card__sub">저장한 검사 {p.sessions.length}건 · 이 브라우저에만 보관</p>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => p.onExportJson(list)} disabled={!list.length}>
            <FileBraces size={16} aria-hidden="true" />
            JSON 내보내기
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => p.onExportCsv(list)} disabled={!list.length}>
            <FileSpreadsheet size={16} aria-hidden="true" />
            CSV 내보내기
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
            <Upload size={16} aria-hidden="true" />
            JSON 가져오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) p.onImport(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <div className="history__filter field">
        <label htmlFor="history-filter">환자 ID 또는 날짜로 찾기</label>
        <input
          id="history-filter"
          type="search"
          value={p.filter}
          placeholder="예: A-1023 또는 2026-09"
          onChange={(e) => p.onFilterChange(e.target.value)}
        />
      </div>

      {list.length === 0 ? (
        <p className="empty">{p.sessions.length ? '조건에 맞는 기록이 없습니다.' : "아직 저장한 검사가 없습니다. 위에서 '검사 저장'을 누르면 여기에 쌓입니다."}</p>
      ) : (
        <div className="table-scroll">
          <table className="history__table">
            <thead>
              <tr>
                <th scope="col">검사 날짜</th>
                <th scope="col">환자 ID</th>
                <th scope="col">단위</th>
                <th scope="col">취약 주파수 L</th>
                <th scope="col">취약 주파수 R</th>
                <th scope="col">자극음 설정</th>
                <th scope="col">생성 음원</th>
                <th scope="col">저장 시각</th>
                <th scope="col">
                  <span className="sr-only">작업</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className={s.id === p.currentId ? 'is-current' : undefined}>
                  <td>{s.patient.testDate}</td>
                  <td>{s.patient.patientId || <span className="muted">(ID 없음)</span>}</td>
                  <td>{s.audiometry.unit === 'dBHL' ? 'dB HL' : '%'}</td>
                  <td>{topText(s, 'L')}</td>
                  <td>{topText(s, 'R')}</td>
                  <td>
                    {s.stimulus.outputMode === 'split'
                      ? `L ${formatHzShort(s.stimulus.freqA)}+${formatHzShort(s.stimulus.freqB)} / R ${formatHzShort(s.stimulus.freqC)}+${formatHzShort(s.stimulus.freqD)}`
                      : `${formatHzShort(s.stimulus.freqA)} + ${formatHzShort(s.stimulus.freqB)}`}
                  </td>
                  <td>{s.stimulusLog.length}건</td>
                  <td>{formatDateTime(s.updatedAt)}</td>
                  <td className="history__actions">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => p.onLoad(s)}>
                      <FolderOpen size={16} aria-hidden="true" />
                      불러오기
                    </button>
                    <button type="button" className="icon-btn" onClick={() => p.onDelete(s)} aria-label={`${s.patient.testDate} 기록 삭제`}>
                      <Trash size={18} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
