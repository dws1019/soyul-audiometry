import { Image as ImageIcon } from 'lucide-react'
import { useId, useRef, useState, type Ref } from 'react'
import type { Ear, EarThresholds, ThresholdUnit } from '../types/audiometry'
import { svgToPngBlob } from '../utils/audiogramImage'
import { downloadBlob } from '../utils/exporters'
import { compactDate, EAR_LABEL, EAR_SYMBOL, formatHz, formatLevel, unitLongLabel } from '../utils/format'
import { emphasisKey } from '../utils/hearingAnalysis'

/*
 * SVG는 PNG로 저장할 때 CSS 변수를 읽을 수 없으므로 색을 직접 적습니다 (tokens.css와 같은 값).
 */
const C = {
  ink: '#262d28',
  muted: '#555e57',
  grid: '#e4e0d6',
  gridStrong: '#b9c4ad',
  band: '#eef2e9',
  white: '#ffffff',
  R: '#b3342a',
  L: '#2c5d9e',
  Rsoft: '#b3342a1f',
  Lsoft: '#2c5d9e1f',
}
const FONT = "Pretendard, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"

const W = 640
const H = 450
const M = { left: 66, right: 26, top: 70, bottom: 58 }
const PW = W - M.left - M.right
const PH = H - M.top - M.bottom

interface Props {
  thresholds: EarThresholds
  unit: ThresholdUnit
  frequencies: readonly number[]
  /** emphasisKey(ear, f) → 순위 */
  emphasis: Map<string, number>
  selectedFrequency?: number | null
  caption?: string
  svgRef?: Ref<SVGSVGElement>
  interactive?: boolean
}

interface Tip {
  ear: Ear
  frequency: number
  value: number
  x: number
  y: number
  rank: number | undefined
}

function yDomain(unit: ThresholdUnit): [number, number] {
  return unit === 'dBHL' ? [-10, 120] : [0, 100]
}

/**
 * 전통적인 Audiogram: 좋은 청력(낮은 역치)이 위, 높은 역치가 아래.
 * 오른쪽 귀 = O(빨강, 실선), 왼쪽 귀 = X(파랑, 점선) — 색 외에 기호·선 모양·라벨로도 구분.
 */
export function Audiogram({
  thresholds,
  unit,
  frequencies,
  emphasis,
  selectedFrequency,
  caption,
  svgRef,
  interactive = true,
}: Props) {
  const uid = useId()
  const [tip, setTip] = useState<Tip | null>(null)
  const [yMin, yMax] = yDomain(unit)
  const lo = Math.log2(Math.min(...frequencies)) - 0.5
  const hi = Math.log2(Math.max(...frequencies)) + 0.5
  const x = (f: number) => M.left + ((Math.log2(f) - lo) / (hi - lo)) * PW
  const y = (v: number) => M.top + ((Math.min(yMax, Math.max(yMin, v)) - yMin) / (yMax - yMin)) * PH
  const yTicks: number[] = []
  for (let v = yMin; v <= yMax; v += 10) yTicks.push(v)

  const points = (ear: Ear) =>
    frequencies
      .map((f) => ({ f, v: thresholds[ear][f] }))
      .filter((p): p is { f: number; v: number } => typeof p.v === 'number')
      .map((p) => ({ ...p, x: x(p.f), y: y(p.v), rank: emphasis.get(emphasisKey(ear, p.f)) }))

  const series = { R: points('R'), L: points('L') }
  const empty = series.R.length === 0 && series.L.length === 0
  const path = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const summary = (['R', 'L'] as const)
    .map((ear) => `${EAR_LABEL[ear]}: ${series[ear].map((p) => `${p.f}Hz ${p.v}`).join(', ') || '입력 없음'}`)
    .join(' / ')

  return (
    <div className="audiogram">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${uid}-t ${uid}-d`}
        fontFamily={FONT}
        className="audiogram__svg"
      >
        <title id={`${uid}-t`}>{`Audiogram · ${unitLongLabel(unit)}`}</title>
        <desc id={`${uid}-d`}>{summary}</desc>
        <rect x={0} y={0} width={W} height={H} fill={C.white} />

        {/* 범례 */}
        <g transform="translate(66 28)" fontSize={13} fill={C.ink}>
          <circle cx={7} cy={0} r={6} fill={C.white} stroke={C.R} strokeWidth={2.2} />
          <line x1={20} y1={0} x2={40} y2={0} stroke={C.R} strokeWidth={2} />
          <text x={48} y={4.5}>오른쪽 귀 (R, O)</text>
          <g transform="translate(176 0)">
            <path d="M1,-6 L13,6 M13,-6 L1,6" stroke={C.L} strokeWidth={2.4} strokeLinecap="round" />
            <line x1={20} y1={0} x2={40} y2={0} stroke={C.L} strokeWidth={2} strokeDasharray="6 4" />
            <text x={48} y={4.5}>왼쪽 귀 (L, X)</text>
          </g>
          <g transform="translate(340 0)">
            <circle cx={7} cy={0} r={9} fill={C.band} stroke={C.muted} strokeWidth={1.2} strokeDasharray="3 2.5" />
            <text x={22} y={4.5}>상대적 역치 상위 1–2위</text>
          </g>
        </g>

        {/* 선택된 주파수 */}
        {selectedFrequency != null && frequencies.includes(selectedFrequency) && (
          <rect
            data-export="exclude"
            x={x(selectedFrequency) - 22}
            y={M.top}
            width={44}
            height={PH}
            rx={6}
            fill={C.band}
          />
        )}

        {/* 격자 */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(v)}
              y2={y(v)}
              stroke={v === 0 && unit === 'dBHL' ? C.gridStrong : C.grid}
              strokeWidth={1}
            />
            <text x={M.left - 10} y={y(v) + 4} textAnchor="end" fontSize={12} fill={C.muted}>
              {v}
            </text>
          </g>
        ))}
        {frequencies.map((f) => (
          <g key={f}>
            <line x1={x(f)} x2={x(f)} y1={M.top} y2={M.top + PH} stroke={C.grid} strokeWidth={1} />
            <text x={x(f)} y={M.top + PH + 20} textAnchor="middle" fontSize={12.5} fill={C.muted}>
              {f}
            </text>
          </g>
        ))}
        <rect x={M.left} y={M.top} width={PW} height={PH} fill="none" stroke={C.gridStrong} strokeWidth={1} />

        {/* 축 제목 */}
        <text x={M.left + PW / 2} y={H - 12} textAnchor="middle" fontSize={13} fill={C.ink}>
          주파수 (Hz)
        </text>
        <text
          transform={`translate(18 ${M.top + PH / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={13}
          fill={C.ink}
        >
          {unitLongLabel(unit)} — 아래로 갈수록 높음
        </text>

        {/* 강조(취약 주파수 1–2위) */}
        {(['R', 'L'] as const).map((ear) =>
          series[ear]
            .filter((p) => p.rank !== undefined)
            .map((p) => (
              <circle
                key={`halo-${ear}-${p.f}`}
                cx={p.x}
                cy={p.y}
                r={15}
                fill={ear === 'R' ? C.Rsoft : C.Lsoft}
                stroke={C[ear]}
                strokeWidth={1.25}
                strokeDasharray="3 2.5"
              />
            )),
        )}

        {/* 선 */}
        {series.R.length > 1 && <path d={path(series.R)} fill="none" stroke={C.R} strokeWidth={2} strokeLinejoin="round" />}
        {series.L.length > 1 && (
          <path d={path(series.L)} fill="none" stroke={C.L} strokeWidth={2} strokeDasharray="6 4" strokeLinejoin="round" />
        )}

        {/* 기호 */}
        {series.R.map((p) => (
          <circle key={`R-${p.f}`} cx={p.x} cy={p.y} r={7} fill={C.white} stroke={C.R} strokeWidth={2.4} />
        ))}
        {series.L.map((p) => (
          <g key={`L-${p.f}`} strokeLinecap="round">
            <path
              d={`M${p.x - 6},${p.y - 6} L${p.x + 6},${p.y + 6} M${p.x + 6},${p.y - 6} L${p.x - 6},${p.y + 6}`}
              stroke={C.white}
              strokeWidth={5}
            />
            <path
              d={`M${p.x - 6},${p.y - 6} L${p.x + 6},${p.y + 6} M${p.x + 6},${p.y - 6} L${p.x - 6},${p.y + 6}`}
              stroke={C.L}
              strokeWidth={2.6}
            />
          </g>
        ))}

        {/* 순위 라벨 */}
        {(['R', 'L'] as const).map((ear) =>
          series[ear]
            .filter((p) => p.rank !== undefined)
            .map((p) => (
              <text
                key={`rank-${ear}-${p.f}`}
                x={ear === 'R' ? p.x - 17 : p.x + 17}
                y={p.y - 13}
                textAnchor={ear === 'R' ? 'end' : 'start'}
                fontSize={12}
                fontWeight={700}
                fill={C.ink}
                stroke={C.white}
                strokeWidth={3}
                paintOrder="stroke"
              >
                {EAR_SYMBOL[ear]} {p.rank}위
              </text>
            )),
        )}

        {empty && (
          <text x={M.left + PW / 2} y={M.top + PH / 2} textAnchor="middle" fontSize={15} fill={C.muted}>
            검사 결과를 입력하면 여기에 그려집니다
          </text>
        )}

        {caption && (
          <text x={W - M.right} y={H - 12} textAnchor="end" fontSize={11.5} fill={C.muted}>
            {caption}
          </text>
        )}

        {/* 마우스·키보드 hover 영역 */}
        {interactive &&
          (['R', 'L'] as const).map((ear) =>
            series[ear].map((p) => (
              <circle
                key={`hit-${ear}-${p.f}`}
                data-export="exclude"
                className="audiogram__hit"
                cx={p.x}
                cy={p.y}
                r={14}
                fill="transparent"
                tabIndex={0}
                aria-label={`${EAR_LABEL[ear]} ${formatHz(p.f)} ${formatLevel(p.v, unit)}`}
                onMouseEnter={() => setTip({ ear, frequency: p.f, value: p.v, x: p.x, y: p.y, rank: p.rank })}
                onMouseLeave={() => setTip(null)}
                onFocus={() => setTip({ ear, frequency: p.f, value: p.v, x: p.x, y: p.y, rank: p.rank })}
                onBlur={() => setTip(null)}
              />
            )),
          )}
      </svg>

      {tip && (
        <div
          className="audiogram__tip"
          style={{ left: `${(tip.x / W) * 100}%`, top: `${(tip.y / H) * 100}%` }}
          role="tooltip"
        >
          <div className={`audiogram__tip-ear audiogram__tip-ear--${tip.ear}`}>
            {EAR_SYMBOL[tip.ear]} {EAR_LABEL[tip.ear]}
          </div>
          <div className="audiogram__tip-row">
            <span>주파수</span>
            <strong>{formatHz(tip.frequency)}</strong>
          </div>
          <div className="audiogram__tip-row">
            <span>입력된 역치</span>
            <strong>{formatLevel(tip.value, unit)}</strong>
          </div>
          {tip.rank !== undefined && <div className="audiogram__tip-note">상대적으로 역치가 높은 주파수 {tip.rank}위</div>}
        </div>
      )}
    </div>
  )
}

interface CardProps extends Omit<Props, 'svgRef'> {
  testDate: string
}

/** Audiogram 카드 (이미지 저장 포함) */
export function AudiogramCard(props: CardProps) {
  const ref = useRef<SVGSVGElement>(null)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!ref.current) return
    setBusy(true)
    try {
      const blob = await svgToPngBlob(ref.current)
      downloadBlob(blob, `audiogram_${props.testDate.replace(/-/g, '') || compactDate()}.png`)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card audiogram-card" aria-labelledby="audiogram-title">
      <div className="card__head card__head--tight">
        <div>
          <h2 id="audiogram-title" className="card__title">
            Audiogram
          </h2>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={save} disabled={busy}>
          <ImageIcon size={16} aria-hidden="true" />
          이미지 저장
        </button>
      </div>
      <Audiogram {...props} svgRef={ref} caption={`검사일 ${props.testDate} · 소율한의원`} />
    </section>
  )
}
