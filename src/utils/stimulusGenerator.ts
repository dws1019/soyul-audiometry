import type { StimulusSettings } from '../types/stimulus'
import type { GenerateRequest, WorkerResponse } from '../workers/protocol'
import { buildStimulusFileName } from './format'
import { gainToDbfs } from './levels'
import { buildStimulusSpec, totalFrames } from './stimulusSynth'

export interface GeneratedAudio {
  blob: Blob
  fileName: string
  sizeBytes: number
  /** 실제 신호의 최대 피크 (dBFS) */
  peakDbfs: number
  createdAt: string
  /** 생성에 사용한 설정 — 설정이 바뀌었는지 비교하는 데 사용 */
  settings: StimulusSettings
}

export interface GenerateOptions {
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

/**
 * 두 순음을 합성해 WAV 또는 MP3 파일(Blob)을 만듭니다. 서버를 쓰지 않고 브라우저 Worker에서 처리합니다.
 * 취소하면 Worker를 즉시 종료합니다.
 */
export function generateMixedAudio(
  settings: StimulusSettings,
  { onProgress, signal }: GenerateOptions = {},
): Promise<GeneratedAudio> {
  const spec = buildStimulusSpec(settings)
  const snapshot: StimulusSettings = { ...settings }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('취소되었습니다.', 'AbortError'))
      return
    }
    const worker = new Worker(new URL('../workers/stimulus.worker.ts', import.meta.url), { type: 'module' })
    const cleanup = () => {
      worker.terminate()
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      cleanup()
      reject(new DOMException('취소되었습니다.', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data
      if (msg.type === 'progress') {
        onProgress?.(msg.progress)
      } else if (msg.type === 'done') {
        cleanup()
        const createdAt = new Date()
        resolve({
          blob: msg.blob,
          fileName: buildStimulusFileName(snapshot, createdAt),
          sizeBytes: msg.blob.size,
          peakDbfs: gainToDbfs(msg.peak),
          createdAt: createdAt.toISOString(),
          settings: snapshot,
        })
      } else {
        cleanup()
        reject(new Error(msg.message))
      }
    }
    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || '음원 생성 중 오류가 발생했습니다.'))
    }

    const request: GenerateRequest = {
      type: 'generate',
      spec,
      format: settings.format,
      mp3Bitrate: settings.mp3Bitrate,
    }
    worker.postMessage(request)
  })
}

/** 예상 파일 크기 (bytes) */
export function estimateFileSize(settings: StimulusSettings): number {
  const frames = totalFrames(buildStimulusSpec(settings))
  if (settings.format === 'mp3') return Math.round((settings.mp3Bitrate * 1000 * settings.durationSec) / 8)
  return 44 + frames * 2 * 2
}

/** 예상 생성 시간(초) — 안내용 대략치 */
export function estimateGenerationSeconds(settings: StimulusSettings): number {
  return settings.format === 'mp3' ? settings.durationSec / 12 : settings.durationSec / 110
}
