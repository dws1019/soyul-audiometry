import { Info } from 'lucide-react'
import { VULNERABLE_MEANING } from '../config/constants'
import type { Ear, ThresholdUnit, VulnerabilityReport } from '../types/audiometry'
import type { OutputMode } from '../types/stimulus'
import { EAR_LABEL, formatHz, formatLevel } from '../utils/format'
import { emphasizedEntries } from '../utils/hearingAnalysis'
import { EarMarker } from './EarMarker'

export type StimulusSlot = 'A' | 'B' | 'C' | 'D'

interface Props {
  report: VulnerabilityReport
  unit: ThresholdUnit
  outputMode: OutputMode
  onAssign: (slot: StimulusSlot, frequency: number) => void
}

/**
 * 취약 주파수 — 귀별로 역치가 높은 순서.
 * '검사상 상대적으로 역치가 높은 주파수'라는 의미로만 표시하며,
 * 음향자극 주파수는 의료진이 버튼을 눌러 직접 지정합니다(자동 지정 없음).
 */
export function VulnerableFrequencyPanel({ report, unit, outputMode, onAssign }: Props) {
  const slots: StimulusSlot[] = outputMode === 'split' ? ['A', 'B', 'C', 'D'] : ['A', 'B']
  const order: Ear[] = ['L', 'R']

  return (
    <section className="card vulnerable" aria-labelledby="vulnerable-title">
      <div className="card__head">
        <div>
          <p className="eyebrow">ANALYSIS</p>
          <h2 id="vulnerable-title" className="card__title">
            취약 주파수
          </h2>
          <p className="card__sub">{VULNERABLE_MEANING} · 검사 결과 참고</p>
        </div>
      </div>

      <div className="vulnerable__grid">
        {order.map((ear) => {
          const ranked = report[ear]
          const top = new Set(emphasizedEntries(ranked).map((r) => r.frequency))
          return (
            <div key={ear} className={`vulnerable__ear vulnerable__ear--${ear}`}>
              <h3>
                <EarMarker ear={ear} size={16} />
                {EAR_LABEL[ear]}
              </h3>
              {ranked.length === 0 ? (
                <p className="empty">입력된 결과가 없습니다.</p>
              ) : (
                <>
                  {ranked.length < 2 && <p className="empty">비교하려면 2개 이상의 주파수 결과가 필요합니다.</p>}
                  <ol className="rank-list">
                    {ranked.map((r) => (
                      <li key={r.frequency} className={top.has(r.frequency) ? 'is-top' : undefined}>
                        <span className="rank-list__rank">{r.rank}위</span>
                        <span className="rank-list__freq">{formatHz(r.frequency)}</span>
                        <span className="rank-list__val">{formatLevel(r.value, unit)}</span>
                        <span className="rank-list__assign" role="group" aria-label={`${formatHz(r.frequency)}를 자극음 주파수로 지정`}>
                          {slots.map((s) => (
                            <button
                              key={s}
                              type="button"
                              className="slot-btn"
                              onClick={() => onAssign(s, r.frequency)}
                              title={`의료진 선택: 주파수 ${s}에 ${formatHz(r.frequency)} 지정`}
                            >
                              {s}
                            </button>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          )
        })}
      </div>

      <p className="notice notice--muted">
        <Info size={18} aria-hidden="true" />
        <span>
          이 목록은 입력된 검사 주파수만 비교한 결과이며, 치료 주파수를 정하지 않습니다. 음향자극 주파수는 의료진이 검사
          결과와 환자 상태를 검토한 뒤 직접 선택합니다. (A·B 버튼은 선택을 빠르게 옮겨 적는 기능입니다.)
        </span>
      </p>
    </section>
  )
}
