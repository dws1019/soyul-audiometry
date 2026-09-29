import type { EarSelection } from '../types/audiometry'
import type { PlaybackState } from '../utils/audioEngine'
import { EAR_SELECTION_EN, EAR_SELECTION_LABEL, formatHz } from '../utils/format'
import { EarMarker } from './EarMarker'

interface Props {
  playback: PlaybackState
  selectedFrequency: number
  selectedEar: EarSelection
  variant?: 'panel' | 'compact'
}

const KIND_LABEL = { test: 'PLAYING', preview: 'PREVIEW', reference: 'REFERENCE' } as const
const KIND_KO = { test: '검사음 재생 중', preview: '자극음 미리듣기 중', reference: '교정 기준음 재생 중' } as const

function channelToEar(channel: PlaybackState['channel']): EarSelection | null {
  if (channel === 'left') return 'L'
  if (channel === 'right') return 'R'
  if (channel === 'both' || channel === 'split') return 'both'
  return null
}

/**
 * 현재 재생 상태 — 재생 중인 주파수와 귀를 한눈에.
 * 재생 중에는 진한 녹색 면, 대기 중에는 옅은 면으로 뚜렷이 구분합니다.
 */
export function PlaybackStatus({ playback, selectedFrequency, selectedEar, variant = 'panel' }: Props) {
  const { playing, kind } = playback
  const ear = playing ? channelToEar(playback.channel) : selectedEar
  const freqText = playing ? playback.frequencies.map(formatHz).join(' + ') : formatHz(selectedFrequency)
  const earEn = playback.channel === 'split' ? 'L / R SPLIT' : ear ? EAR_SELECTION_EN[ear] : ''
  const earKo = playback.channel === 'split' ? '좌우 각각' : ear ? EAR_SELECTION_LABEL[ear] : ''
  const duration = playback.endsAt && playback.startedAt ? playback.endsAt - playback.startedAt : null

  if (variant === 'compact') {
    return (
      <div className={`status-compact${playing ? ' is-playing' : ''}`} role="status" aria-live="polite">
        <span className="status-dot" aria-hidden="true" />
        {playing && kind ? (
          <>
            <strong>{KIND_LABEL[kind]}</strong>
            <span className="status-compact__freq">{freqText}</span>
            <span className="status-compact__ear">{earEn}</span>
          </>
        ) : (
          <span className="status-compact__idle">대기 중</span>
        )}
      </div>
    )
  }

  return (
    <div className={`status-panel${playing ? ' is-playing' : ''}`} role="status" aria-live="polite">
      <div className="status-panel__top">
        <span className="status-panel__state">
          <span className="status-dot" aria-hidden="true" />
          {playing && kind ? KIND_LABEL[kind] : 'READY'}
        </span>
        <span className="status-panel__ko">{playing && kind ? KIND_KO[kind] : '대기 중 · 선택된 검사음'}</span>
      </div>
      <div className="status-panel__main">
        <div className="status-panel__freq">{freqText}</div>
        <div className="status-panel__ear">
          {ear && <EarMarker ear={ear} size={18} />}
          <span className="status-panel__ear-en">{earEn}</span>
          <span className="status-panel__ear-ko">{earKo}</span>
        </div>
      </div>
      {playing && duration !== null && (
        <div className="status-panel__timer" aria-hidden="true">
          <span key={playback.startedAt} style={{ animationDuration: `${duration}ms` }} />
        </div>
      )}
    </div>
  )
}
