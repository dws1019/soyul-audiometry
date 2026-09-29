import { useEffect, useReducer } from 'react'
import { DEFAULT_STIMULUS, TEST_FREQUENCIES } from '../config/constants'
import type { Ear, ThresholdUnit } from '../types/audiometry'
import type { PatientInfo, TestSession } from '../types/patient'
import type { StimulusRecord, StimulusSettings } from '../types/stimulus'
import { todayLocalIso } from '../utils/format'
import { analyzeHearing, countEntered, emptyThresholds } from '../utils/hearingAnalysis'
import { createId } from '../utils/id'
import { storage } from '../utils/storage'

export interface SessionState {
  session: TestSession
  /** 마지막 저장 이후 바뀐 내용이 있는지 */
  dirty: boolean
}

export type SessionAction =
  | { type: 'patient'; patch: Partial<PatientInfo> }
  | { type: 'threshold'; ear: Ear; frequency: number; value: number | null }
  | { type: 'clearThresholds' }
  | { type: 'setUnit'; unit: ThresholdUnit; calibrationProfileId: string | null }
  | { type: 'stimulus'; patch: Partial<StimulusSettings> }
  | { type: 'logStimulus'; record: StimulusRecord }
  | { type: 'load'; session: TestSession }
  | { type: 'new'; unit: ThresholdUnit; calibrationProfileId: string | null }
  | { type: 'saved'; at: string }

export function createSession(unit: ThresholdUnit, calibrationProfileId: string | null = null): TestSession {
  const now = new Date().toISOString()
  return {
    id: createId(),
    schemaVersion: 1,
    patient: { patientId: '', testDate: todayLocalIso(), memo: '' },
    createdAt: now,
    updatedAt: now,
    audiometry: { unit, thresholds: emptyThresholds(TEST_FREQUENCIES), calibrationProfileId },
    vulnerable: { L: [], R: [] },
    stimulus: { ...DEFAULT_STIMULUS },
    stimulusLog: [],
  }
}

function touch(s: TestSession): TestSession {
  return {
    ...s,
    updatedAt: new Date().toISOString(),
    vulnerable: analyzeHearing(s.audiometry.thresholds, TEST_FREQUENCIES),
  }
}

function reducer(state: SessionState, action: SessionAction): SessionState {
  const s = state.session
  switch (action.type) {
    case 'patient':
      return { session: touch({ ...s, patient: { ...s.patient, ...action.patch } }), dirty: true }
    case 'threshold': {
      const thresholds = {
        ...s.audiometry.thresholds,
        [action.ear]: { ...s.audiometry.thresholds[action.ear], [action.frequency]: action.value },
      }
      return { session: touch({ ...s, audiometry: { ...s.audiometry, thresholds } }), dirty: true }
    }
    case 'clearThresholds':
      return {
        session: touch({ ...s, audiometry: { ...s.audiometry, thresholds: emptyThresholds(TEST_FREQUENCIES) } }),
        dirty: true,
      }
    case 'setUnit':
      return {
        session: touch({
          ...s,
          audiometry: {
            unit: action.unit,
            calibrationProfileId: action.calibrationProfileId,
            thresholds: emptyThresholds(TEST_FREQUENCIES),
          },
        }),
        // 비어 있던 검사의 단위만 바뀐 경우는 '저장 안 됨'으로 표시하지 않음
        dirty: state.dirty || countEntered(s.audiometry.thresholds) > 0,
      }
    case 'stimulus':
      return { session: touch({ ...s, stimulus: { ...s.stimulus, ...action.patch } }), dirty: true }
    case 'logStimulus':
      return { session: touch({ ...s, stimulusLog: [action.record, ...s.stimulusLog] }), dirty: true }
    case 'load':
      return { session: action.session, dirty: false }
    case 'new':
      return { session: createSession(action.unit, action.calibrationProfileId), dirty: false }
    case 'saved':
      return { session: { ...s, updatedAt: action.at }, dirty: false }
  }
}

function init(unit: ThresholdUnit): SessionState {
  return storage.loadDraft() ?? { session: createSession(unit), dirty: false }
}

/** 현재 검사 세션. 변경 내용은 브라우저에 자동 보관되어 새로고침해도 유지됩니다. */
export function useSession(initialUnit: ThresholdUnit) {
  const [state, dispatch] = useReducer(reducer, initialUnit, init)

  useEffect(() => {
    const t = window.setTimeout(() => storage.saveDraft(state.session, state.dirty), 300)
    return () => window.clearTimeout(t)
  }, [state])

  return [state, dispatch] as const
}
