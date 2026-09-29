import { BookmarkPlus, Trash } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  DURATION_MAX_SEC,
  DURATION_MIN_SEC,
  DURATION_PRESETS,
  MASTER_LOCK_ABOVE,
  MASTER_WARN_AT,
} from '../config/constants'
import type { VulnerabilityReport } from '../types/audiometry'
import type { OutputMode, StimulusPreset, StimulusRecord, StimulusSettings } from '../types/stimulus'
import type { PlaybackState } from '../utils/audioEngine'
import { formatDuration, OUTPUT_MODE_LABEL, volumeRatio } from '../utils/format'
import { emphasizedEntries } from '../utils/hearingAnalysis'
import type { GeneratedAudio } from '../utils/stimulusGenerator'
import { ExportPanel } from './ExportPanel'
import { FrequencyPicker } from './FrequencyPicker'
import { LevelSlider } from './LevelSlider'
import type { StimulusSlot } from './VulnerableFrequencyPanel'

interface Props {
  settings: StimulusSettings
  onChange: (patch: Partial<StimulusSettings>) => void
  report: VulnerabilityReport
  liveSampleRate: number | null
  playback: PlaybackState
  onPreview: () => void
  onStopPreview: () => void
  log: StimulusRecord[]
  onGenerated: (result: GeneratedAudio) => void
  presets: StimulusPreset[]
  onSavePreset: (name: string) => void
  onApplyPreset: (preset: StimulusPreset) => void
  onDeletePreset: (id: string) => void
  masterUnlocked: boolean
  onMasterUnlockedChange: (v: boolean) => void
}

const MODES: OutputMode[] = ['both', 'left', 'right', 'split']
const FADES = [0.5, 1, 2, 3, 5, 10]

/** 개인별 음향자극음 만들기 — 의료진이 고른 두 순음을 합성 */
export function SoundTherapyGenerator(p: Props) {
  const s = p.settings
  const [errors, setErrors] = useState<Partial<Record<StimulusSlot, string | null>>>({})
  const [customDuration, setCustomDuration] = useState(() => !DURATION_PRESETS.some((d) => d.seconds === s.durationSec))
  const [durMin, setDurMin] = useState(String(Math.floor(s.durationSec / 60)))
  const [durSec, setDurSec] = useState(String(Math.round(s.durationSec % 60)))
  const [presetId, setPresetId] = useState('')

  const validity = useMemo(() => {
    const make = (slot: StimulusSlot) => (err: string | null) =>
      setErrors((prev) => (prev[slot] === err ? prev : { ...prev, [slot]: err }))
    return { A: make('A'), B: make('B'), C: make('C'), D: make('D') }
  }, [])

  const references = useMemo(() => {
    const map = new Map<number, string[]>()
    for (const ear of ['R', 'L'] as const) {
      for (const r of emphasizedEntries(p.report[ear])) {
        map.set(r.frequency, [...(map.get(r.frequency) ?? []), `${ear}${r.rank}`])
      }
    }
    return map
  }, [p.report])

  const sampleRates = useMemo(() => [s.sampleRate, p.liveSampleRate], [s.sampleRate, p.liveSampleRate])
  const split = s.outputMode === 'split'
  const slots: StimulusSlot[] = split ? ['A', 'B', 'C', 'D'] : ['A', 'B']

  const minutes = Number(durMin || 0)
  const seconds = Number(durSec || 0)
  const customTotal = minutes * 60 + seconds
  const durationError =
    customDuration &&
    (!Number.isFinite(customTotal) || customTotal < DURATION_MIN_SEC || customTotal > DURATION_MAX_SEC)
      ? `재생 시간은 ${formatDuration(DURATION_MIN_SEC)} – ${formatDuration(DURATION_MAX_SEC)} 사이로 입력하세요.`
      : null

  const silent =
    s.masterVolume <= 0 ||
    s.volumeA + s.volumeB <= 0 ||
    (split && s.volumeC + s.volumeD <= 0)

  const blockingError =
    slots.map((k) => errors[k]).find((e) => e) ??
    durationError ??
    (silent ? '음량이 0이라 소리가 나지 않습니다.' : null)

  const setCustomDur = (m: string, sec: string) => {
    setDurMin(m)
    setDurSec(sec)
    const total = Number(m || 0) * 60 + Number(sec || 0)
    if (Number.isFinite(total) && total >= DURATION_MIN_SEC && total <= DURATION_MAX_SEC) p.onChange({ durationSec: total })
  }

  // 프리셋 불러오기 등으로 프리셋에 없는 길이가 들어오면 Custom 입력칸에 반영
  useEffect(() => {
    if (DURATION_PRESETS.some((d) => d.seconds === s.durationSec)) return
    setCustomDuration(true)
    setDurMin(String(Math.floor(s.durationSec / 60)))
    setDurSec(String(Math.round(s.durationSec % 60)))
  }, [s.durationSec])

  const picker = (slot: StimulusSlot, label: string) => {
    const fKey = `freq${slot}` as const
    const vKey = `volume${slot}` as const
    return (
      <FrequencyPicker
        key={slot}
        id={`stim-${slot}`}
        label={label}
        value={s[fKey]}
        onChange={(f) => p.onChange({ [fKey]: f })}
        onValidityChange={validity[slot]}
        sampleRates={sampleRates}
        references={references}
        volume={s[vKey]}
        onVolumeChange={(v) => p.onChange({ [vKey]: v })}
      />
    )
  }

  return (
    <section className="card stimulus" aria-labelledby="stimulus-title">
      <div className="card__head">
        <div>
          <p className="eyebrow">SOUND STIMULUS</p>
          <h2 id="stimulus-title" className="card__title card__title--lg">
            개인별 음향자극음 만들기
          </h2>
          <p className="card__sub">의료진 선택 주파수 · 검사 결과 참고 · 두 순음 합성</p>
        </div>
      </div>

      <div className="stimulus__grid">
        <div className="stimulus__settings">
          <div className="setting">
            <span className="block-label">출력 방식</span>
            <div className="segmented segmented--wrap" role="radiogroup" aria-label="출력 방식">
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={s.outputMode === m}
                  className={s.outputMode === m ? 'is-active' : ''}
                  onClick={() => p.onChange({ outputMode: m })}
                >
                  {OUTPUT_MODE_LABEL[m]}
                </button>
              ))}
            </div>
          </div>

          {split ? (
            <div className="picker-groups">
              <div className="picker-group">
                <h3 className="picker-group__title">왼쪽 귀 · A + B</h3>
                {picker('A', '주파수 A')}
                {picker('B', '주파수 B')}
                <p className="picker-group__ratio">A:B 음량 {volumeRatio(s.volumeA, s.volumeB)}</p>
              </div>
              <div className="picker-group">
                <h3 className="picker-group__title">오른쪽 귀 · C + D</h3>
                {picker('C', '주파수 C')}
                {picker('D', '주파수 D')}
                <p className="picker-group__ratio">C:D 음량 {volumeRatio(s.volumeC, s.volumeD)}</p>
              </div>
            </div>
          ) : (
            <div className="picker-group picker-group--pair">
              {picker('A', 'Frequency A')}
              {picker('B', 'Frequency B')}
              <p className="picker-group__ratio">A:B 음량 {volumeRatio(s.volumeA, s.volumeB)}</p>
            </div>
          )}

          <LevelSlider
            id="master-volume"
            label="Master volume"
            value={s.masterVolume}
            onChange={(v) => p.onChange({ masterVolume: v })}
            min={0}
            max={100}
            step={1}
            nudge={5}
            suffix="%"
            warnAt={MASTER_WARN_AT}
            lockAbove={MASTER_LOCK_ABOVE}
            unlocked={p.masterUnlocked}
            onUnlockChange={p.onMasterUnlockedChange}
            warning="높은 마스터 볼륨입니다. 환자가 사용할 기기의 볼륨을 함께 확인하세요."
          />

          <div className="setting">
            <span className="block-label">재생 시간</span>
            <div className="chips">
              {DURATION_PRESETS.map((d) => {
                const active = !customDuration && s.durationSec === d.seconds
                return (
                  <button
                    key={d.seconds}
                    type="button"
                    className={`chip-btn${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => {
                      setCustomDuration(false)
                      p.onChange({ durationSec: d.seconds })
                    }}
                  >
                    {d.label}
                  </button>
                )
              })}
              <button
                type="button"
                className={`chip-btn${customDuration ? ' is-active' : ''}`}
                aria-pressed={customDuration}
                onClick={() => {
                  setCustomDuration(true)
                  setDurMin(String(Math.floor(s.durationSec / 60)))
                  setDurSec(String(Math.round(s.durationSec % 60)))
                }}
              >
                Custom
              </button>
            </div>
            {customDuration && (
              <div className="duration-custom">
                <div className="input-unit">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    aria-label="분"
                    value={durMin}
                    onChange={(e) => setCustomDur(e.target.value, durSec)}
                  />
                  <span>분</span>
                </div>
                <div className="input-unit">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    aria-label="초"
                    value={durSec}
                    onChange={(e) => setCustomDur(durMin, e.target.value)}
                  />
                  <span>초</span>
                </div>
                {durationError && <p className="field-error">{durationError}</p>}
              </div>
            )}
          </div>

          <div className="setting setting--row">
            <div className="field">
              <label htmlFor="fade">페이드 인·아웃</label>
              <select id="fade" value={s.fadeSec} onChange={(e) => p.onChange({ fadeSec: Number(e.target.value) })}>
                {FADES.map((f) => (
                  <option key={f} value={f}>
                    {f}초
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="format">파일 형식</label>
              <select
                id="format"
                value={s.format}
                onChange={(e) => p.onChange({ format: e.target.value === 'mp3' ? 'mp3' : 'wav' })}
              >
                <option value="wav">WAV (권장)</option>
                <option value="mp3">MP3</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="sr">샘플레이트</label>
              <select
                id="sr"
                value={s.sampleRate}
                onChange={(e) => p.onChange({ sampleRate: e.target.value === '48000' ? 48000 : 44100 })}
              >
                <option value={44100}>44.1 kHz</option>
                <option value={48000}>48 kHz</option>
              </select>
            </div>
            {s.format === 'mp3' && (
              <div className="field">
                <label htmlFor="br">MP3 비트레이트</label>
                <select
                  id="br"
                  value={s.mp3Bitrate}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    p.onChange({ mp3Bitrate: v === 128 || v === 256 || v === 320 ? v : 192 })
                  }}
                >
                  {[128, 192, 256, 320].map((b) => (
                    <option key={b} value={b}>
                      {b} kbps
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="setting presets">
            <span className="block-label">설정 프리셋</span>
            <div className="presets__row">
              <select
                aria-label="저장된 프리셋"
                value={presetId}
                onChange={(e) => {
                  setPresetId(e.target.value)
                  const preset = p.presets.find((x) => x.id === e.target.value)
                  if (preset) p.onApplyPreset(preset)
                }}
              >
                <option value="">{p.presets.length ? '프리셋 불러오기…' : '저장된 프리셋 없음'}</option>
                {p.presets.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  const name = window.prompt('프리셋 이름 (환자 이름은 넣지 마세요)', `${s.freqA}+${s.freqB}Hz ${formatDuration(s.durationSec)}`)
                  if (name && name.trim()) p.onSavePreset(name.trim())
                }}
              >
                <BookmarkPlus size={16} aria-hidden="true" />
                현재 설정 저장
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!presetId}
                onClick={() => {
                  p.onDeletePreset(presetId)
                  setPresetId('')
                }}
              >
                <Trash size={16} aria-hidden="true" />
                삭제
              </button>
            </div>
          </div>
        </div>

        <ExportPanel
          settings={s}
          blockingError={blockingError}
          playback={p.playback}
          onPreview={p.onPreview}
          onStopPreview={p.onStopPreview}
          log={p.log}
          onGenerated={p.onGenerated}
        />
      </div>
    </section>
  )
}
