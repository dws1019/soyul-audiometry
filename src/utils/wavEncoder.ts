/**
 * WAV(RIFF, PCM 16-bit) 인코더.
 * 긴 음원은 Web Worker에서 청크 단위로 createWavHeader + floatToPcm16Interleaved를 이어 붙여 만들고,
 * 짧은 AudioBuffer는 exportWav로 한 번에 만듭니다.
 */

/** AudioBuffer와 같은 모양의 PCM 원본 (AudioBuffer 자체도 만족) */
export interface PcmSource {
  sampleRate: number
  length: number
  numberOfChannels: number
  getChannelData(channel: number): Float32Array
}

export function createWavHeader(
  sampleRate: number,
  numChannels: number,
  numFrames: number,
  bitsPerSample = 16,
): ArrayBuffer {
  const blockAlign = (numChannels * bitsPerSample) / 8
  const dataBytes = numFrames * blockAlign
  const buf = new ArrayBuffer(44)
  const v = new DataView(buf)
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  v.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  v.setUint32(16, 16, true) // fmt chunk size
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, numChannels, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * blockAlign, true) // byte rate
  v.setUint16(32, blockAlign, true)
  v.setUint16(34, bitsPerSample, true)
  ascii(36, 'data')
  v.setUint32(40, dataBytes, true)
  return buf
}

/**
 * float(-1…1) → 16-bit 정수. dither=true면 TPDF 디더(±1 LSB)를 더해
 * 낮은 레벨의 순음에서 양자화 왜곡(고조파)이 생기지 않게 합니다.
 */
function toInt16(x: number, dither: boolean): number {
  const d = dither ? Math.random() - Math.random() : 0
  const s = Math.round(x * 32767 + d)
  return s > 32767 ? 32767 : s < -32768 ? -32768 : s
}

export function floatToPcm16(src: Float32Array, frames: number, dither: boolean): Int16Array<ArrayBuffer> {
  const out = new Int16Array(frames)
  for (let i = 0; i < frames; i++) out[i] = toInt16(src[i], dither)
  return out
}

export function floatToPcm16Interleaved(
  channels: readonly Float32Array[],
  frames: number,
  dither: boolean,
): Int16Array<ArrayBuffer> {
  const n = channels.length
  const out = new Int16Array(frames * n)
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < n; c++) out[i * n + c] = toInt16(channels[c][i], dither)
  }
  return out
}

/** AudioBuffer(또는 같은 모양의 객체) → WAV Blob */
export function exportWav(audioBuffer: PcmSource, options: { dither?: boolean } = {}): Blob {
  const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, c) => audioBuffer.getChannelData(c))
  const header = createWavHeader(audioBuffer.sampleRate, channels.length, audioBuffer.length)
  const pcm = floatToPcm16Interleaved(channels, audioBuffer.length, options.dither ?? true)
  return new Blob([header, pcm], { type: 'audio/wav' })
}
