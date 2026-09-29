import { useEffect, useRef } from 'react'
import type { EarSelection } from '../types/audiometry'

export interface ShortcutHandlers {
  onPresentStart: () => void
  onPresentEnd: () => void
  onSelectFrequencyIndex: (index: number) => void
  onSelectEar: (ear: EarSelection) => void
  onHeard: () => void
  onNotHeard: () => void
  onLevelStep: (direction: 1 | -1) => void
  onEmergencyStop: () => void
}

function isTextEntry(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  if (el instanceof HTMLInputElement) {
    return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset'].includes(el.type)
  }
  return false
}

const isRange = (el: EventTarget | null) => el instanceof HTMLInputElement && el.type === 'range'

/**
 * 검사용 단축키. 입력칸에 글을 쓰는 중에는 동작하지 않습니다 (Esc 제외).
 * 한글 입력 상태에서도 동작하도록 e.key 대신 물리 키(e.code)를 사용합니다.
 *
 *  Space 검사음 · 1–6 주파수 · L/R/B 귀 · H 들림 · N 안 들림 · ↑/↓ 레벨 · Esc 모든 소리 정지
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers)
  const spaceDown = useRef(false)

  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const h = ref.current
      if (e.code === 'Escape') {
        h.onEmergencyStop()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTextEntry(e.target)) return
      if (document.querySelector('dialog[open]')) return

      if (e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat && !spaceDown.current) {
          spaceDown.current = true
          h.onPresentStart()
        }
        return
      }
      if (e.repeat) return
      const digit = /^Digit([1-9])$/.exec(e.code)
      if (digit) {
        h.onSelectFrequencyIndex(Number(digit[1]) - 1)
        return
      }
      switch (e.code) {
        case 'KeyL':
          h.onSelectEar('L')
          break
        case 'KeyR':
          h.onSelectEar('R')
          break
        case 'KeyB':
          h.onSelectEar('both')
          break
        case 'KeyH':
          h.onHeard()
          break
        case 'KeyN':
          h.onNotHeard()
          break
        case 'ArrowUp':
        case 'ArrowDown':
          if (isRange(e.target)) return // 슬라이더에 포커스가 있으면 기본 동작 사용
          e.preventDefault()
          h.onLevelStep(e.code === 'ArrowUp' ? 1 : -1)
          break
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      if (!isTextEntry(e.target)) e.preventDefault()
      if (spaceDown.current) {
        spaceDown.current = false
        ref.current.onPresentEnd()
      }
    }
    const onBlur = () => {
      if (spaceDown.current) {
        spaceDown.current = false
        ref.current.onPresentEnd()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}
