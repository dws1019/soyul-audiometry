import { Eraser } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { LevelScale } from '../config/constants'
import type { Ear, EarSelection, EarThresholds } from '../types/audiometry'
import { EAR_LABEL, formatHz, formatNumber } from '../utils/format'
import { emphasisKey, fourFrequencyAverage } from '../utils/hearingAnalysis'
import { EarMarker } from './EarMarker'

interface Props {
  frequencies: readonly number[]
  thresholds: EarThresholds
  scale: LevelScale
  selectedFrequency: number
  selectedEar: EarSelection
  emphasis: Map<string, number>
  /** 기록 단위와 현재 측정 모드가 다를 때 등 */
  notice: string | null
  onChange: (ear: Ear, frequency: number, value: number | null) => void
  onSelectFrequency: (frequency: number) => void
  onClear: () => void
}

function ThresholdInput({
  value,
  scale,
  label,
  onCommit,
  onFocus,
}: {
  value: number | null
  scale: LevelScale
  label: string
  onCommit: (v: number | null) => void
  onFocus: () => void
}) {
  const [text, setText] = useState(value === null ? '' : String(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(value === null ? '' : String(value))
  }, [value])

  const parse = (t: string): number | null | undefined => {
    if (t.trim() === '') return null
    const n = Number(t)
    return Number.isFinite(n) ? n : undefined
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      className="threshold-input"
      aria-label={label}
      min={scale.min}
      max={scale.max}
      step={scale.step}
      value={text}
      placeholder="—"
      onFocus={() => {
        focused.current = true
        onFocus()
      }}
      onChange={(e) => {
        setText(e.target.value)
        const n = parse(e.target.value)
        if (n === null) onCommit(null)
        else if (n !== undefined && n >= scale.min && n <= scale.max) onCommit(n)
      }}
      onBlur={() => {
        focused.current = false
        const n = parse(text)
        if (n === undefined || n === null) {
          setText(value === null ? '' : String(value))
          return
        }
        const clamped = Math.max(scale.min, Math.min(scale.max, n))
        setText(String(clamped))
        onCommit(clamped)
      }}
    />
  )
}

/** 좌우 귀 검사 결과 입력표 */
export function HearingResultTable(p: Props) {
  const unitText = p.scale.unit === 'dBHL' ? 'dB HL' : '상대역치 %'
  const ears: Ear[] = ['L', 'R']

  return (
    <section className="card results" aria-labelledby="results-title">
      <div className="card__head card__head--tight">
        <div>
          <h2 id="results-title" className="card__title">
            검사 결과 기록 <span className="card__unit">{unitText}</span>
          </h2>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={p.onClear}>
          <Eraser size={16} aria-hidden="true" />
          결과 초기화
        </button>
      </div>

      {p.notice && <p className="notice notice--attention">{p.notice}</p>}

      <table className="results__table">
        <thead>
          <tr>
            <th scope="col">Frequency</th>
            {ears.map((ear) => (
              <th key={ear} scope="col" className={`results__ear results__ear--${ear}`}>
                <EarMarker ear={ear} size={14} />
                {ear === 'L' ? 'Left' : 'Right'}
                <small>{EAR_LABEL[ear]}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.frequencies.map((f) => (
            <tr key={f} className={p.selectedFrequency === f ? 'is-selected' : undefined}>
              <th scope="row">
                <button type="button" className="results__freq" onClick={() => p.onSelectFrequency(f)}>
                  {formatHz(f)}
                </button>
              </th>
              {ears.map((ear) => {
                const rank = p.emphasis.get(emphasisKey(ear, f))
                const active = p.selectedFrequency === f && (p.selectedEar === ear || p.selectedEar === 'both')
                return (
                  <td key={ear} className={`${active ? 'is-active' : ''}${rank ? ' is-emphasized' : ''}`}>
                    <div className="results__cell">
                      <ThresholdInput
                        value={p.thresholds[ear][f] ?? null}
                        scale={p.scale}
                        label={`${EAR_LABEL[ear]} ${formatHz(f)} 역치 (${unitText})`}
                        onCommit={(v) => p.onChange(ear, f, v)}
                        onFocus={() => p.onSelectFrequency(f)}
                      />
                      {rank && <span className="rank-tag">{rank}위</span>}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        {p.scale.unit === 'dBHL' && (
          <tfoot>
            <tr>
              <th scope="row">4분법 평균</th>
              {ears.map((ear) => {
                const avg = fourFrequencyAverage(p.thresholds[ear])
                return <td key={ear}>{avg === null ? '—' : `${formatNumber(avg)} dB HL`}</td>
              })}
            </tr>
          </tfoot>
        )}
      </table>
      <p className="results__hint">
        {p.scale.unit === 'dBHL'
          ? '교정 모드: 값은 dB HL로 기록됩니다.'
          : '비교정 모드: 소리를 들은 가장 낮은 출력 레벨(%)을 상대역치로 기록합니다. 같은 장비·같은 설정에서만 비교할 수 있습니다.'}
      </p>
    </section>
  )
}
