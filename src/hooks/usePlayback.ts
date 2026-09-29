import { useSyncExternalStore } from 'react'
import { audioEngine, type PlaybackState } from '../utils/audioEngine'

/** 오디오 엔진의 재생 상태 (● PLAYING 표시 등) */
export function usePlayback(): PlaybackState {
  return useSyncExternalStore(audioEngine.subscribe, audioEngine.getSnapshot)
}
