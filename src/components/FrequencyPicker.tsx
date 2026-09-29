import { useEffect, useState, type CSSProperties } from 'react'
import { STIMULUS_FREQ_MAX, STIMULUS_FREQ_MIN, STIMULUS_PRESET_FREQUENCIES } from '../config/constants'
import { formatHzShort, formatNumber } from '../utils/format'
import { validateStimulusFrequency } from '../utils/frequencyValidation'

interface Props {
  id: string
  label: string
  value: number
  onChange: (frequency: number) => void
  onValidityChange: (error: string | null) => void
  /** 파일 샘플레이트, 실시간 출력 샘플레이트 */
  sampleRates: ReadonlyArray<number | null>
  /** 검사 결과 참고 표시: 주파수 → ['R 1위', …] */
  references: Map<number, string[]>
  volume: number
  onVolumeChange: (volume: number) => void
}

const isPreset = (f: number) => STIMULUS_PRESET_FREQUENCIES.includes(f)

/** 의료진 선택 주파수 — 프리셋 또는 Custom 입력(범위·나이퀴스트 검증) + 상대 음량 */
export function FrequencyPicker({
  id,
  label,
  value,
  onChange,
  onValidityChange,
  sampleRates,
  references,
  volume,
  onVolumeChange,
}: Props) {
  const [custom, setCustom] = useState(!isPreset(value))
  const [text, setText] = useState(String(value))

  // 외부에서 값이 바뀐 경우(취약 주파수 패널, 프리셋 불러오기) 화면 동기화
  useEffect(() => {
    if (isPreset(value)) {
      setCustom(false)
      setText(String(value))
    } else if (Number(text.replace(/,/g, '')) !== value) {
      setCustom(true)
      setText(String(value))
    }
    // text는 사용자가 입력 중일 수 있으므로 의존성에서 제외
  }, [value])

  const check = validateStimulusFrequency(custom ? text : value, sampleRates)

  useEffect(() => {
    onValidityChange(check.error)
  }, [check.error, onValidityChange])

  const volStyle = { '--fill': `${volume}%` } as CSSProperties

  return (
    <fieldset className="picker">
      <legend className="picker__label">{label}</legend>
      <div className="chips" role="group" aria-label={`${label} 프리셋`}>
        {STIMULUS_PRESET_FREQUENCIES.map((f) => {
          const refs = references.get(f)
          const active = !custom && value === f
          return (
            <button
              key={f}
              type="button"
              className={`chip-btn${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => {
                setCustom(false)
                setText(String(f))
                onChange(f)
              }}
            >
              {formatHzShort(f)}
              {refs && (
                <span className="chip-btn__ref" title={`검사 결과 참고: ${refs.join(', ')}`}>
                  {refs.join(' · ')}
                </span>
              )}
            </button>
          )
        })}
        <button
          type="button"
          className={`chip-btn${custom ? ' is-active' : ''}`}
          aria-pressed={custom}
          onClick={() => setCustom(true)}
        >
          직접 입력
        </button>
      </div>

      {custom && (
        <div className="picker__custom">
          <label htmlFor={`${id}-custom`}>Custom Frequency</label>
          <div className={`input-unit${check.error ? ' is-invalid' : ''}`}>
            <input
              id={`${id}-custom`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={text}
              aria-invalid={!!check.error}
              aria-describedby={`${id}-msg`}
              onChange={(e) => {
                setText(e.target.value)
                const r = validateStimulusFrequency(e.target.value, sampleRates)
                if (r.value !== null) onChange(r.value)
              }}
            />
            <span>Hz</span>
          </div>
          <p id={`${id}-msg`} className={check.error ? 'field-error' : 'field-help'}>
            {check.error ??
              check.warning ??
              `${formatNumber(STIMULUS_FREQ_MIN)} – ${formatNumber(STIMULUS_FREQ_MAX)} Hz, 소수점 첫째 자리까지`}
          </p>
        </div>
      )}
      {!custom && check.error && <p className="field-error">{check.error}</p>}

      <div className="picker__volume">
        <label htmlFor={`${id}-vol`}>{label} 음량</label>
        <input
          id={`${id}-vol`}
          type="range"
          className="level__range level__range--plain"
          min={0}
          max={100}
          step={1}
          value={volume}
          style={volStyle}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
        />
        <output htmlFor={`${id}-vol`}>{volume}</output>
      </div>
    </fieldset>
  )
}
