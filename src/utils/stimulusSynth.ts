/**
 * 두 순음 합성 (DOM·Web Audio에 의존하지 않는 순수 계산 — Web Worker와 UI가 함께 씀)
 *
 *   Tone A = gA · sin(2π fA t)
 *   Tone B = gB · sin(2π fB t)
 *   Mixed  = (Tone A + Tone B) · envelope(t)
 *
 * 클리핑 방지:
 *  1) 각 순음 진폭 = 0.35 × (상대 음량 / 50)
 *  2) 한 채널의 진폭 합이 MIX_PEAK_LIMIT(0.9)를 넘으면 비율을 유지한 채 전체를 줄임 (정규화)
 *     → |Σ gᵢ·sin(…)| ≤ Σ gᵢ ≤ 0.9 이므로 이론적으로 -1…+1을 넘을 수 없음
 *  3) 마스터 볼륨(≤ 1)을 곱한 뒤, 마지막에 ±1 하드 리미터(안전장치)
 */
import { MIX_BASE_GAIN, MIX_PEAK_LIMIT } from '../config/constants'
import type { ChannelLayers, StimulusSettings, StimulusSpec, ToneComponent } from '../types/stimulus'
import { masterToGain } from './levels'

/** 상대 음량(0–100) 목록 → 정규화된 진폭 목록 */
export function mixGains(volumes: readonly number[]): number[] {
  const raw = volumes.map((v) => MIX_BASE_GAIN * (Math.max(0, Math.min(100, v)) / 50))
  const sum = raw.reduce((a, b) => a + b, 0)
  const scale = sum > MIX_PEAK_LIMIT ? MIX_PEAK_LIMIT / sum : 1
  return raw.map((g) => g * scale)
}

function pair(f1: number, v1: number, f2: number, v2: number, master: number): ToneComponent[] {
  const [g1, g2] = mixGains([v1, v2])
  return [
    { frequency: f1, gain: g1 * master },
    { frequency: f2, gain: g2 * master },
  ].filter((c) => c.gain > 0)
}

/** 화면 설정 → 좌우 채널별 순음 목록 (정규화·마스터 반영) */
export function buildChannelLayers(s: StimulusSettings): ChannelLayers {
  const master = masterToGain(s.masterVolume)
  const ab = pair(s.freqA, s.volumeA, s.freqB, s.volumeB, master)
  switch (s.outputMode) {
    case 'left':
      return { left: ab, right: [] }
    case 'right':
      return { left: [], right: ab }
    case 'split':
      return { left: ab, right: pair(s.freqC, s.volumeC, s.freqD, s.volumeD, master) }
    default:
      return { left: ab, right: ab.map((c) => ({ ...c })) }
  }
}

export function buildStimulusSpec(s: StimulusSettings): StimulusSpec {
  const fade = Math.max(0, Math.min(s.fadeSec, s.durationSec / 2))
  return {
    sampleRate: s.sampleRate,
    durationSec: s.durationSec,
    fadeInSec: fade,
    fadeOutSec: fade,
    channels: buildChannelLayers(s),
  }
}

/** 이론상 최대 피크 (채널별 진폭 합의 최댓값) */
export function theoreticalPeak(layers: ChannelLayers): number {
  const sum = (cs: ToneComponent[]) => cs.reduce((a, c) => a + c.gain, 0)
  return Math.max(sum(layers.left), sum(layers.right))
}

export function totalFrames(spec: StimulusSpec): number {
  return Math.round(spec.durationSec * spec.sampleRate)
}

/** 상승 코사인(raised-cosine) 페이드 — 선형보다 스펙트럼 번짐이 적음 */
function envelopeAt(frame: number, total: number, fadeIn: number, fadeOut: number): number {
  if (fadeIn > 0 && frame < fadeIn) return 0.5 - 0.5 * Math.cos((Math.PI * frame) / fadeIn)
  const fromEnd = total - 1 - frame
  if (fadeOut > 0 && fromEnd < fadeOut) return 0.5 - 0.5 * Math.cos((Math.PI * Math.max(0, fromEnd)) / fadeOut)
  return 1
}

function renderChannel(
  components: ToneComponent[],
  sampleRate: number,
  start: number,
  count: number,
  out: Float32Array,
): void {
  out.fill(0, 0, count)
  for (const c of components) {
    // 위상을 누적하지 않고 절대 프레임 번호로 계산 → 긴 파일에서도 주파수 오차가 쌓이지 않음
    const w = (2 * Math.PI * c.frequency) / sampleRate
    const g = c.gain
    for (let i = 0; i < count; i++) out[i] += g * Math.sin(w * (start + i))
  }
}

function sameComponents(a: ToneComponent[], b: ToneComponent[]): boolean {
  return a.length === b.length && a.every((c, i) => c.frequency === b[i].frequency && c.gain === b[i].gain)
}

/**
 * [start, start+count) 구간을 outL/outR에 씁니다.
 * @returns 이 구간의 실제 최대 절댓값
 */
export function renderStimulusChunk(
  spec: StimulusSpec,
  start: number,
  count: number,
  outL: Float32Array,
  outR: Float32Array,
): number {
  const total = totalFrames(spec)
  const fadeIn = Math.round(spec.fadeInSec * spec.sampleRate)
  const fadeOut = Math.round(spec.fadeOutSec * spec.sampleRate)
  const { left, right } = spec.channels

  renderChannel(left, spec.sampleRate, start, count, outL)
  if (sameComponents(left, right)) outR.set(outL.subarray(0, count))
  else renderChannel(right, spec.sampleRate, start, count, outR)

  let peak = 0
  for (let i = 0; i < count; i++) {
    const env = envelopeAt(start + i, total, fadeIn, fadeOut)
    // 하드 리미터(안전장치): 정규화로 도달할 일은 없지만 어떤 경우에도 ±1을 넘지 않게
    const l = Math.max(-1, Math.min(1, outL[i] * env))
    const r = Math.max(-1, Math.min(1, outR[i] * env))
    outL[i] = l
    outR[i] = r
    const a = Math.max(Math.abs(l), Math.abs(r))
    if (a > peak) peak = a
  }
  return peak
}
