import { Hand, Info, Keyboard, Play, Settings2, Timer, TriangleAlert } from 'lucide-react'
import type { PointerEvent, ReactNode } from 'react'
import { UNCALIBRATED_WARNING, type LevelScale } from '../config/constants'
import type { EarSelection, PlayMode } from '../types/audiometry'
import type { MeasurementMode } from '../types/calibration'
import type { PlaybackState } from '../utils/audioEngine'
import { formatHz } from '../utils/format'
import { EarSelector } from './EarSelector'
import { LevelSlider } from './LevelSlider'
import { PlaybackStatus } from './PlaybackStatus'

interface Props {
  playback: PlaybackState
  selectedFrequency: number
  ear: EarSelection
  onEarChange: (ear: EarSelection) => void
  playMode: PlayMode
  onPlayModeChange: (mode: PlayMode) => void
  scale: LevelScale
  level: number
  onLevelChange: (level: number) => void
  /** 장비(교정표) 기준 최대 제시 레벨 */
  levelCeiling: number
  unlocked: boolean
  onUnlockChange: (unlocked: boolean) => void
  presentationError: string | null
  onHoldStart: () => void
  onHoldEnd: () => void
  onTimed: () => void
  measurementMode: MeasurementMode
  calibrationName: string | null
  onMeasurementModeChange: (mode: MeasurementMode) => void
  onOpenCalibration: () => void
  children?: ReactNode
}

/** 중앙 컨트롤 — 현재 검사 귀 / 출력 / 검사음 제시 */
export function ToneController(p: Props) {
  const hold = p.playMode === 'hold'
  const testPlaying = p.playback.playing && p.playback.kind === 'test'

  return (
    <section className="card tone-ctl" aria-labelledby="tone-title">
      <div className="card__head card__head--tight">
        <div>
          <h2 id="tone-title" className="card__title">
            검사음 컨트롤
          </h2>
        </div>
        <div className="segmented segmented--sm" role="radiogroup" aria-label="재생 방법">
          <button
            type="button"
            role="radio"
            aria-checked={hold}
            className={hold ? 'is-active' : ''}
            onClick={() => p.onPlayModeChange('hold')}
          >
            <Hand size={16} aria-hidden="true" />
            누르고 있는 동안 재생
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!hold}
            className={!hold ? 'is-active' : ''}
            onClick={() => p.onPlayModeChange('timed')}
          >
            <Timer size={16} aria-hidden="true" />1초 재생
          </button>
        </div>
      </div>

      <PlaybackStatus playback={p.playback} selectedFrequency={p.selectedFrequency} selectedEar={p.ear} />

      <div className="tone-ctl__block">
        <span className="block-label">검사 귀</span>
        <EarSelector value={p.ear} onChange={p.onEarChange} />
      </div>

      <LevelSlider
        id="test-level"
        label={p.scale.unit === 'dBHL' ? '제시 레벨 (dB HL · 교정표 적용)' : '출력 레벨'}
        value={p.level}
        onChange={p.onLevelChange}
        min={p.scale.min}
        max={p.scale.max}
        step={p.scale.step}
        nudge={5}
        suffix={p.scale.suffix}
        warnAt={p.scale.warnAt}
        lockAbove={p.scale.lockAbove}
        hardMax={p.levelCeiling}
        unlocked={p.unlocked}
        onUnlockChange={p.onUnlockChange}
        warning="높은 출력입니다. 환자에게 헤드폰을 씌우기 전에 음량을 확인하세요."
        hint="↑ ↓ 키 ±5"
        large
      />

      <p className="tone-ctl__caution">
        <Info size={16} aria-hidden="true" />
        <span>
          {p.scale.unit === 'relative' ? (
            UNCALIBRATED_WARNING
          ) : (
            <>
              교정표 <strong>{p.calibrationName || '이름 없음'}</strong> 기준. 운영체제 볼륨·오디오 장치·헤드폰이 교정
              당시와 같을 때만 유효합니다.
            </>
          )}
        </span>
      </p>

      {p.presentationError && (
        <p className="notice notice--attention" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>{p.presentationError}</span>
        </p>
      )}

      <button
        type="button"
        className={`present-btn${testPlaying ? ' is-playing' : ''}`}
        disabled={!!p.presentationError}
        onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
          if (!hold || e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          p.onHoldStart()
        }}
        onPointerUp={() => hold && p.onHoldEnd()}
        onPointerCancel={() => hold && p.onHoldEnd()}
        onLostPointerCapture={() => hold && p.onHoldEnd()}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => {
          if (!hold || e.detail === 0) p.onTimed()
        }}
        aria-keyshortcuts="Space"
      >
        <Play size={26} aria-hidden="true" />
        <span className="present-btn__text">
          <strong>검사음 제시 · {formatHz(p.selectedFrequency)}</strong>
          <small>{hold ? '누르고 있는 동안 재생' : '1초 재생'}</small>
        </span>
        <kbd>Space</kbd>
      </button>

      {p.children}

      <div className="tone-ctl__setup">
        <span className="block-label">측정 모드</span>
        <div className="mode-switch">
          <div className="segmented segmented--sm" role="radiogroup" aria-label="측정 모드">
            <button
              type="button"
              role="radio"
              aria-checked={p.measurementMode === 'relative'}
              className={p.measurementMode === 'relative' ? 'is-active' : ''}
              onClick={() => p.onMeasurementModeChange('relative')}
            >
              비교정 · 상대역치 %
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={p.measurementMode === 'calibrated'}
              className={p.measurementMode === 'calibrated' ? 'is-active' : ''}
              onClick={() => p.onMeasurementModeChange('calibrated')}
            >
              교정 모드 · dB HL
            </button>
          </div>
          <button type="button" className="icon-btn" onClick={p.onOpenCalibration} title="교정표 설정" aria-label="교정표 설정">
            <Settings2 size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <details className="shortcuts">
        <summary>
          <Keyboard size={16} aria-hidden="true" />
          단축키
        </summary>
        <dl>
          <div>
            <dt>Space</dt>
            <dd>검사음 제시</dd>
          </div>
          <div>
            <dt>1 – 6</dt>
            <dd>주파수 선택</dd>
          </div>
          <div>
            <dt>L · R · B</dt>
            <dd>왼쪽 · 오른쪽 · 양쪽</dd>
          </div>
          <div>
            <dt>H · N</dt>
            <dd>들림 · 안 들림</dd>
          </div>
          <div>
            <dt>↑ · ↓</dt>
            <dd>레벨 ±5</dd>
          </div>
          <div>
            <dt>Esc</dt>
            <dd>모든 소리 정지</dd>
          </div>
        </dl>
      </details>
    </section>
  )
}
