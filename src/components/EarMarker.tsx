import type { EarSelection } from '../types/audiometry'

/** Audiogram 관례 기호: 오른쪽 O(빨강), 왼쪽 X(파랑) */
export function EarMarker({ ear, size = 16 }: { ear: EarSelection; size?: number }) {
  const r = size / 2
  const circle = (
    <circle cx={r} cy={r} r={r - 2.2} fill="none" stroke="var(--ear-right)" strokeWidth={2.2} />
  )
  const cross = (
    <g stroke="var(--ear-left)" strokeWidth={2.4} strokeLinecap="round">
      <line x1={3} y1={3} x2={size - 3} y2={size - 3} />
      <line x1={size - 3} y1={3} x2={3} y2={size - 3} />
    </g>
  )
  if (ear === 'both') {
    return (
      <span className="ear-marker ear-marker--both" aria-hidden="true">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{cross}</svg>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{circle}</svg>
      </span>
    )
  }
  return (
    <svg className="ear-marker" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {ear === 'R' ? circle : cross}
    </svg>
  )
}
