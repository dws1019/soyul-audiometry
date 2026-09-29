import type { AudioFormat, Mp3Bitrate, StimulusSpec } from '../types/stimulus'

export interface GenerateRequest {
  type: 'generate'
  spec: StimulusSpec
  format: AudioFormat
  mp3Bitrate: Mp3Bitrate
}

export type WorkerResponse =
  | { type: 'progress'; progress: number }
  | { type: 'done'; blob: Blob; peak: number; frames: number }
  | { type: 'error'; message: string }
