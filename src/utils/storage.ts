/**
 * 브라우저 LocalStorage 저장소. 모든 데이터는 이 PC의 이 브라우저 안에만 저장되며 외부로 전송되지 않습니다.
 * (다른 PC와 공유하려면 JSON 내보내기/가져오기를 사용합니다.)
 */
import type { AppSettings } from '../types/calibration'
import type { TestSession } from '../types/patient'
import type { StimulusPreset } from '../types/stimulus'
import { sanitizeCalibration, sanitizePreset, sanitizeSession } from './sessionSchema'

const KEYS = {
  sessions: 'soyul-pta.sessions.v1',
  presets: 'soyul-pta.presets.v1',
  settings: 'soyul-pta.settings.v1',
  draft: 'soyul-pta.draft.v1',
} as const

export type SaveResult = { ok: true } | { ok: false; error: string }

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): SaveResult {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return { ok: true }
  } catch (err) {
    const quota = err instanceof DOMException && err.name === 'QuotaExceededError'
    return {
      ok: false,
      error: quota
        ? '브라우저 저장 공간이 가득 찼습니다. 오래된 기록을 JSON으로 내보낸 뒤 삭제해 주세요.'
        : '브라우저 저장소를 사용할 수 없습니다 (시크릿 모드이거나 저장이 차단되어 있을 수 있습니다).',
    }
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  measurementMode: 'relative',
  calibration: null,
  educationOpen: true,
}

export const storage = {
  loadSessions(): TestSession[] {
    const raw = readJson(KEYS.sessions)
    if (!Array.isArray(raw)) return []
    return raw.map(sanitizeSession).filter((s): s is TestSession => s !== null)
  },
  saveSessions(sessions: TestSession[]): SaveResult {
    return writeJson(KEYS.sessions, sessions)
  },

  loadPresets(): StimulusPreset[] {
    const raw = readJson(KEYS.presets)
    if (!Array.isArray(raw)) return []
    return raw.map(sanitizePreset).filter((p): p is StimulusPreset => p !== null)
  },
  savePresets(presets: StimulusPreset[]): SaveResult {
    return writeJson(KEYS.presets, presets)
  },

  loadSettings(): AppSettings {
    const raw = readJson(KEYS.settings)
    if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS
    const o = raw as Record<string, unknown>
    const calibration = sanitizeCalibration(o.calibration)
    return {
      // 교정표가 없으면 교정 모드로 시작하지 않음
      measurementMode: o.measurementMode === 'calibrated' && calibration ? 'calibrated' : 'relative',
      calibration,
      educationOpen: o.educationOpen !== false,
    }
  },
  saveSettings(settings: AppSettings): SaveResult {
    return writeJson(KEYS.settings, settings)
  },

  /** 작업 중인 검사 (새로고침해도 입력이 사라지지 않도록 자동 보관) */
  loadDraft(): { session: TestSession; dirty: boolean } | null {
    const raw = readJson(KEYS.draft)
    if (typeof raw !== 'object' || raw === null) return null
    const o = raw as Record<string, unknown>
    const session = sanitizeSession(o.session)
    return session ? { session, dirty: o.dirty === true } : null
  },
  saveDraft(session: TestSession, dirty: boolean): SaveResult {
    return writeJson(KEYS.draft, { session, dirty })
  },
}
