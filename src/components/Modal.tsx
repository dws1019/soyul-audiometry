import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  size?: 'md' | 'lg' | 'full'
  children: ReactNode
  footer?: ReactNode
}

/** 네이티브 <dialog> 기반 모달 (포커스 가두기·Esc 닫기 기본 제공) */
export function Modal({ open, onClose, title, eyebrow, size = 'md', children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`modal modal--${size}`}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className="modal__inner">
          <header className="modal__head">
            <div>
              {eyebrow && <p className="eyebrow">{eyebrow}</p>}
              <h2 className="modal__title">{title}</h2>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
              <X size={22} aria-hidden="true" />
            </button>
          </header>
          <div className="modal__body">{children}</div>
          {footer && <footer className="modal__foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
