import { OctagonX } from 'lucide-react'

interface Props {
  playing: boolean
  onStop: () => void
}

/** 항상 화면에 보이는 긴급 정지 버튼 (Esc 키와 같은 동작) */
export function SafetyStopButton({ playing, onStop }: Props) {
  return (
    <button
      type="button"
      className={`safety-stop${playing ? ' is-live' : ''}`}
      onClick={onStop}
      aria-keyshortcuts="Escape"
      title="모든 소리 즉시 정지 (Esc)"
    >
      <OctagonX size={24} strokeWidth={2} aria-hidden="true" />
      <span className="safety-stop__label">모든 소리 즉시 정지</span>
      <kbd>Esc</kbd>
    </button>
  )
}
