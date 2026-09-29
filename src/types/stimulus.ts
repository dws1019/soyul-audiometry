/**
 * 출력 방식.
 * - both: 양쪽 동일 (A+B를 양쪽 귀에)
 * - left / right: 한쪽 귀만 (다른 쪽은 무음)
 * - split: 좌우 각각 다른 설정 (왼쪽 A+B, 오른쪽 C+D)
 */
export type OutputMode = 'both' | 'left' | 'right' | 'split'

export type AudioFormat = 'wav' | 'mp3'

export type Mp3Bitrate = 128 | 192 | 256 | 320

export type FileSampleRate = 44100 | 48000

/** 합성할 순음 하나. gain은 선형 진폭(피크, 0–1). */
export interface ToneComponent {
  frequency: number
  gain: number
}

/** 좌우 채널별 순음 목록. 실시간 재생과 파일 생성이 같은 구조를 씁니다. */
export interface ChannelLayers {
  left: ToneComponent[]
  right: ToneComponent[]
}

/** 의료진이 화면에서 고르는 설정 (저장·기록·프리셋 단위) */
export interface StimulusSettings {
  freqA: number
  freqB: number
  /** split 모드의 오른쪽 귀 주파수 */
  freqC: number
  freqD: number
  /** 상대 음량 0–100. 기본 50 = 진폭 0.35 */
  volumeA: number
  volumeB: number
  volumeC: number
  volumeD: number
  /** 마스터 볼륨 0–100 % (로그 눈금) */
  masterVolume: number
  outputMode: OutputMode
  durationSec: number
  /** 시작·끝 페이드 길이(초) */
  fadeSec: number
  sampleRate: FileSampleRate
  format: AudioFormat
  mp3Bitrate: Mp3Bitrate
}

/**
 * 실제로 합성되는 신호의 완전한 명세.
 * channels의 gain에는 정규화와 마스터 볼륨이 이미 반영되어 있습니다.
 */
export interface StimulusSpec {
  sampleRate: number
  durationSec: number
  fadeInSec: number
  fadeOutSec: number
  channels: ChannelLayers
}

/** 생성한 음원 기록 (세션에 저장) */
export interface StimulusRecord {
  id: string
  createdAt: string
  fileName: string
  format: AudioFormat
  sizeBytes: number
  peakDbfs: number
  settings: StimulusSettings
}

export interface StimulusPreset {
  id: string
  name: string
  createdAt: string
  settings: StimulusSettings
}
