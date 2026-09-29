import { AudioWaveform, CircleCheck, Download, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { StimulusRecord, StimulusSettings } from '../types/stimulus'
import type { PlaybackState } from '../utils/audioEngine'
import { downloadBlob } from '../utils/exporters'
import {
  buildStimulusFileName,
  formatBytes,
  formatDuration,
  formatHz,
  formatNumber,
  formatTime,
  volumeRatio,
} from '../utils/format'
import { gainToDbfs } from '../utils/levels'
import { estimateFileSize, estimateGenerationSeconds, generateMixedAudio, type GeneratedAudio } from '../utils/stimulusGenerator'
import { buildChannelLayers, theoreticalPeak } from '../utils/stimulusSynth'
import { AudioPreview } from './AudioPreview'

interface Props {
  settings: StimulusSettings
  /** 생성을 막는 입력 오류 */
  blockingError: string | null
  playback: PlaybackState
  onPreview: () => void
  onStopPreview: () => void
  log: StimulusRecord[]
  onGenerated: (result: GeneratedAudio) => void
}

const OUTPUT_TEXT = {
  both: 'Stereo · Both ears (양쪽 동일)',
  left: 'Stereo · Left ear only (오른쪽 무음)',
  right: 'Stereo · Right ear only (왼쪽 무음)',
  split: 'Stereo · 좌우 각각 다른 설정',
} as const

const LARGE_FILE_BYTES = 200 * 1024 * 1024

/** 생성 전 확인 화면 → 미리듣기 → 음원 생성 → 다운로드 */
export function ExportPanel({ settings: s, blockingError, playback, onPreview, onStopPreview, log, onGenerated }: Props) {
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<GeneratedAudio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const size = estimateFileSize(s)
  const peak = gainToDbfs(theoreticalPeak(buildChannelLayers(s)))
  const stale = result !== null && JSON.stringify(result.settings) !== JSON.stringify(s)
  const generating = status === 'generating'
  const eta = estimateGenerationSeconds(s)

  const generate = async () => {
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setStatus('generating')
    setProgress(0)
    setError(null)
    try {
      const r = await generateMixedAudio(s, { onProgress: setProgress, signal: ctrl.signal })
      setResult(r)
      setStatus('done')
      onGenerated(r)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus('idle')
      } else {
        setStatus('error')
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      abortRef.current = null
    }
  }

  return (
    <aside className="export" aria-labelledby="export-title">
      <p className="eyebrow">CONFIRM</p>
      <h3 id="export-title" className="export__title">
        생성 전 확인 · 개인별 음향자극음
      </h3>

      <dl className="summary">
        {s.outputMode === 'split' ? (
          <>
            <div>
              <dt>왼쪽 귀 A + B</dt>
              <dd>
                {formatHz(s.freqA)} + {formatHz(s.freqB)}
              </dd>
            </div>
            <div>
              <dt>오른쪽 귀 C + D</dt>
              <dd>
                {formatHz(s.freqC)} + {formatHz(s.freqD)}
              </dd>
            </div>
            <div>
              <dt>A:B · C:D 음량</dt>
              <dd>
                {volumeRatio(s.volumeA, s.volumeB)} · {volumeRatio(s.volumeC, s.volumeD)}
              </dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>Frequency A</dt>
              <dd>{formatHz(s.freqA)}</dd>
            </div>
            <div>
              <dt>Frequency B</dt>
              <dd>{formatHz(s.freqB)}</dd>
            </div>
            <div>
              <dt>A:B 음량</dt>
              <dd>{volumeRatio(s.volumeA, s.volumeB)}</dd>
            </div>
          </>
        )}
        <div>
          <dt>마스터 볼륨</dt>
          <dd>
            {s.masterVolume} %{' '}
            <small>(최대 피크 {Number.isFinite(peak) ? `${formatNumber(peak)} dBFS` : '무음'})</small>
          </dd>
        </div>
        <div>
          <dt>재생 시간</dt>
          <dd>
            {formatDuration(s.durationSec)} <small>(페이드 인·아웃 {formatNumber(s.fadeSec)}초)</small>
          </dd>
        </div>
        <div>
          <dt>Output</dt>
          <dd>{OUTPUT_TEXT[s.outputMode]}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>
            {s.format === 'wav'
              ? `WAV (권장) · ${formatNumber(s.sampleRate / 1000)} kHz · 16-bit PCM`
              : `MP3 · ${s.mp3Bitrate} kbps · ${formatNumber(s.sampleRate / 1000)} kHz`}
          </dd>
        </div>
        <div>
          <dt>예상 크기</dt>
          <dd>약 {formatBytes(size)}</dd>
        </div>
        <div className="summary__file">
          <dt>파일명</dt>
          <dd>
            <code>{buildStimulusFileName(s)}</code>
          </dd>
        </div>
      </dl>

      {s.format === 'mp3' && (
        <p className="notice notice--muted">
          <Info size={18} aria-hidden="true" />
          <span>
            MP3는 손실 압축이라 순음 주변에 미세한 잡음·왜곡이 생길 수 있습니다. 정확한 주파수가 중요하면 WAV를
            권장합니다.
          </span>
        </p>
      )}
      {s.format === 'wav' && size > LARGE_FILE_BYTES && (
        <p className="notice notice--muted">
          <Info size={18} aria-hidden="true" />
          <span>파일이 큽니다. 휴대폰으로 옮길 때는 MP3도 고려하세요.</span>
        </p>
      )}
      {blockingError && (
        <p className="notice notice--attention" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>{blockingError}</span>
        </p>
      )}

      <ol className="export__steps">
        <li>
          <span className="export__step-num">1</span>
          <AudioPreview playback={playback} disabled={!!blockingError} onPreview={onPreview} onStop={onStopPreview} />
        </li>
        <li>
          <span className="export__step-num">2</span>
          <div className="export__gen">
            {generating ? (
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                <div className="progress__head">
                  <LoaderCircle size={18} className="spin" aria-hidden="true" />
                  <span>음원 생성 중 {Math.round(progress * 100)}%</span>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => abortRef.current?.abort()}>
                    <X size={16} aria-hidden="true" />
                    취소
                  </button>
                </div>
                <div className="progress__track">
                  <span style={{ width: `${progress * 100}%` }} />
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn--primary btn--lg" onClick={generate} disabled={!!blockingError}>
                <AudioWaveform size={20} aria-hidden="true" />
                음원 생성
              </button>
            )}
            {!generating && eta > 8 && <small className="field-help">예상 소요 약 {formatDuration(Math.ceil(eta))}</small>}
            {status === 'error' && error && <p className="field-error">생성 실패: {error}</p>}
          </div>
        </li>
        <li>
          <span className="export__step-num">3</span>
          <div className="export__dl">
            <button
              type="button"
              className="btn btn--secondary btn--lg"
              disabled={!result || stale || generating}
              onClick={() => result && downloadBlob(result.blob, result.fileName)}
            >
              <Download size={20} aria-hidden="true" />
              {s.format === 'wav' ? 'WAV 다운로드 — 권장' : 'MP3 다운로드'}
            </button>
            {result && !stale && (
              <p className="export__ready">
                <CircleCheck size={16} aria-hidden="true" />
                {result.fileName} · {formatBytes(result.sizeBytes)}
              </p>
            )}
            {result && stale && <p className="field-help">설정이 바뀌었습니다. 음원을 다시 생성하세요.</p>}
          </div>
        </li>
      </ol>

      {log.length > 0 && (
        <details className="export__log">
          <summary>이 검사에서 생성한 음원 {log.length}건</summary>
          <ul>
            {log.map((r) => (
              <li key={r.id}>
                <span>{formatTime(r.createdAt)}</span>
                <code>{r.fileName}</code>
                <span>{formatBytes(r.sizeBytes)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  )
}
