import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { AudiogramCard } from './components/Audiogram'
import { CalibrationDialog } from './components/CalibrationDialog'
import { FrequencyPanel } from './components/FrequencyPanel'
import { HearingResultTable } from './components/HearingResultTable'
import { PatientEducation } from './components/PatientEducation'
import { PatientInfo } from './components/PatientInfo'
import { PrintReport } from './components/PrintReport'
import { SessionHistory } from './components/SessionHistory'
import { SimpleTestMode } from './components/SimpleTestMode'
import { SoundTherapyGenerator } from './components/SoundTherapyGenerator'
import { ToastStack, type ToastMessage, type ToastTone } from './components/Toast'
import { ToneController } from './components/ToneController'
import { VulnerableFrequencyPanel, type StimulusSlot } from './components/VulnerableFrequencyPanel'
import {
  CLINICAL_TEST_ORDER,
  MASTER_LOCK_ABOVE,
  PREVIEW_SECONDS,
  scaleFor,
  TEST_FREQUENCIES,
  TONE_GENERATOR_DISCLAIMER,
} from './config/constants'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { usePlayback } from './hooks/usePlayback'
import { useSession } from './hooks/useSession'
import type { Ear, EarSelection, PlayMode, StaircaseResponse, StaircaseState, ThresholdUnit } from './types/audiometry'
import type { AppSettings, CalibrationProfile, MeasurementMode } from './types/calibration'
import type { TestSession } from './types/patient'
import type { StimulusPreset, StimulusSettings } from './types/stimulus'
import { audioEngine, type OutputChannel } from './utils/audioEngine'
import { downloadBlob, jsonFileName, parseSessionsJson, sessionsToCsvBlob, sessionsToJsonBlob } from './utils/exporters'
import { compactDate, EAR_LABEL, formatHz, formatLevel, formatTime, unitLongLabel } from './utils/format'
import { isPlayableAt } from './utils/frequencyValidation'
import {
  analyzeHearing,
  applyStaircaseResponse,
  countEntered,
  emphasisMap,
  emptyStaircase,
} from './utils/hearingAnalysis'
import { createId } from './utils/id'
import { computePresentationGains, maxPresentableHl } from './utils/levels'
import type { GeneratedAudio } from './utils/stimulusGenerator'
import { buildStimulusSpec } from './utils/stimulusSynth'
import { storage } from './utils/storage'

const channelFor = (ear: EarSelection): OutputChannel => (ear === 'L' ? 'left' : ear === 'R' ? 'right' : 'both')

export default function App() {
  /* ---------------- 설정 · 세션 ---------------- */
  const [settings, setSettings] = useState<AppSettings>(() => storage.loadSettings())
  useEffect(() => {
    storage.saveSettings(settings)
  }, [settings])
  const updateSettings = (patch: Partial<AppSettings>) => setSettings((prev) => ({ ...prev, ...patch }))

  const profile = settings.calibration
  const presentationUnit: ThresholdUnit = settings.measurementMode === 'calibrated' && profile ? 'dBHL' : 'relative'
  const scale = scaleFor(presentationUnit)

  const [{ session, dirty }, dispatch] = useSession(presentationUnit)
  const recordUnit = session.audiometry.unit
  const [savedSessions, setSavedSessions] = useState<TestSession[]>(() => storage.loadSessions())
  const [presets, setPresets] = useState<StimulusPreset[]>(() => storage.loadPresets())
  const [historyFilter, setHistoryFilter] = useState('')

  /* ---------------- 검사 컨트롤 상태 ---------------- */
  const [frequency, setFrequency] = useState(1000)
  const [ear, setEar] = useState<EarSelection>('R')
  const [playMode, setPlayMode] = useState<PlayMode>('timed')
  const [level, setLevel] = useState(scale.initial)
  const [unlocked, setUnlocked] = useState(false)
  const [masterUnlocked, setMasterUnlocked] = useState(false)
  const [staircases, setStaircases] = useState<Record<string, StaircaseState>>({})
  const [calibrationOpen, setCalibrationOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const playback = usePlayback()
  /** 누르고 있는 동안 재생 중인 검사음 (없으면 null) */
  const holdRef = useRef<{ frequency: number; ear: EarSelection } | null>(null)

  const toast = useCallback((text: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, text, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  /* ---------------- 오디오 수명 관리 ---------------- */
  useEffect(() => {
    const removeGuards = audioEngine.installLifecycleGuards()
    // 첫 사용자 동작에서 AudioContext 준비 → 출력 장치 샘플레이트 확인(나이퀴스트 검증)
    const warm = () => audioEngine.warmUp()
    window.addEventListener('pointerdown', warm, { once: true, capture: true })
    window.addEventListener('keydown', warm, { once: true, capture: true })
    return () => {
      removeGuards()
      window.removeEventListener('pointerdown', warm, { capture: true })
      window.removeEventListener('keydown', warm, { capture: true })
      audioEngine.dispose()
    }
  }, [])

  // 재생이 멈추면(긴급 정지·창 전환 등) 누르고 있던 상태도 해제 → 이후 설정 변경으로 소리가 다시 나지 않음
  useEffect(() => {
    if (!playback.playing || playback.kind !== 'test') holdRef.current = null
  }, [playback.playing, playback.kind])

  const stopAll = useCallback(() => {
    holdRef.current = null
    audioEngine.stopAll()
  }, [])

  /* ---------------- 레벨 · 안전 상한 ---------------- */
  const levelCeiling = useMemo(() => {
    if (presentationUnit === 'relative') return scale.max
    const ears: Ear[] = ear === 'both' ? ['L', 'R'] : [ear]
    const maxes = ears.map((e) => maxPresentableHl(profile, e, frequency)).filter((v): v is number => v !== null)
    return maxes.length ? Math.min(scale.max, ...maxes) : scale.max
  }, [presentationUnit, scale.max, ear, profile, frequency])
  const effectiveMax = Math.min(levelCeiling, unlocked ? scale.max : scale.lockAbove)

  // 잠금을 다시 걸거나 상한이 낮아지면 레벨도 즉시 낮춤
  useEffect(() => {
    if (level > effectiveMax) setLevel(Math.max(scale.min, effectiveMax))
  }, [level, effectiveMax, scale.min])

  const changeLevel = (v: number) => {
    const snapped = Math.round(v / scale.step) * scale.step
    setLevel(Math.max(scale.min, Math.min(effectiveMax, snapped)))
  }

  const gains = computePresentationGains(level, presentationUnit, ear, frequency, profile)
  const presentationError =
    gains.error ??
    (!isPlayableAt(frequency, playback.sampleRate)
      ? `현재 출력 장치(${playback.sampleRate} Hz)에서는 ${formatHz(frequency)}를 재생할 수 없습니다.`
      : null)

  /* ---------------- 검사음 제시 ---------------- */
  const gainsFor = (f: number) => computePresentationGains(level, presentationUnit, ear, f, profile)

  const startHold = (f = frequency) => {
    audioEngine.warmUp()
    if (f !== frequency) setFrequency(f)
    const g = gainsFor(f)
    if (g.error) return toast(g.error, 'warn')
    if (!isPlayableAt(f, audioEngine.getSnapshot().sampleRate)) return toast(`${formatHz(f)}는 현재 출력 장치에서 재생할 수 없습니다.`, 'warn')
    if (audioEngine.playTone(f, g, channelFor(ear))) holdRef.current = { frequency: f, ear }
  }

  const endHold = () => {
    if (!holdRef.current) return
    holdRef.current = null
    audioEngine.stopTone()
  }

  const playTimed = (f = frequency) => {
    audioEngine.warmUp()
    if (f !== frequency) setFrequency(f)
    const g = gainsFor(f)
    if (g.error) return toast(g.error, 'warn')
    if (!isPlayableAt(f, audioEngine.getSnapshot().sampleRate)) return toast(`${formatHz(f)}는 현재 출력 장치에서 재생할 수 없습니다.`, 'warn')
    audioEngine.playTimedTone(f, 1, g, channelFor(ear))
  }

  // 누르고 있는 동안: 레벨 변경은 부드럽게, 주파수·귀 변경은 교차 페이드로 반영
  useEffect(() => {
    const h = holdRef.current
    const state = audioEngine.getSnapshot()
    if (!h || !state.playing || state.kind !== 'test') return
    const g = computePresentationGains(level, presentationUnit, ear, frequency, profile)
    if (g.error) {
      holdRef.current = null
      audioEngine.stopTone()
      return
    }
    if (h.frequency !== frequency || h.ear !== ear) {
      audioEngine.playTone(frequency, g, channelFor(ear))
      holdRef.current = { frequency, ear }
    } else {
      audioEngine.updateToneGain(g)
    }
  }, [level, frequency, ear, presentationUnit, profile])

  /* ---------------- 간이 검사 모드 ---------------- */
  const recordingEnabled = recordUnit === presentationUnit
  const blockedReason =
    ear === 'both'
      ? '양쪽 제시 중에는 기록할 수 없습니다. 왼쪽(L) 또는 오른쪽(R) 귀를 선택하세요.'
      : !recordingEnabled
        ? `이 검사는 ${unitLongLabel(recordUnit)}로 기록 중이라 현재 측정 모드의 레벨을 기록할 수 없습니다.`
        : null
  const stairKey = ear === 'both' ? null : `${ear}:${frequency}`

  const respond = (response: StaircaseResponse) => {
    if (blockedReason || ear === 'both') return toast(blockedReason ?? '', 'warn')
    const key = `${ear}:${frequency}`
    const step = applyStaircaseResponse(staircases[key] ?? emptyStaircase(), level, response, scale, effectiveMax)
    setStaircases((prev) => ({ ...prev, [key]: step.next }))
    setLevel(step.nextLevel)
    if (step.thresholdFound !== null) {
      dispatch({ type: 'threshold', ear, frequency, value: step.thresholdFound })
      toast(
        `${EAR_LABEL[ear]} ${formatHz(frequency)} 역치 ${formatLevel(step.thresholdFound, recordUnit)} 기록 (상승 제시 2회 반응)`,
        'success',
      )
    }
  }

  const recordCurrent = () => {
    if (blockedReason || ear === 'both') return toast(blockedReason ?? '', 'warn')
    dispatch({ type: 'threshold', ear, frequency, value: level })
    toast(`${EAR_LABEL[ear]} ${formatHz(frequency)} = ${formatLevel(level, recordUnit)} 기록`, 'success')
  }

  const orderIndex = CLINICAL_TEST_ORDER.indexOf(frequency)
  const nextFrequency =
    orderIndex >= 0 && orderIndex < CLINICAL_TEST_ORDER.length - 1 ? CLINICAL_TEST_ORDER[orderIndex + 1] : null

  /* ---------------- 단축키 ---------------- */
  useKeyboardShortcuts({
    onPresentStart: () => (playMode === 'hold' ? startHold() : playTimed()),
    onPresentEnd: endHold,
    onSelectFrequencyIndex: (i) => {
      const f = TEST_FREQUENCIES[i]
      if (f !== undefined) setFrequency(f)
    },
    onSelectEar: setEar,
    onHeard: () => respond('heard'),
    onNotHeard: () => respond('notHeard'),
    onLevelStep: (d) => changeLevel(level + d * 5),
    onEmergencyStop: stopAll,
  })

  /* ---------------- 측정 모드 · 교정 ---------------- */
  const switchUnit = (unit: ThresholdUnit, profileId: string | null): boolean => {
    if (session.audiometry.unit === unit) return true
    if (
      countEntered(session.audiometry.thresholds) > 0 &&
      !window.confirm('기록 단위가 바뀌면 지금 입력한 검사 결과가 초기화됩니다. 계속할까요? (필요하면 먼저 검사를 저장하세요)')
    )
      return false
    dispatch({ type: 'setUnit', unit, calibrationProfileId: profileId })
    return true
  }

  const resetTestControls = (unit: ThresholdUnit) => {
    stopAll()
    setLevel(scaleFor(unit).initial)
    setUnlocked(false)
    setStaircases({})
  }

  const changeMode = (mode: MeasurementMode) => {
    if (mode === settings.measurementMode) return
    if (mode === 'calibrated' && !profile) {
      setCalibrationOpen(true)
      return
    }
    const unit: ThresholdUnit = mode === 'calibrated' ? 'dBHL' : 'relative'
    if (!switchUnit(unit, mode === 'calibrated' ? (profile?.id ?? null) : null)) return
    updateSettings({ measurementMode: mode })
    resetTestControls(unit)
  }

  const saveCalibration = (p: CalibrationProfile) => {
    if (!switchUnit('dBHL', p.id)) return
    updateSettings({ calibration: p, measurementMode: 'calibrated' })
    resetTestControls('dBHL')
    setCalibrationOpen(false)
    toast('교정표를 저장했습니다. 교정 모드(dB HL)로 검사합니다.', 'success')
  }

  const deleteCalibration = () => {
    if (!switchUnit('relative', null)) return
    updateSettings({ calibration: null, measurementMode: 'relative' })
    resetTestControls('relative')
    setCalibrationOpen(false)
  }

  /* ---------------- 세션 저장 · 불러오기 ---------------- */
  const persistSessions = (next: TestSession[]): boolean => {
    const r = storage.saveSessions(next)
    if (!r.ok) {
      toast(r.error, 'warn')
      return false
    }
    setSavedSessions(next)
    return true
  }

  const saveSession = () => {
    const at = new Date().toISOString()
    const toSave: TestSession = {
      ...session,
      updatedAt: at,
      vulnerable: analyzeHearing(session.audiometry.thresholds, TEST_FREQUENCIES),
    }
    if (!persistSessions([toSave, ...savedSessions.filter((s) => s.id !== toSave.id)])) return
    dispatch({ type: 'saved', at })
    toast('검사를 저장했습니다.', 'success')
  }

  const confirmDiscard = () =>
    !dirty || window.confirm('저장하지 않은 변경 내용이 있습니다. 저장하지 않고 계속할까요?')

  const newSession = () => {
    if (!confirmDiscard()) return
    stopAll()
    dispatch({ type: 'new', unit: presentationUnit, calibrationProfileId: presentationUnit === 'dBHL' ? (profile?.id ?? null) : null })
    setStaircases({})
    setLevel(scale.initial)
    setFrequency(1000)
    setUnlocked(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const loadSession = (s: TestSession) => {
    if (s.id !== session.id && !confirmDiscard()) return
    stopAll()
    dispatch({ type: 'load', session: s })
    setStaircases({})
    toast(`${s.patient.testDate} ${s.patient.patientId || '(ID 없음)'} 검사를 불러왔습니다.`, 'success')
    document.getElementById('test')?.scrollIntoView({ behavior: 'smooth' })
  }

  const deleteSession = (s: TestSession) => {
    if (!window.confirm(`${s.patient.testDate} · ${s.patient.patientId || '(ID 없음)'} 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return
    if (persistSessions(savedSessions.filter((x) => x.id !== s.id))) toast('기록을 삭제했습니다.')
  }

  const importJson = async (file: File) => {
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('파일이 너무 큽니다 (20 MB 초과).')
      const { sessions, skipped } = parseSessionsJson(await file.text())
      const map = new Map(savedSessions.map((s) => [s.id, s]))
      let added = 0
      let updated = 0
      for (const s of sessions) {
        const existing = map.get(s.id)
        if (!existing) added++
        else if (s.updatedAt > existing.updatedAt) updated++
        else continue
        map.set(s.id, s)
      }
      if (persistSessions([...map.values()])) {
        toast(`가져오기 완료: 새 기록 ${added}건, 갱신 ${updated}건${skipped ? `, 형식 오류 ${skipped}건 건너뜀` : ''}`, 'success')
      }
    } catch (err) {
      toast(`가져오기 실패: ${err instanceof Error ? err.message : String(err)}`, 'warn')
    }
  }

  /* ---------------- 음향자극음 ---------------- */
  const stimulus = session.stimulus
  const patchStimulus = (patch: Partial<StimulusSettings>) => dispatch({ type: 'stimulus', patch })

  // 잠금 상태에서는 (잠금을 다시 걸거나, 높은 값의 기록·프리셋을 불러와도) 마스터 볼륨이 상한을 넘지 않음
  useEffect(() => {
    if (!masterUnlocked && stimulus.masterVolume > MASTER_LOCK_ABOVE) {
      dispatch({ type: 'stimulus', patch: { masterVolume: MASTER_LOCK_ABOVE } })
      toast(`마스터 볼륨을 잠금 상한 ${MASTER_LOCK_ABOVE} %로 낮췄습니다.`, 'warn')
    }
  }, [masterUnlocked, stimulus.masterVolume, dispatch, toast])

  const assignSlot = (slot: StimulusSlot, f: number) => {
    const key = `freq${slot}` as const
    patchStimulus({ [key]: f })
    toast(`주파수 ${slot} = ${formatHz(f)} (의료진 선택)`, 'success')
  }

  const previewStimulus = () => {
    audioEngine.warmUp()
    holdRef.current = null
    if (!audioEngine.previewStimulus(buildStimulusSpec(stimulus), PREVIEW_SECONDS)) {
      toast('재생할 수 있는 소리가 없습니다. 음량과 주파수를 확인하세요.', 'warn')
    }
  }

  const onGenerated = (r: GeneratedAudio) => {
    dispatch({
      type: 'logStimulus',
      record: {
        id: createId(),
        createdAt: r.createdAt,
        fileName: r.fileName,
        format: r.settings.format,
        sizeBytes: r.sizeBytes,
        peakDbfs: r.peakDbfs,
        settings: r.settings,
      },
    })
    toast('음원을 만들었습니다. 다운로드를 누르세요.', 'success')
  }

  const savePreset = (name: string) => {
    const next = [...presets, { id: createId(), name, createdAt: new Date().toISOString(), settings: { ...stimulus } }]
    const r = storage.savePresets(next)
    if (!r.ok) return toast(r.error, 'warn')
    setPresets(next)
    toast(`프리셋 '${name}'을 저장했습니다.`, 'success')
  }

  const deletePreset = (id: string) => {
    const target = presets.find((x) => x.id === id)
    if (!target || !window.confirm(`프리셋 '${target.name}'을 삭제할까요?`)) return
    const next = presets.filter((x) => x.id !== id)
    if (storage.savePresets(next).ok) setPresets(next)
  }

  /* ---------------- 파생 값 ---------------- */
  const emphasis = useMemo(() => emphasisMap(session.vulnerable), [session.vulnerable])
  const knownPatientIds = useMemo(
    () => [...new Set(savedSessions.map((s) => s.patient.patientId).filter(Boolean))].sort(),
    [savedSessions],
  )
  const previousCount = savedSessions.filter(
    (s) => s.id !== session.id && s.patient.patientId && s.patient.patientId === session.patient.patientId,
  ).length
  const savedCopy = savedSessions.find((s) => s.id === session.id)
  const playingFrequency = playback.playing && playback.kind === 'test' ? (playback.frequencies[0] ?? null) : null
  const resultNotice = !recordingEnabled
    ? `이 검사는 ${unitLongLabel(recordUnit)}로 기록되어 현재 측정 모드와 다릅니다. 값은 직접 수정할 수 있지만 검사음 제시 결과는 기록되지 않습니다.`
    : null

  return (
    <div className="app">
      <AppHeader
        playback={playback}
        selectedFrequency={frequency}
        selectedEar={ear}
        patientLabel={session.patient.patientId ? `환자 ${session.patient.patientId}` : '환자 ID 미입력'}
        dirty={dirty}
        onStopAll={stopAll}
      />

      <main>
        <div className="band" id="patient">
          <div className="container stack">
            <PatientInfo
              patient={session.patient}
              onChange={(patch) => dispatch({ type: 'patient', patch })}
              knownPatientIds={knownPatientIds}
              previousCount={previousCount}
              dirty={dirty}
              savedLabel={savedCopy ? formatTime(savedCopy.updatedAt) : null}
              onNew={newSession}
              onSave={saveSession}
              onPrint={() => window.print()}
              onShowHistory={() => {
                setHistoryFilter(session.patient.patientId)
                document.getElementById('records')?.scrollIntoView({ behavior: 'smooth' })
              }}
            />
            <PatientEducation
              open={settings.educationOpen}
              onToggle={() => updateSettings({ educationOpen: !settings.educationOpen })}
            />
          </div>
        </div>

        <div className="band band--green" id="test">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">PURE TONE AUDIOMETRY</p>
              <h2 className="section-title">
                순음청력검사 <strong>주파수별 검사 · 결과 기록</strong>
              </h2>
            </div>
            <div className="test-grid" id="test-grid">
              <FrequencyPanel
                frequencies={TEST_FREQUENCIES}
                selected={frequency}
                playingFrequency={playingFrequency}
                thresholds={session.audiometry.thresholds}
                unit={recordUnit}
                playMode={playMode}
                sampleRate={playback.sampleRate}
                onTimed={playTimed}
                onHoldStart={startHold}
                onHoldEnd={endHold}
              />
              <ToneController
                playback={playback}
                selectedFrequency={frequency}
                ear={ear}
                onEarChange={setEar}
                playMode={playMode}
                onPlayModeChange={(m) => {
                  endHold()
                  setPlayMode(m)
                }}
                scale={scale}
                level={level}
                onLevelChange={changeLevel}
                levelCeiling={levelCeiling}
                unlocked={unlocked}
                onUnlockChange={setUnlocked}
                presentationError={presentationError}
                onHoldStart={() => startHold()}
                onHoldEnd={endHold}
                onTimed={() => playTimed()}
                measurementMode={presentationUnit === 'dBHL' ? 'calibrated' : 'relative'}
                calibrationName={profile?.name ?? null}
                onMeasurementModeChange={changeMode}
                onOpenCalibration={() => setCalibrationOpen(true)}
              >
                <SimpleTestMode
                  ear={ear}
                  frequency={frequency}
                  level={level}
                  scale={scale}
                  staircase={stairKey ? staircases[stairKey] : undefined}
                  recordedValue={ear === 'both' ? null : (session.audiometry.thresholds[ear][frequency] ?? null)}
                  blockedReason={blockedReason}
                  onHeard={() => respond('heard')}
                  onNotHeard={() => respond('notHeard')}
                  onRecordCurrent={recordCurrent}
                  onReset={() =>
                    stairKey &&
                    setStaircases((prev) => {
                      const next = { ...prev }
                      delete next[stairKey]
                      return next
                    })
                  }
                  nextFrequency={nextFrequency}
                  onNext={() => nextFrequency !== null && setFrequency(nextFrequency)}
                />
              </ToneController>
              <div className="results-col">
                <AudiogramCard
                  thresholds={session.audiometry.thresholds}
                  unit={recordUnit}
                  frequencies={TEST_FREQUENCIES}
                  emphasis={emphasis}
                  selectedFrequency={frequency}
                  testDate={session.patient.testDate}
                />
                <HearingResultTable
                  frequencies={TEST_FREQUENCIES}
                  thresholds={session.audiometry.thresholds}
                  scale={scaleFor(recordUnit)}
                  selectedFrequency={frequency}
                  selectedEar={ear}
                  emphasis={emphasis}
                  notice={resultNotice}
                  onChange={(e, f, value) => dispatch({ type: 'threshold', ear: e, frequency: f, value })}
                  onSelectFrequency={setFrequency}
                  onClear={() => {
                    if (countEntered(session.audiometry.thresholds) === 0) return
                    if (window.confirm('입력한 좌우 검사 결과를 모두 지울까요?')) {
                      dispatch({ type: 'clearThresholds' })
                      setStaircases({})
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="band" id="analysis">
          <div className="container">
            <VulnerableFrequencyPanel
              report={session.vulnerable}
              unit={recordUnit}
              outputMode={stimulus.outputMode}
              onAssign={assignSlot}
            />
          </div>
        </div>

        <div className="band band--green" id="stimulus">
          <div className="container">
            <SoundTherapyGenerator
              settings={stimulus}
              onChange={patchStimulus}
              report={session.vulnerable}
              liveSampleRate={playback.sampleRate}
              playback={playback}
              onPreview={previewStimulus}
              onStopPreview={() => audioEngine.stopTone()}
              log={session.stimulusLog}
              onGenerated={onGenerated}
              presets={presets}
              onSavePreset={savePreset}
              onApplyPreset={(p) => {
                patchStimulus({ ...p.settings })
                toast(`프리셋 '${p.name}'을 불러왔습니다.`)
              }}
              onDeletePreset={deletePreset}
              masterUnlocked={masterUnlocked}
              onMasterUnlockedChange={setMasterUnlocked}
            />
          </div>
        </div>

        <div className="band" id="records">
          <div className="container">
            <SessionHistory
              sessions={savedSessions}
              filter={historyFilter}
              onFilterChange={setHistoryFilter}
              currentId={session.id}
              onLoad={loadSession}
              onDelete={deleteSession}
              onExportJson={(list) => downloadBlob(sessionsToJsonBlob(list), jsonFileName())}
              onExportCsv={(list) => downloadBlob(sessionsToCsvBlob(list), `audiometry_records_${compactDate()}.csv`)}
              onImport={importJson}
            />
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <div className="container">
          <p>{TONE_GENERATOR_DISCLAIMER}</p>
          <p>
            이 프로그램은 특정 주파수가 특정 질환을 치료한다고 판단하지 않습니다. 음향자극 주파수는 의료진이 검사 결과와
            환자 상태를 검토한 뒤 직접 선택합니다. · 소율한의원
          </p>
        </div>
      </footer>

      <CalibrationDialog
        open={calibrationOpen}
        profile={profile}
        onClose={() => setCalibrationOpen(false)}
        onSave={saveCalibration}
        onDelete={deleteCalibration}
        onPlayReference={(f, dbfs, ch) => {
          audioEngine.warmUp()
          audioEngine.playReferenceTone(f, dbfs, ch)
        }}
      />
      <ToastStack toasts={toasts} />
      <PrintReport session={session} />
    </div>
  )
}
