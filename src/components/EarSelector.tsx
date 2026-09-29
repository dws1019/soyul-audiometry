import type { EarSelection } from '../types/audiometry'
import { EarMarker } from './EarMarker'

interface Props {
  value: EarSelection
  onChange: (ear: EarSelection) => void
}

const OPTIONS: { value: EarSelection; label: string; letter: string; key: string }[] = [
  { value: 'L', label: '왼쪽 귀', letter: 'L', key: 'L' },
  { value: 'R', label: '오른쪽 귀', letter: 'R', key: 'R' },
  { value: 'both', label: '양쪽', letter: 'L+R', key: 'B' },
]

/** 검사 귀 선택 — 선택한 귀(스테레오 채널)로만 소리를 보냅니다. */
export function EarSelector({ value, onChange }: Props) {
  return (
    <div className="ear-selector" role="radiogroup" aria-label="검사 귀">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`ear-btn ear-btn--${o.value}${value === o.value ? ' is-active' : ''}`}
          onClick={() => onChange(o.value)}
          title={`${o.label} (키 ${o.key})`}
        >
          <EarMarker ear={o.value} size={20} />
          <span className="ear-btn__label">{o.label}</span>
          <span className="ear-btn__letter">{o.letter}</span>
        </button>
      ))}
    </div>
  )
}
