import type { PointerEvent } from 'react'
import type { EarThresholds, PlayMode, ThresholdUnit } from '../types/audiometry'
import { formatHz, formatHzShort, formatNumber } from '../utils/format'
import { isPlayableAt } from '../utils/frequencyValidation'
import { EarMarker } from './EarMarker'

interface Props {
  frequencies: readonly number[]
  selected: number
  playingFrequency: number | null
  thresholds: EarThresholds
  unit: ThresholdUnit
  playMode: PlayMode
  sampleRate: number | null
  onTimed: (frequency: number) => void
  onHoldStart: (frequency: number) => void
  onHoldEnd: () => void
}

/** 6개의 큰 주파수 버튼. 누르면 해당 주파수 순음을 발생시킵니다. */
export function FrequencyPanel({
  frequencies,
  selected,
  playingFrequency,
  thresholds,
  unit,
  playMode,
  sampleRate,
  onTimed,
  onHoldStart,
  onHoldEnd,
}: Props) {
  const hold = playMode === 'hold'
  const end = () => {
    if (hold) onHoldEnd()
  }

  return (
    <section className="card freq-panel" aria-labelledby="freq-title">
      <div className="card__head card__head--tight">
        <div>
          <h2 id="freq-title" className="card__title">
            검사 주파수
          </h2>
        </div>
      </div>
      <p className="freq-panel__hint">
        {hold ? '버튼을 누르고 있는 동안 소리가 납니다' : '누르면 1초 동안 소리가 납니다'}
      </p>
      <div className="freq-panel__list">
        {frequencies.map((f, i) => {
          const playable = isPlayableAt(f, sampleRate)
          const playing = playingFrequency === f
          const isSelected = selected === f
          const l = thresholds.L[f]
          const r = thresholds.R[f]
          return (
            <button
              key={f}
              type="button"
              className={`freq-btn${isSelected ? ' is-selected' : ''}${playing ? ' is-playing' : ''}`}
              disabled={!playable}
              aria-pressed={isSelected}
              aria-label={`${formatHz(f)}${playing ? ', 재생 중' : ''}`}
              title={playable ? `${formatHz(f)} (키 ${i + 1})` : `현재 출력 장치 샘플레이트에서 ${formatHz(f)}를 재생할 수 없습니다`}
              onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
                if (!hold || e.button !== 0) return
                e.currentTarget.setPointerCapture(e.pointerId)
                onHoldStart(f)
              }}
              onPointerUp={end}
              onPointerCancel={end}
              onLostPointerCapture={end}
              onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => {
                // 1초 재생 모드, 또는 키보드(Enter)로 누른 경우
                if (!hold || e.detail === 0) onTimed(f)
              }}
            >
              <span className="freq-btn__key" aria-hidden="true">
                {i + 1}
              </span>
              <span className="freq-btn__main">
                <span className="freq-btn__label">{formatHzShort(f)}</span>
                <span className="freq-btn__sub">{playing ? '● 재생 중' : formatHz(f)}</span>
              </span>
              <span className="freq-btn__results" aria-hidden="true">
                <span>
                  <EarMarker ear="L" size={12} />
                  {typeof l === 'number' ? formatNumber(l) : '—'}
                </span>
                <span>
                  <EarMarker ear="R" size={12} />
                  {typeof r === 'number' ? formatNumber(r) : '—'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="freq-panel__unit">기록 단위: {unit === 'dBHL' ? 'dB HL' : '상대역치 %'}</p>
    </section>
  )
}
