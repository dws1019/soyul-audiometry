import { Play, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { TEST_FREQUENCIES } from '../config/constants'
import type { Ear } from '../types/audiometry'
import type { CalibrationProfile } from '../types/calibration'
import type { OutputChannel } from '../utils/audioEngine'
import { EAR_LABEL, formatHz, todayLocalIso } from '../utils/format'
import { createId } from '../utils/id'
import { Modal } from './Modal'

interface Props {
  open: boolean
  profile: CalibrationProfile | null
  onClose: () => void
  onSave: (profile: CalibrationProfile) => void
  onDelete: () => void
  onPlayReference: (frequency: number, dbfs: number, channel: OutputChannel) => void
}

type Draft = Omit<CalibrationProfile, 'referenceDbfs'> & { refs: Record<Ear, Record<number, string>> }

function toDraft(p: CalibrationProfile | null): Draft {
  const refs = (ear: Ear) =>
    Object.fromEntries(TEST_FREQUENCIES.map((f) => [f, p?.referenceDbfs[ear]?.[f]?.toString() ?? '']))
  return {
    id: p?.id ?? createId(),
    name: p?.name ?? '',
    transducer: p?.transducer ?? '',
    measuredAt: p?.measuredAt ?? todayLocalIso(),
    notes: p?.notes ?? '',
    refs: { L: refs('L'), R: refs('R') },
  }
}

/**
 * 장비별 교정표 입력.
 * 각 칸 = 이 장비 조합에서 0 dB HL에 해당하는 디지털 사인파 피크 레벨(dBFS).
 * 측정 없이 추정값을 넣으면 dB HL 표시가 의미를 잃으므로, 교정 장비로 측정한 값만 넣도록 안내합니다.
 */
export function CalibrationDialog({ open, profile, onClose, onSave, onDelete, onPlayReference }: Props) {
  const [d, setD] = useState<Draft>(() => toDraft(profile))
  const [refFreq, setRefFreq] = useState(1000)
  const [refEar, setRefEar] = useState<Ear>('R')
  const [refLevel, setRefLevel] = useState(-30)

  useEffect(() => {
    if (open) setD(toDraft(profile))
  }, [open, profile])

  const invalid = (['L', 'R'] as const).some((ear) =>
    TEST_FREQUENCIES.some((f) => {
      const t = d.refs[ear][f].trim()
      if (t === '') return false
      const n = Number(t)
      return !Number.isFinite(n) || n > 0 || n < -160
    }),
  )
  const filled = (['L', 'R'] as const).reduce(
    (n, ear) => n + TEST_FREQUENCIES.filter((f) => d.refs[ear][f].trim() !== '').length,
    0,
  )

  const save = () => {
    const conv = (ear: Ear) =>
      Object.fromEntries(
        TEST_FREQUENCIES.map((f) => {
          const t = d.refs[ear][f].trim()
          return [f, t === '' ? null : Number(t)]
        }),
      )
    onSave({
      id: d.id,
      name: d.name.trim() || '교정표',
      transducer: d.transducer.trim(),
      measuredAt: d.measuredAt,
      notes: d.notes,
      referenceDbfs: { L: conv('L'), R: conv('R') },
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="장비별 교정표 (Calibration)"
      eyebrow="CALIBRATION"
      size="lg"
      footer={
        <>
          {profile && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                if (window.confirm('교정표를 삭제하고 비교정 모드로 돌아갈까요?')) onDelete()
              }}
            >
              교정표 삭제
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={invalid || filled === 0}>
            저장하고 교정 모드 사용
          </button>
        </>
      }
    >
      <p className="notice notice--attention">
        <TriangleAlert size={18} aria-hidden="true" />
        <span>
          교정표에는 교정된 인공귀(artificial ear/coupler)와 음압계로 측정한 값만 입력하세요. 운영체제 볼륨, 오디오 장치,
          드라이버 설정, 헤드폰이 측정 당시와 달라지면 다시 측정해야 합니다. 임상 청력검사에는 교정된 청력검사기
          사용을 권장합니다.
        </span>
      </p>

      <div className="calib__meta">
        <div className="field">
          <label htmlFor="cal-name">교정표 이름</label>
          <input id="cal-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="예: 검사실 PC + DD45" />
        </div>
        <div className="field">
          <label htmlFor="cal-tr">트랜스듀서(헤드폰)</label>
          <input id="cal-tr" value={d.transducer} onChange={(e) => setD({ ...d, transducer: e.target.value })} placeholder="예: DD45, TDH-39" />
        </div>
        <div className="field">
          <label htmlFor="cal-date">측정 일자</label>
          <input id="cal-date" type="date" value={d.measuredAt} onChange={(e) => setD({ ...d, measuredAt: e.target.value })} />
        </div>
        <div className="field field--wide">
          <label htmlFor="cal-notes">메모 (측정자, 장비 일련번호, OS 볼륨 설정 등)</label>
          <input id="cal-notes" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
        </div>
      </div>

      <h3 className="calib__h">0 dB HL 기준 디지털 레벨 (dBFS, 사인파 피크)</h3>
      <p className="field-help">
        계산: 기준값(dBFS) = 재생한 기준음 레벨(dBFS) − (측정한 dB SPL − 해당 트랜스듀서의 RETSPL). 제시 레벨(dBFS) =
        기준값 + 목표 dB HL.
      </p>
      <table className="calib__table">
        <thead>
          <tr>
            <th scope="col">주파수</th>
            <th scope="col">{EAR_LABEL.L} (L)</th>
            <th scope="col">{EAR_LABEL.R} (R)</th>
          </tr>
        </thead>
        <tbody>
          {TEST_FREQUENCIES.map((f) => (
            <tr key={f}>
              <th scope="row">{formatHz(f)}</th>
              {(['L', 'R'] as const).map((ear) => (
                <td key={ear}>
                  <div className="input-unit input-unit--sm">
                    <input
                      type="number"
                      step={0.1}
                      max={0}
                      min={-160}
                      aria-label={`${EAR_LABEL[ear]} ${formatHz(f)} 기준값 dBFS`}
                      value={d.refs[ear][f]}
                      onChange={(e) => setD({ ...d, refs: { ...d.refs, [ear]: { ...d.refs[ear], [f]: e.target.value } } })}
                    />
                    <span>dBFS</span>
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {invalid && <p className="field-error">기준값은 −160 ~ 0 dBFS 사이의 숫자여야 합니다.</p>}

      <h3 className="calib__h">측정용 기준음</h3>
      <p className="field-help">인공귀에 헤드폰을 올려 측정할 때만 사용하세요. 사람이 착용한 상태에서 재생하지 마세요.</p>
      <div className="calib__ref">
        <select aria-label="기준음 주파수" value={refFreq} onChange={(e) => setRefFreq(Number(e.target.value))}>
          {TEST_FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {formatHz(f)}
            </option>
          ))}
        </select>
        <select aria-label="기준음 귀" value={refEar} onChange={(e) => setRefEar(e.target.value === 'L' ? 'L' : 'R')}>
          <option value="L">왼쪽 (L)</option>
          <option value="R">오른쪽 (R)</option>
        </select>
        <div className="input-unit input-unit--sm">
          <input
            type="number"
            aria-label="기준음 레벨 dBFS"
            min={-80}
            max={-6}
            step={1}
            value={refLevel}
            onChange={(e) => setRefLevel(Math.max(-80, Math.min(-6, Number(e.target.value) || -30)))}
          />
          <span>dBFS</span>
        </div>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => onPlayReference(refFreq, refLevel, refEar === 'L' ? 'left' : 'right')}
        >
          <Play size={16} aria-hidden="true" />
          3초 재생
        </button>
      </div>
    </Modal>
  )
}
