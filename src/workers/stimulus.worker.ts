/**
 * 음원 파일 생성 Worker.
 * 30분 이상의 음원도 화면이 멈추지 않도록 별도 스레드에서, 약 1초 단위 청크로 합성·인코딩합니다.
 * 결과는 Blob으로만 돌려주며 네트워크를 사용하지 않습니다.
 */
import { Mp3Encoder } from '@breezystack/lamejs'
import { renderStimulusChunk, totalFrames } from '../utils/stimulusSynth'
import { createWavHeader, floatToPcm16, floatToPcm16Interleaved } from '../utils/wavEncoder'
import type { GenerateRequest, WorkerResponse } from './protocol'

interface WorkerScope {
  postMessage(message: WorkerResponse): void
  onmessage: ((event: MessageEvent<GenerateRequest>) => void) | null
}
const scope = self as unknown as WorkerScope

/** 1152(MP3 프레임) × 40 ≈ 1초 */
const CHUNK_FRAMES = 1152 * 40
/** 이만큼 쌓이면 Blob으로 접어 메모리 사용을 줄임 */
const FOLD_BYTES = 32 * 1024 * 1024

function generate(req: GenerateRequest): { blob: Blob; peak: number; frames: number } {
  const { spec, format } = req
  const frames = totalFrames(spec)
  const L = new Float32Array(CHUNK_FRAMES)
  const R = new Float32Array(CHUNK_FRAMES)

  let folded: Blob | null = null
  let parts: BlobPart[] = []
  let pending = 0
  const push = (part: BlobPart, bytes: number) => {
    parts.push(part)
    pending += bytes
    if (pending >= FOLD_BYTES) fold()
  }
  const fold = () => {
    folded = new Blob(folded ? [folded, ...parts] : parts)
    parts = []
    pending = 0
  }

  const encoder = format === 'mp3' ? new Mp3Encoder(2, spec.sampleRate, req.mp3Bitrate) : null
  if (!encoder) push(createWavHeader(spec.sampleRate, 2, frames), 44)

  let peak = 0
  let lastReported = -1
  for (let start = 0; start < frames; start += CHUNK_FRAMES) {
    const n = Math.min(CHUNK_FRAMES, frames - start)
    peak = Math.max(peak, renderStimulusChunk(spec, start, n, L, R))

    if (encoder) {
      const mp3 = encoder.encodeBuffer(floatToPcm16(L, n, true), floatToPcm16(R, n, true))
      if (mp3.length > 0) push(mp3.slice(), mp3.length)
    } else {
      const pcm = floatToPcm16Interleaved([L, R], n, true)
      push(pcm, pcm.byteLength)
    }

    const progress = Math.floor(((start + n) / frames) * 200) / 200 // 0.5 % 단위
    if (progress !== lastReported) {
      lastReported = progress
      scope.postMessage({ type: 'progress', progress })
    }
  }

  if (encoder) {
    const tail = encoder.flush()
    if (tail.length > 0) push(tail.slice(), tail.length)
  }
  fold()

  const type = format === 'mp3' ? 'audio/mpeg' : 'audio/wav'
  return { blob: new Blob(folded ? [folded] : [], { type }), peak, frames }
}

scope.onmessage = (event) => {
  const req = event.data
  if (req?.type !== 'generate') return
  try {
    const { blob, peak, frames } = generate(req)
    scope.postMessage({ type: 'done', blob, peak, frames })
  } catch (err) {
    scope.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
