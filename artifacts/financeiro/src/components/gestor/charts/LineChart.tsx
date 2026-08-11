import { useId, useState } from 'react'
import { ChartTooltip } from './ChartTooltip'

interface Serie {
  name: string
  color: string
  values: number[]
}

interface Props {
  labels: string[]
  series: Serie[]
  height?: number
  valueFmt?: (v: number) => string
  labelEvery?: number
}

const VIEW_W = 600

export function LineChart({ labels, series, height = 220, valueFmt = (v) => String(Math.round(v)), labelEvery = 2 }: Props) {
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
  const gradientId = useId()

  if (series.length === 0 || labels.length === 0) {
    return <p className="msg-vazio">Sem dados suficientes pra este gráfico ainda.</p>
  }

  const padL = 44, padR = 10, padT = 14, padB = 24
  const w = VIEW_W - padL - padR
  const h = height - padT - padB
  const allVals = series.flatMap((s) => s.values)
  const maxV = Math.max(...allVals, 1) * 1.12
  const n = labels.length
  const x = (i: number) => padL + (n > 1 ? (i / (n - 1)) * w : w / 2)
  const y = (v: number) => padT + h - (v / maxV) * h
  const ticks = [0, 1, 2, 3, 4].map((i) => (maxV * i) / 4)

  const s0 = series[0]
  const areaPts = labels.map((_, i) => `${x(i)},${y(s0.values[i])}`).join(' L')
  const areaPath = `M${x(0)},${padT + h} L${areaPts} L${x(n - 1)},${padT + h} Z`

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${VIEW_W} ${height}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s0.color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={s0.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {ticks.map((v, i) => {
          const yy = y(v)
          return (
            <g key={i}>
              <line x1={padL} x2={VIEW_W - padR} y1={yy} y2={yy} className="grid-line" />
              <text x={padL - 8} y={yy + 3} className="axis-label" textAnchor="end">{valueFmt(v)}</text>
            </g>
          )
        })}
        <line x1={padL} x2={VIEW_W - padR} y1={padT + h} y2={padT + h} className="baseline" />

        <path d={areaPath} fill={`url(#${gradientId})`} />

        {series.map((s) => (
          <path
            key={s.name}
            d={labels.map((_, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(s.values[i])}`).join(' ')}
            fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
          />
        ))}
        {series.map((s) => (
          <circle key={s.name} cx={x(n - 1)} cy={y(s.values[n - 1])} r={5} fill={s.color} stroke="var(--bg-secondary)" strokeWidth={2.5} />
        ))}

        {labels.map((l, i) => {
          if (i % labelEvery !== 0 && i !== n - 1) return null
          return <text key={i} x={x(i)} y={height - 6} className="axis-label" textAnchor="middle">{l}</text>
        })}

        {hover !== null && <line x1={x(hover.i)} x2={x(hover.i)} y1={padT} y2={padT + h} className="hover-line" />}
        <rect
          x={padL} y={padT} width={w} height={h} fill="transparent"
          onMouseMove={(e) => {
            const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
            const mx = e.clientX - rect.left
            const ratio = (mx - (padL / VIEW_W) * rect.width) / ((w / VIEW_W) * rect.width)
            let i = Math.round(ratio * (n - 1))
            i = Math.max(0, Math.min(n - 1, i))
            setHover({ i, x: e.clientX, y: rect.top })
          }}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      <ChartTooltip x={hover?.x ?? 0} y={hover?.y ?? 0} visible={hover !== null}>
        {hover !== null && (
          <>
            <b>{labels[hover.i]}</b>
            {series.map((s) => (
              <div className="tt-row" key={s.name}>
                <span><span className="tt-sw" style={{ background: s.color }} />{s.name}</span>
                <b>{valueFmt(s.values[hover.i])}</b>
              </div>
            ))}
          </>
        )}
      </ChartTooltip>
    </div>
  )
}
