import { Play, Square } from 'lucide-react'
import { PREVIEW_SECONDS } from '../config/constants'
import type { PlaybackState } from '../utils/audioEngine'

interface Props {
  playback: PlaybackState
  disabled: boolean
  onPreview: () => void
  onStop: () => void
}

/** 자극음 미리듣기 (앞부분 몇 초만, 파일과 같은 성분·음량·채널) */
export function AudioPreview({ playback, disabled, onPreview, onStop }: Props) {
  const previewing = playback.playing && playback.kind === 'preview'
  const duration = previewing && playback.endsAt && playback.startedAt ? playback.endsAt - playback.startedAt : null

  return (
    <div className="preview">
      <div className="btn-row">
        <button type="button" className="btn btn--secondary" onClick={onPreview} disabled={disabled}>
          <Play size={18} aria-hidden="true" />
          자극음 미리듣기 ({PREVIEW_SECONDS}초)
        </button>
        <button type="button" className="btn btn--ghost" onClick={onStop} disabled={!previewing}>
          <Square size={16} aria-hidden="true" />
          정지
        </button>
      </div>
      <div className={`preview__bar${previewing ? ' is-active' : ''}`} aria-hidden="true">
        {duration !== null && <span key={playback.startedAt} style={{ animationDuration: `${duration}ms` }} />}
      </div>
    </div>
  )
}
