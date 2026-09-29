import { CircleCheck, Info, TriangleAlert } from 'lucide-react'

export type ToastTone = 'info' | 'success' | 'warn'
export interface ToastMessage {
  id: number
  text: string
  tone: ToastTone
}

const ICON = { info: Info, success: CircleCheck, warn: TriangleAlert }

export function ToastStack({ toasts }: { toasts: ToastMessage[] }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICON[t.tone]
        return (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <Icon size={18} aria-hidden="true" />
            <span>{t.text}</span>
          </div>
        )
      })}
    </div>
  )
}
