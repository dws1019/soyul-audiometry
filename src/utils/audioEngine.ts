/**
 * 실시간 음 발생 엔진 (Web Audio API). UI 코드와 분리되어 있습니다.
 *
 * 신호 경로 (소리 하나 = Voice 하나):
 *
 *   Oscillator(sine, f) ─► Gain(성분 진폭) ─► ChannelMerger[0=L | 1=R] ─► Gain(envelope 0→1) ─► bus ─► destination
 *
 * 수명 관리 원칙
 *  - 동시에 '현재' Voice는 하나뿐. 새 소리를 시작하면 이전 Voice는 짧게 페이드아웃된 뒤 정리됩니다.
 *  - 페이드아웃 중인 Voice도 모두 voices 집합에서 추적하므로, 긴급 정지는 남김없이 멈춥니다.
 *  - Oscillator가 끝나면(onended) 모든 노드를 disconnect 합니다. onended가 오지 않는 경우를 대비한 타이머도 둡니다.
 *  - 탭 숨김·창 포커스 해제 시 모든 소리 정지, 페이지 이탈 시 AudioContext를 닫습니다.
 *
 * 안전
 *  - 시작·종료·주파수 변경은 모두 20–50 ms 램프 (click/pop 방지)
 *  - 재생 중 레벨 변경은 setTargetAtTime으로 부드럽게 (급격한 음량 변화 방지)
 *  - 나이퀴스트 주파수 이상 성분은 재생하지 않음
 */
import {
  EMERGENCY_RAMP_SEC,
  GAIN_SMOOTHING_SEC,
  PREVIEW_SECONDS,
  TONE_RAMP_SEC,
} from '../config/constants'
import type { ChannelLayers, StimulusSpec } from '../types/stimulus'
import { dbToGain } from './levels'

// 요구사항의 Audio Engine 함수 목록을 이 모듈에서 모두 사용할 수 있도록 다시 내보냅니다.
export { generateMixedAudio } from './stimulusGenerator'
export { exportWav } from './wavEncoder'

export type OutputChannel = 'left' | 'right' | 'both'
export type PlaybackKind = 'test' | 'preview' | 'reference'

export interface ChannelGains {
  left: number
  right: number
}

export interface PlaybackState {
  playing: boolean
  kind: PlaybackKind | null
  frequencies: number[]
  channel: OutputChannel | 'split' | null
  /** performance.now() 기준 ms */
  startedAt: number | null
  endsAt: number | null
  /** 실제 출력 장치의 샘플레이트 (첫 재생 후 확정) */
  sampleRate: number | null
  contextState: AudioContextState | 'uninitialized'
}

interface VoiceComponent {
  channel: 0 | 1
  node: GainNode
}

interface Voice {
  id: number
  kind: PlaybackKind
  oscillators: OscillatorNode[]
  components: VoiceComponent[]
  merger: ChannelMergerNode
  envelope: GainNode
  timers: number[]
  releaseFade: number | null
  disposed: boolean
}

const IDLE: Pick<PlaybackState, 'playing' | 'kind' | 'frequencies' | 'channel' | 'startedAt' | 'endsAt'> = {
  playing: false,
  kind: null,
  frequencies: [],
  channel: null,
  startedAt: null,
  endsAt: null,
}

/** 진행 중인 자동화를 현재 값에서 멈춤 (Firefox는 cancelAndHoldAtTime 미지원) */
function holdParam(param: AudioParam, time: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(time)
  } else {
    const v = param.value
    param.cancelScheduledValues(time)
    param.setValueAtTime(v, time)
  }
}

/** 단일 주파수 검사음 → 채널별 성분 */
export function toneLayers(frequency: number, gain: number | ChannelGains, channel: OutputChannel): ChannelLayers {
  const g: ChannelGains = typeof gain === 'number' ? { left: gain, right: gain } : gain
  return {
    left: channel !== 'right' && g.left > 0 ? [{ frequency, gain: g.left }] : [],
    right: channel !== 'left' && g.right > 0 ? [{ frequency, gain: g.right }] : [],
  }
}

function describeLayers(layers: ChannelLayers): OutputChannel | 'split' | null {
  const l = layers.left.length > 0
  const r = layers.right.length > 0
  if (l && r) {
    const key = (cs: ChannelLayers['left']) => cs.map((c) => c.frequency).sort((a, b) => a - b).join(',')
    return key(layers.left) === key(layers.right) ? 'both' : 'split'
  }
  return l ? 'left' : r ? 'right' : null
}

function uniqueFrequencies(layers: ChannelLayers): number[] {
  return [...new Set([...layers.left, ...layers.right].map((c) => c.frequency))]
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  private current: Voice | null = null
  private readonly voices = new Set<Voice>()
  private nextId = 1
  private shownVoiceId: number | null = null
  private state: PlaybackState = { ...IDLE, sampleRate: null, contextState: 'uninitialized' }
  private readonly listeners = new Set<() => void>()

  /* ---------------- 상태 구독 (React useSyncExternalStore) ---------------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): PlaybackState => this.state

  private setState(patch: Partial<PlaybackState>): void {
    this.state = { ...this.state, ...patch }
    for (const l of this.listeners) l()
  }

  private show(voice: Voice, info: Pick<PlaybackState, 'frequencies' | 'channel' | 'endsAt'>): void {
    this.shownVoiceId = voice.id
    this.setState({ playing: true, kind: voice.kind, startedAt: performance.now(), ...info })
  }

  private setIdle(): void {
    this.shownVoiceId = null
    if (this.state.playing) this.setState(IDLE)
  }

  /* ---------------- AudioContext ---------------- */

  /** 사용자 동작(클릭·키 입력) 안에서 호출해야 소리가 납니다 (브라우저 자동재생 정책). */
  warmUp(): void {
    this.ensureContext()
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'interactive' })
      const bus = new GainNode(ctx, { gain: 1 })
      bus.connect(ctx.destination)
      ctx.onstatechange = () => {
        if (this.ctx === ctx) this.setState({ contextState: ctx.state })
      }
      this.ctx = ctx
      this.bus = bus
      this.setState({ sampleRate: ctx.sampleRate, contextState: ctx.state })
    }
    const ctx = this.ctx
    if (ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => undefined)
    return ctx
  }

  /* ---------------- Voice 생성·정리 ---------------- */

  private startVoice(
    layers: ChannelLayers,
    opts: { kind: PlaybackKind; fadeInSec: number; durationSec?: number; fadeOutSec?: number },
  ): Voice | null {
    const ctx = this.ensureContext()
    const bus = this.bus
    if (!bus) return null
    const nyquist = ctx.sampleRate / 2

    const t0 = ctx.currentTime + 0.005
    const fadeIn = Math.max(0.005, opts.fadeInSec)
    const envelope = new GainNode(ctx, { gain: 0 })
    const merger = new ChannelMergerNode(ctx, { numberOfInputs: 2 })
    const oscByFreq = new Map<number, OscillatorNode>()
    const components: VoiceComponent[] = []

    const channels = [
      ['left', 0],
      ['right', 1],
    ] as const
    for (const [key, ch] of channels) {
      for (const c of layers[key]) {
        if (!(c.gain > 0) || !Number.isFinite(c.frequency) || c.frequency <= 0 || c.frequency >= nyquist) continue
        let osc = oscByFreq.get(c.frequency)
        if (!osc) {
          osc = new OscillatorNode(ctx, { type: 'sine', frequency: c.frequency })
          oscByFreq.set(c.frequency, osc)
        }
        const g = new GainNode(ctx, { gain: c.gain })
        osc.connect(g)
        g.connect(merger, 0, ch)
        components.push({ channel: ch, node: g })
      }
    }
    const oscillators = [...oscByFreq.values()]
    if (oscillators.length === 0) {
      components.forEach((c) => c.node.disconnect())
      return null
    }

    merger.connect(envelope)
    envelope.connect(bus)
    envelope.gain.setValueAtTime(0, t0)
    envelope.gain.linearRampToValueAtTime(1, t0 + fadeIn)

    const voice: Voice = {
      id: this.nextId++,
      kind: opts.kind,
      oscillators,
      components,
      merger,
      envelope,
      timers: [],
      releaseFade: null,
      disposed: false,
    }

    for (const osc of oscillators) osc.start(t0)
    oscillators[0].onended = () => this.disposeVoice(voice)

    if (opts.durationSec != null) {
      const dur = opts.durationSec
      const fadeOut = Math.max(0.005, Math.min(opts.fadeOutSec ?? fadeIn, dur / 2))
      const tEnd = t0 + dur
      envelope.gain.setValueAtTime(1, Math.max(t0 + fadeIn, tEnd - fadeOut))
      envelope.gain.linearRampToValueAtTime(0, tEnd)
      for (const osc of oscillators) osc.stop(tEnd + 0.02)
      const latency = (ctx.outputLatency || 0) + 0.03
      voice.timers.push(window.setTimeout(() => this.onTimedEnd(voice), (dur + latency) * 1000))
      voice.timers.push(window.setTimeout(() => this.disposeVoice(voice), (dur + 0.5) * 1000))
    }

    this.voices.add(voice)
    return voice
  }

  /** 새 Voice를 '현재'로 만들고 이전 Voice는 짧게 페이드아웃 (교차 페이드 → 주파수 변경 시 pop 없음) */
  private replaceCurrent(voice: Voice | null): void {
    const prev = this.current
    this.current = voice
    if (prev && prev !== voice) this.releaseVoice(prev, TONE_RAMP_SEC)
  }

  private onTimedEnd(voice: Voice): void {
    if (this.current === voice) this.current = null
    if (this.shownVoiceId === voice.id) this.setIdle()
  }

  private releaseVoice(voice: Voice, fadeSec: number): void {
    const ctx = this.ctx
    if (voice.disposed || !ctx) return
    if (voice.releaseFade !== null && voice.releaseFade <= fadeSec) return
    voice.releaseFade = fadeSec
    voice.timers.forEach((t) => window.clearTimeout(t))
    voice.timers = []

    const t = ctx.currentTime
    holdParam(voice.envelope.gain, t)
    voice.envelope.gain.linearRampToValueAtTime(0, t + fadeSec)
    for (const osc of voice.oscillators) {
      try {
        osc.stop(t + fadeSec + 0.01)
      } catch {
        /* 이미 정지됨 */
      }
    }
    // onended가 오지 않는 경우(컨텍스트 일시정지 등)를 대비한 정리
    voice.timers.push(window.setTimeout(() => this.disposeVoice(voice), (fadeSec + 0.25) * 1000))
    if (this.current === voice) this.current = null
    if (this.shownVoiceId === voice.id) this.setIdle()
  }

  private disposeVoice(voice: Voice): void {
    if (voice.disposed) return
    voice.disposed = true
    voice.timers.forEach((t) => window.clearTimeout(t))
    voice.timers = []
    for (const osc of voice.oscillators) {
      osc.onended = null
      try {
        osc.stop()
      } catch {
        /* 이미 정지됨 */
      }
      osc.disconnect()
    }
    voice.components.forEach((c) => c.node.disconnect())
    voice.merger.disconnect()
    voice.envelope.disconnect()
    this.voices.delete(voice)
    if (this.current === voice) this.current = null
    if (this.shownVoiceId === voice.id) this.setIdle()
  }

  /* ---------------- 공개 API ---------------- */

  /** 검사음을 계속 재생 (누르고 있는 동안 재생). stopTone()으로 멈춥니다. */
  playTone(frequency: number, gain: number | ChannelGains, channel: OutputChannel): boolean {
    const voice = this.startVoice(toneLayers(frequency, gain, channel), { kind: 'test', fadeInSec: TONE_RAMP_SEC })
    this.replaceCurrent(voice)
    if (!voice) {
      this.setIdle()
      return false
    }
    this.show(voice, { frequencies: [frequency], channel, endsAt: null })
    return true
  }

  /** 현재 소리를 램프로 정지 */
  stopTone(): void {
    if (this.current) this.releaseVoice(this.current, TONE_RAMP_SEC)
    this.setIdle()
  }

  /** 정해진 시간만 재생 (예: 1초 재생) */
  playTimedTone(frequency: number, durationSec: number, gain: number | ChannelGains, channel: OutputChannel): boolean {
    const voice = this.startVoice(toneLayers(frequency, gain, channel), {
      kind: 'test',
      fadeInSec: TONE_RAMP_SEC,
      durationSec,
      fadeOutSec: TONE_RAMP_SEC,
    })
    this.replaceCurrent(voice)
    if (!voice) {
      this.setIdle()
      return false
    }
    this.show(voice, { frequencies: [frequency], channel, endsAt: performance.now() + durationSec * 1000 })
    return true
  }

  /** 재생 중인 검사음의 레벨을 부드럽게 변경 */
  updateToneGain(gain: number | ChannelGains): void {
    const v = this.current
    const ctx = this.ctx
    if (!v || !ctx || v.kind !== 'test') return
    const g: ChannelGains = typeof gain === 'number' ? { left: gain, right: gain } : gain
    const t = ctx.currentTime
    for (const c of v.components) {
      holdParam(c.node.gain, t)
      c.node.gain.setTargetAtTime(c.channel === 0 ? g.left : g.right, t, GAIN_SMOOTHING_SEC)
    }
  }

  /** 합성 명세(StimulusSpec) 그대로 앞부분을 미리듣기 — 파일과 같은 성분·진폭·채널 */
  previewStimulus(spec: StimulusSpec, seconds = PREVIEW_SECONDS): boolean {
    const fade = Math.min(Math.max(spec.fadeInSec, TONE_RAMP_SEC), 1, seconds / 4)
    const voice = this.startVoice(spec.channels, {
      kind: 'preview',
      fadeInSec: fade,
      durationSec: seconds,
      fadeOutSec: fade,
    })
    this.replaceCurrent(voice)
    if (!voice) {
      this.setIdle()
      return false
    }
    this.show(voice, {
      frequencies: uniqueFrequencies(spec.channels),
      channel: describeLayers(spec.channels),
      endsAt: performance.now() + seconds * 1000,
    })
    return true
  }

  /** 두 순음 미리듣기 (간단 버전). gainA/gainB는 이미 정규화된 진폭이어야 합니다. */
  previewMixedTone(
    freqA: number,
    freqB: number,
    gainA: number,
    gainB: number,
    channel: OutputChannel = 'both',
    seconds = PREVIEW_SECONDS,
  ): boolean {
    const pairFor = (on: boolean) =>
      on
        ? [
            { frequency: freqA, gain: gainA },
            { frequency: freqB, gain: gainB },
          ]
        : []
    return this.previewStimulus(
      {
        sampleRate: this.ctx?.sampleRate ?? 48000,
        durationSec: seconds,
        fadeInSec: 0.5,
        fadeOutSec: 0.5,
        channels: { left: pairFor(channel !== 'right'), right: pairFor(channel !== 'left') },
      },
      seconds,
    )
  }

  /** 교정용 기준음 (디지털 레벨 dBFS로 지정). 사람이 착용한 상태에서 쓰지 않습니다. */
  playReferenceTone(frequency: number, dbfs: number, channel: OutputChannel, seconds = 3): boolean {
    const gain = dbToGain(Math.min(-1, dbfs))
    const layers = toneLayers(frequency, gain, channel)
    const voice = this.startVoice(layers, {
      kind: 'reference',
      fadeInSec: TONE_RAMP_SEC,
      durationSec: seconds,
      fadeOutSec: TONE_RAMP_SEC,
    })
    this.replaceCurrent(voice)
    if (!voice) {
      this.setIdle()
      return false
    }
    this.show(voice, { frequencies: [frequency], channel, endsAt: performance.now() + seconds * 1000 })
    return true
  }

  /** 긴급 정지: 모든 소리를 12 ms 램프로 즉시 정지 */
  stopAll(): void {
    for (const v of [...this.voices]) this.releaseVoice(v, EMERGENCY_RAMP_SEC)
    this.current = null
    this.setIdle()
  }

  /** AudioContext와 모든 노드 정리 */
  dispose(): void {
    this.stopAll()
    for (const v of [...this.voices]) this.disposeVoice(v)
    const ctx = this.ctx
    this.ctx = null
    this.bus?.disconnect()
    this.bus = null
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined)
    this.setState({ ...IDLE, sampleRate: null, contextState: 'uninitialized' })
  }

  /** 새로고침·탭 이동·창 전환 시 소리가 남지 않도록 페이지 이벤트에 연결 */
  installLifecycleGuards(): () => void {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') this.stopAll()
    }
    const onBlur = () => this.stopAll()
    const onBeforeUnload = () => this.stopAll()
    const onPageHide = () => this.dispose()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', onPageHide)
    }
  }
}

/** 앱 전체에서 하나만 사용 */
export const audioEngine = new AudioEngine()

if (import.meta.hot) {
  import.meta.hot.dispose(() => audioEngine.dispose())
}
