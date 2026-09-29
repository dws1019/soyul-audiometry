import { TEST_FREQUENCIES } from '../config/constants'
import type { TestSession } from '../types/patient'
import { compactDate, durationTag, formatDateTime, OUTPUT_MODE_LABEL, volumeRatio } from './format'
import { emphasizedEntries } from './hearingAnalysis'
import { sanitizeSession } from './sessionSchema'

/** Blob을 파일로 저장 (브라우저 다운로드) */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 큰 파일 저장이 시작될 시간을 둔 뒤 해제
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const APP_ID = 'soyul-audiometry'

export function sessionsToJsonBlob(sessions: TestSession[]): Blob {
  const payload = { app: APP_ID, schemaVersion: 1, exportedAt: new Date().toISOString(), sessions }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

export function jsonFileName(prefix = 'audiometry_records'): string {
  return `${prefix}_${compactDate()}.json`
}

/** JSON 가져오기. 형식이 맞지 않는 항목은 건너뜁니다. */
export function parseSessionsJson(text: string): { sessions: TestSession[]; skipped: number } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('JSON 형식이 아닙니다.')
  }
  const list: unknown[] = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && Array.isArray((data as { sessions?: unknown }).sessions)
      ? ((data as { sessions: unknown[] }).sessions)
      : typeof data === 'object' && data !== null && 'audiometry' in data
        ? [data]
        : []
  if (list.length === 0) throw new Error('가져올 검사 기록이 없습니다.')
  const sessions = list.map(sanitizeSession).filter((s): s is TestSession => s !== null)
  return { sessions, skipped: list.length - sessions.length }
}

/* ---------------- CSV ---------------- */

/** 스프레드시트 수식 실행 방지 (=, +, -, @로 시작하는 문자열 셀) */
function safeText(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
}

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function sessionsToCsvBlob(sessions: TestSession[]): Blob {
  const freqCols = (ear: 'L' | 'R') => TEST_FREQUENCIES.map((f) => `${ear}_${f}Hz`)
  const header = [
    '세션ID',
    '환자ID',
    '검사날짜',
    '기록단위',
    ...freqCols('L'),
    ...freqCols('R'),
    '왼쪽_상대적취약주파수',
    '오른쪽_상대적취약주파수',
    '자극음_출력방식',
    '자극음_의료진선택주파수',
    '자극음_A:B음량',
    '자극음_마스터(%)',
    '자극음_길이',
    '생성음원수',
    '생성음원_파일명',
    '메모',
    '생성시각',
    '수정시각',
  ]

  const rows = sessions.map((s) => {
    const { thresholds, unit } = s.audiometry
    const st = s.stimulus
    const top = (ear: 'L' | 'R') =>
      emphasizedEntries(s.vulnerable[ear])
        .map((r) => `${r.rank}위 ${r.frequency}Hz(${r.value})`)
        .join(' / ')
    const freqs =
      st.outputMode === 'split'
        ? `L ${st.freqA}+${st.freqB}Hz / R ${st.freqC}+${st.freqD}Hz`
        : `${st.freqA}+${st.freqB}Hz`
    return [
      s.id,
      safeText(s.patient.patientId),
      s.patient.testDate,
      unit === 'dBHL' ? 'dB HL' : '상대역치(%)',
      ...TEST_FREQUENCIES.map((f) => thresholds.L[f] ?? null),
      ...TEST_FREQUENCIES.map((f) => thresholds.R[f] ?? null),
      top('L'),
      top('R'),
      OUTPUT_MODE_LABEL[st.outputMode],
      freqs,
      volumeRatio(st.volumeA, st.volumeB),
      st.masterVolume,
      durationTag(st.durationSec),
      s.stimulusLog.length,
      s.stimulusLog.map((r) => r.fileName).join(' / '),
      safeText(s.patient.memo),
      formatDateTime(s.createdAt),
      formatDateTime(s.updatedAt),
    ]
      .map(cell)
      .join(',')
  })

  // BOM: 엑셀에서 한글이 깨지지 않도록
  return new Blob(['﻿' + [header.join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' })
}
