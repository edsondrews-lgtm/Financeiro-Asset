interface Props {
  labels: string[]
  values: number[]
  colors: string[]
  sub?: string[]
  valueFmt?: (v: number) => string
}

export function HBarList({ labels, values, colors, sub, valueFmt = (v) => String(v) }: Props) {
  const max = Math.max(...values, 1)
  return (
    <div className="hbar-list">
      {labels.map((l, i) => (
        <div className="hbar-row" key={l}>
          <div className="hlabel" title={l}>{l}</div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(values[i] / max) * 100}%`, background: colors[i] }} />
          </div>
          <div className="hbar-val">
            {valueFmt(values[i])}
            {sub && <div className="hbar-sub">{sub[i]}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
