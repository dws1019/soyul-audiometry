import { Lock, LockOpen, Minus, Plus, TriangleAlert } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { formatNumber } from '../utils/format'

interface Props {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  /** −/+ 버튼 한 번에 움직이는 양 (기본 step) */
  nudge?: number
  suffix: string
  /** 이 값 이상이면 경고 */
  warnAt: number
  /** 잠금 해제 전에는 이 값을 넘을 수 없음 */
  lockAbove: number
  unlocked: boolean
  onUnlockChange: (unlocked: boolean) => void
  /** 장비 한계 등 추가 상한 */
  hardMax?: number
  warning?: string
  hint?: ReactNode
  large?: boolean
}

/**
 * 안전장치가 있는 레벨 슬라이더.
 *  - 경고 구간(warnAt 이상)에서 경고 문구
 *  - 잠금 구간(lockAbove 초과)은 '고출력 허용'을 켜야 사용 가능
 */
export function LevelSlider({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  nudge = step,
  suffix,
  warnAt,
  lockAbove,
  unlocked,
  onUnlockChange,
  hardMax,
  warning,
  hint,
  large,
}: Props) {
  const ceiling = Math.min(hardMax ?? max, unlocked ? max : lockAbove)
  const set = (v: number) => {
    const snapped = Math.round(v / step) * step
    onChange(Math.max(min, Math.min(ceiling, snapped)))
  }
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  const style = {
    '--fill': `${pct(value)}%`,
    '--warn': `${pct(warnAt)}%`,
    '--lock': `${pct(Math.min(lockAbove, hardMax ?? max))}%`,
  } as CSSProperties
  const high = value >= warnAt
  const atLock = !unlocked && value >= Math.min(lockAbove, hardMax ?? max)

  return (
    <div className={`level${large ? ' level--lg' : ''}${high ? ' is-high' : ''}`}>
      <div className="level__head">
        <label htmlFor={id} className="level__label">
          {label}
        </label>
        <output htmlFor={id} className="level__value">
          {formatNumber(value)}
          <small>{suffix}</small>
        </output>
      </div>
      <div className="level__row">
        <button type="button" className="icon-btn" onClick={() => set(value - nudge)} aria-label={`${label} 낮추기`}>
          <Minus size={20} aria-hidden="true" />
        </button>
        <input
          id={id}
          type="range"
          className="level__range"
          min={min}
          max={max}
          step={step}
          value={value}
          style={style}
          onChange={(e) => set(Number(e.target.value))}
          aria-valuetext={`${formatNumber(value)} ${suffix}`}
        />
        <button type="button" className="icon-btn" onClick={() => set(value + nudge)} aria-label={`${label} 높이기`}>
          <Plus size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="level__meta">
        <label className="lock-toggle">
          <input type="checkbox" checked={unlocked} onChange={(e) => onUnlockChange(e.target.checked)} />
          {unlocked ? <LockOpen size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
          <span>
            고출력 허용 ({formatNumber(lockAbove)} {suffix} 초과)
          </span>
        </label>
        {hint && <span className="level__hint">{hint}</span>}
      </div>
      {(high || atLock) && (
        <p className="notice notice--attention" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>
            {high
              ? warning ?? '높은 출력입니다. 헤드폰 착용 전 음량을 확인하세요.'
              : `잠금 상한(${formatNumber(lockAbove)} ${suffix})입니다. 더 높이려면 '고출력 허용'을 켜세요.`}
          </span>
        </p>
      )}
    </div>
  )
}
