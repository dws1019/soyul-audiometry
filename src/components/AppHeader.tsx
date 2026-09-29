import logo from '../assets/brand/soyul-lockup-compact.svg'
import type { EarSelection } from '../types/audiometry'
import type { PlaybackState } from '../utils/audioEngine'
import { PlaybackStatus } from './PlaybackStatus'
import { SafetyStopButton } from './SafetyStopButton'

interface Props {
  playback: PlaybackState
  selectedFrequency: number
  selectedEar: EarSelection
  patientLabel: string
  dirty: boolean
  onStopAll: () => void
}

const STEPS = [
  { href: '#patient', label: '환자' },
  { href: '#test-grid', label: '검사' },
  { href: '#analysis', label: '취약 주파수' },
  { href: '#stimulus', label: '자극음' },
  { href: '#records', label: '기록' },
]

export function AppHeader({ playback, selectedFrequency, selectedEar, patientLabel, dirty, onStopAll }: Props) {
  return (
    <header className="app-header">
      <div className="container app-header__inner">
        <a className="brand" href="#patient" aria-label="소율한의원 순음청력검사 보조 — 맨 위로">
          <img src={logo} alt="" height={34} width={129} />
          <span className="brand__app">
            순음청력검사 보조
            <small>개인별 음향자극음</small>
          </span>
        </a>

        <nav className="steps" aria-label="검사 단계">
          {STEPS.map((s, i) => (
            <a key={s.href} href={s.href}>
              <span className="steps__num">{i + 1}</span>
              {s.label}
            </a>
          ))}
        </nav>

        <div className="app-header__patient" title="현재 검사">
          <span className="app-header__patient-id">{patientLabel}</span>
          {dirty && <span className="tag tag--pending">저장 안 됨</span>}
        </div>

        <PlaybackStatus
          playback={playback}
          selectedFrequency={selectedFrequency}
          selectedEar={selectedEar}
          variant="compact"
        />
        <SafetyStopButton playing={playback.playing} onStop={onStopAll} />
      </div>
    </header>
  )
}
