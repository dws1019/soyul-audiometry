import { ArrowRight, Check, ClipboardCheck, RotateCcw, X } from 'lucide-react'
import type { LevelScale } from '../config/constants'
import type { EarSelection, StaircaseState } from '../types/audiometry'
import { EAR_LABEL, formatHzShort, formatLevel, formatNumber } from '../utils/format'
import { EarMarker } from './EarMarker'

interface Props {
  ear: EarSelection
  frequency: number
  level: number
  scale: LevelScale
  staircase: StaircaseState | undefined
  recordedValue: number | null
  /** 기록할 수 없는 이유 (양쪽 선택, 단위 불일치 등) */
  blockedReason: string | null
  onHeard: () => void
  onNotHeard: () => void
  onRecordCurrent: () => void
  onReset: () => void
  nextFrequency: number | null
  onNext: () => void
}

/** 들림 / 안 들림 버튼으로 레벨을 조절하는 간이 검사 모드 */
export function SimpleTestMode(p: Props) {
  const trials = p.staircase?.trials ?? []
  const disabled = p.blockedReason !== null

  return (
    <div className="simple-test" aria-labelledby="simple-test-title">
      <div className="simple-test__head">
        <h3 id="simple-test-title">간이 검사 모드</h3>
        <span className="simple-test__target">
          {p.ear !== 'both' && <EarMarker ear={p.ear} size={14} />}
          {p.ear === 'both' ? '양쪽' : EAR_LABEL[p.ear]} · {formatHzShort(p.frequency)}
        </span>
      </div>
      <p className="simple-test__rule" title="올라가며 제시한 같은 레벨에서 2회 들리면 그 레벨을 역치로 자동 기록합니다.">
        상승 제시에서 같은 레벨 2회 반응 → 역치 자동 기록
      </p>

      {p.blockedReason && <p className="notice notice--muted">{p.blockedReason}</p>}

      <div className="simple-test__answers">
        <button type="button" className="answer-btn answer-btn--yes" onClick={p.onHeard} disabled={disabled} aria-keyshortcuts="H">
          <Check size={22} aria-hidden="true" />
          <span>
            들림 <small>−{p.scale.stepDown}</small>
          </span>
          <kbd>H</kbd>
        </button>
        <button type="button" className="answer-btn answer-btn--no" onClick={p.onNotHeard} disabled={disabled} aria-keyshortcuts="N">
          <X size={22} aria-hidden="true" />
          <span>
            안 들림 <small>+{p.scale.stepUp}</small>
          </span>
          <kbd>N</kbd>
        </button>
      </div>

      {trials.length > 0 && (
        <ol className="trail" aria-label="반응 기록">
          {trials.slice(-12).map((t, i) => (
            <li key={i} className={t.response === 'heard' ? 'is-yes' : 'is-no'} title={t.ascending ? '상승 제시' : undefined}>
              {formatNumber(t.level)}
              <span aria-label={t.response === 'heard' ? '들림' : '안 들림'}>{t.response === 'heard' ? '✓' : '✕'}</span>
              {t.ascending && <span className="trail__asc">↑</span>}
            </li>
          ))}
        </ol>
      )}

      <div className="simple-test__record">
        <span>
          기록된 역치 <strong>{formatLevel(p.recordedValue, p.scale.unit)}</strong>
        </span>
        <div className="btn-row">
          <button type="button" className="btn btn--ghost btn--sm" onClick={p.onReset} disabled={trials.length === 0}>
            <RotateCcw size={16} aria-hidden="true" />
            다시 시작
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={p.onRecordCurrent} disabled={disabled}>
            <ClipboardCheck size={16} aria-hidden="true" />
            현재 레벨({formatNumber(p.level)} {p.scale.suffix})로 기록
          </button>
          {p.nextFrequency !== null && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={p.onNext}>
              다음 {formatHzShort(p.nextFrequency)}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
