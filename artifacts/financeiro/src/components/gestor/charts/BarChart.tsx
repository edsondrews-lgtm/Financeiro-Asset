import { useId, useState } from 'react'
import { ChartTooltip } from './ChartTooltip'

interface Props {
  labels: string[]
  values: number[]
  height?: number
  color?: string
  highlightIndex?: number
  highlightColor?: string
  labelEvery?: number
  subLabels?: string[]
  valueSuffix?: string
}

const VIEW_W = 600

export function BarChart({
  labels, values, height = 200, color = 'var(--accent)', highlightIndex = -1,
  highlightColor = 'var(--color-danger)', labelEvery = 1, subLabels, valueSuffix = '',
}: Props) {
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
  const gradientId = useId()
  const padL = 30, padR = 8, padT = 18, padB = 26
  const w = VIEW_W - padL - padR
  const h = height - padT - padB
  const maxV = Math.max(...values, 1) * 1.18
  const n = values.length
  const bandW = w / n
  const barW = Math.min(18, bandW * 0.62)
  const ticks = [0, 1, 2, 3].map((i) => (maxV * i) / 3)

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${VIEW_W} ${height}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.72} />
          </linearGradient>
        </defs>
        {ticks.map((v, i) => {
          const y = padT + h - (v / maxV) * h
          return (
            <g key={i}>
              <line x1={padL} x2={VIEW_W - padR} y1={y} y2={y} className="grid-line" />
              <text x={padL - 6} y={y + 3} className="axis-label" textAnchor="end">{Math.round(v)}</text>
            </g>
          )
        })}
        <line x1={padL} x2={VIEW_W - padR} y1={padT + h} y2={padT + h} className="baseline" />

        {values.map((v, i) => {
          const bx = padL + i * bandW + (bandW - barW) / 2
          const bh = (v / maxV) * h
          const by = padT + h - bh
          const isHi = i === highlightIndex
          return (
            <g key={i}>
              <rect
                x={bx} y={by} width={barW} height={Math.max(bh, 1.5)} rx={4} ry={4}
                fill={isHi ? highlightColor : `url(#${gradientId})`}
              />
              {isHi && (
                <text x={bx + barW / 2} y={by - 7} className="value-label" textAnchor="middle" fill={highlightColor}>
                  {v}{valueSuffix}
                </text>
              )}
              <rect
                x={padL + i * bandW} y={padT} width={bandW} height={h} fill="transparent"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
                  setHover({ i, x: e.clientX, y: rect.top })
                }}
                onMouseLeave={() => setHover(null)}
              />
              {i % labelEvery === 0 && (
                <text x={padL + i * bandW + bandW / 2} y={height - 6} className="axis-label" textAnchor="middle">
                  {labels[i]}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <ChartTooltip x={hover?.x ?? 0} y={hover?.y ?? 0} visible={hover !== null}>
        {hover !== null && (
          <>
            <b>{labels[hover.i]}{subLabels ? ` · ${subLabels[hover.i]}` : ''}</b>
            <div className="tt-row"><span>Quantidade</span><b>{values[hover.i]}{valueSuffix}</b></div>
          </>
        )}
      </ChartTooltip>
    </div>
  )
}
