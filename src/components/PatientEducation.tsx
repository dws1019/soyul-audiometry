import { ChevronDown, ChevronUp, Ear, Hand, Headphones, Maximize2, Target } from 'lucide-react'
import { useState } from 'react'
import { TONE_GENERATOR_DISCLAIMER } from '../config/constants'
import { Modal } from './Modal'

const BLOCKS = [
  {
    icon: Ear,
    title: '난청이란?',
    body: '난청은 외부의 소리를 듣는 능력이 감소한 상태를 의미합니다. 난청의 정도와 형태는 사람마다 다르며 특정 주파수 영역에서만 청력이 저하될 수도 있습니다.',
  },
  {
    icon: Headphones,
    title: '순음청력검사란?',
    body: '순음청력검사(Pure Tone Audiometry)는 여러 높낮이의 순음을 들려주고, 각 주파수에서 환자가 들을 수 있는 가장 작은 소리의 크기를 확인하여 청력 상태를 평가하는 검사입니다.',
  },
  {
    icon: Target,
    title: '검사 목적',
    body: '주파수별 청력 상태를 확인하여 어느 음역대에서 청력이 저하되어 있는지 파악하고, 청력 변화 및 치료 경과를 확인하는 데 활용합니다.',
  },
  {
    icon: Hand,
    title: '검사하는 동안',
    body: '헤드폰에서 "삐-" 소리가 들립니다. 아주 작은 소리라도 들리면 바로 손을 들거나 "네"라고 알려 주세요. 소리가 멈추면 손을 내려 주세요.',
  },
]

interface Props {
  open: boolean
  onToggle: () => void
}

/** 첫 화면 — 환자에게 보여 주는 난청·순음청력검사 안내 */
export function PatientEducation({ open, onToggle }: Props) {
  const [large, setLarge] = useState(false)

  return (
    <section className="card education" aria-labelledby="edu-title">
      <div className="card__head">
        <div>
          <p className="eyebrow">ABOUT THE TEST</p>
          <h2 id="edu-title" className="card__title">
            환자 안내 · 난청과 순음청력검사
          </h2>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLarge(true)}>
            <Maximize2 size={16} aria-hidden="true" />
            환자에게 크게 보여 주기
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onToggle} aria-expanded={open}>
            {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
            {open ? '접기' : '펼치기'}
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="education__grid">
            {BLOCKS.map(({ icon: Icon, title, body }) => (
              <article key={title} className="education__item">
                <span className="education__icon" aria-hidden="true">
                  <Icon size={24} strokeWidth={1.75} />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <p className="disclaimer">{TONE_GENERATOR_DISCLAIMER}</p>
        </>
      )}

      <Modal open={large} onClose={() => setLarge(false)} title="난청과 순음청력검사" eyebrow="소율한의원" size="full">
        <div className="education-large">
          {BLOCKS.map(({ icon: Icon, title, body }) => (
            <article key={title}>
              <h3>
                <Icon size={32} strokeWidth={1.75} aria-hidden="true" />
                {title}
              </h3>
              <p>{body}</p>
            </article>
          ))}
          <p className="disclaimer">{TONE_GENERATOR_DISCLAIMER}</p>
        </div>
      </Modal>
    </section>
  )
}
