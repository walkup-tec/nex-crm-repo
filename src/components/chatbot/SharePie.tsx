import { useId, useState } from "react";

const shareColors = ["var(--primary)", "var(--info)", "var(--warning)", "oklch(0.72 0.16 330)", "var(--success)", "var(--destructive)", "var(--cyan)"];

const cx = 140;
const cy = 70;
const rx = 104;
const ry = 54;
const depth = 22;
const frontStart = Math.PI;
const frontEnd = Math.PI * 2;

type Slice = { name: string; count: number };

function point(angle: number, yOffset = 0) {
  return {
    x: cx + rx * Math.cos(angle),
    y: cy - ry * Math.sin(angle) + yOffset,
  };
}

function ring(fromAngle: number, toAngle: number, yOffset: number, sweep: 0 | 1) {
  const to = point(toAngle, yOffset);
  const large = Math.abs(toAngle - fromAngle) > Math.PI ? 1 : 0;
  return `A ${rx} ${ry} 0 ${large} ${sweep} ${to.x} ${to.y}`;
}

function topPath(start: number, end: number) {
  if (end - start >= Math.PI * 2 - 0.001) {
    const right = point(0);
    const left = point(Math.PI);
    return `M ${right.x} ${right.y} A ${rx} ${ry} 0 1 0 ${left.x} ${left.y} A ${rx} ${ry} 0 1 0 ${right.x} ${right.y} Z`;
  }
  const from = point(start);
  return `M ${cx} ${cy} L ${from.x} ${from.y} ${ring(start, end, 0, 0)} Z`;
}

function sidePath(start: number, end: number) {
  const from = point(start);
  const to = point(end, depth);
  return `M ${from.x} ${from.y} ${ring(start, end, 0, 0)} L ${to.x} ${to.y} ${ring(end, start, depth, 1)} Z`;
}

function frontWalls(start: number, end: number) {
  const from = Math.max(start, frontStart);
  const to = Math.min(end, frontEnd);
  return to > from + 0.01 ? [{ start: from, end: to }] : [];
}

export function SharePie({ title, slices }: { title: string; slices: Slice[] }) {
  const uid = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((sum, item) => sum + item.count, 0);
  let cursor = 0;
  const wedges = slices.map((slice, index) => {
    const sweep = total ? (slice.count / total) * Math.PI * 2 : 0;
    const start = cursor;
    cursor += sweep;
    return {
      ...slice,
      index,
      start,
      end: cursor,
      color: shareColors[index % shareColors.length],
      percent: total ? Math.round((slice.count / total) * 100) : 0,
    };
  });
  const walls = wedges
    .flatMap((wedge) => frontWalls(wedge.start, wedge.end).map((wall) => ({ ...wall, wedge })))
    .sort((left, right) => point((left.start + left.end) / 2).y - point((right.start + right.end) / 2).y);

  function crust(index: number, lifted: boolean) {
    const wedge = wedges[index];
    const wall = walls.find((item) => item.wedge.index === index);
    const mid = (wedge.start + wedge.end) / 2;
    return (
      <g
        key={index}
        transform={lifted ? `translate(${Math.cos(mid) * 12} ${-Math.sin(mid) * 8 - 1})` : undefined}
        filter={lifted ? `url(#pie-lift-${uid})` : undefined}
        pointerEvents="none"
      >
        {wall ? <path d={sidePath(wall.start, wall.end)} fill={`url(#pie-side-${uid}-${index})`} /> : null}
        <path d={topPath(wedge.start, wedge.end)} fill={`url(#pie-face-${uid}-${index})`} stroke={wedge.end - wedge.start >= Math.PI * 2 - 0.001 ? "none" : "var(--card)"} strokeWidth="1.4" strokeLinejoin="round" />
      </g>
    );
  }

  return (
    <section className="chart-panel" aria-label={title}>
      <h2>{title}</h2>
      <p className="share-note">Participação entre os atendimentos</p>
      {total ? (
        <>
          <svg className="share-pie" viewBox="0 0 280 180" role="img" aria-label={wedges.map((item) => `${item.name} ${item.percent}%`).join(", ")}>
            <ellipse cx={cx} cy={cy + depth + 12} rx={rx * 0.9} ry={15} fill="black" opacity="0.22" />
            <defs>
              <filter id={`pie-lift-${uid}`} x="-20%" y="-20%" width="140%" height="150%">
                <feDropShadow dx="0" dy="5" stdDeviation="2.4" floodColor="black" floodOpacity="0.4" />
              </filter>
              {wedges.map((wedge) => (
                <linearGradient key={`face-${wedge.index}`} id={`pie-face-${uid}-${wedge.index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`color-mix(in oklch, white 34%, ${wedge.color})`} />
                  <stop offset="58%" stopColor={wedge.color} />
                  <stop offset="100%" stopColor={`color-mix(in oklch, black 12%, ${wedge.color})`} />
                </linearGradient>
              ))}
              {wedges.map((wedge) => (
                <linearGradient key={`side-${wedge.index}`} id={`pie-side-${uid}-${wedge.index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`color-mix(in oklch, white 14%, ${wedge.color})`} />
                  <stop offset="42%" stopColor={`color-mix(in oklch, black 26%, ${wedge.color})`} />
                  <stop offset="100%" stopColor={`color-mix(in oklch, black 48%, ${wedge.color})`} />
                </linearGradient>
              ))}
            </defs>
            {walls.filter((wall) => wall.wedge.index !== active).map((wall) => (
              <path key={`wall-${wall.wedge.index}`} d={sidePath(wall.start, wall.end)} fill={`url(#pie-side-${uid}-${wall.wedge.index})`} pointerEvents="none" />
            ))}
            {wedges.filter((wedge) => wedge.index !== active).map((wedge) => (
              <path
                key={`top-${wedge.index}`}
                d={topPath(wedge.start, wedge.end)}
                fill={`url(#pie-face-${uid}-${wedge.index})`}
                stroke={wedge.end - wedge.start >= Math.PI * 2 - 0.001 ? "none" : "var(--card)"}
                strokeWidth="1.4"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            ))}
            {active !== null ? crust(active, true) : null}
            {wedges.map((wedge) => {
              const wall = walls.find((item) => item.wedge.index === wedge.index);
              return (
                <g key={`hit-${wedge.index}`} onMouseEnter={() => setActive(wedge.index)} onMouseLeave={() => setActive(null)}>
                  {wall ? <path d={sidePath(wall.start, wall.end)} fill="transparent" /> : null}
                  <path d={topPath(wedge.start, wedge.end)} fill="transparent" />
                </g>
              );
            })}
          </svg>
          <ul className="share-legend">
            {wedges.map((wedge) => (
              <li key={wedge.index}>
                <button
                  type="button"
                  data-active={active === wedge.index}
                  onMouseEnter={() => setActive(wedge.index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(wedge.index)}
                  onBlur={() => setActive(null)}
                >
                  <i style={{ background: wedge.color }} />
                  <span>{wedge.name}</span>
                  <strong>{wedge.percent}%</strong>
                  <em>{wedge.count}</em>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="chart-empty">Ainda não há dados para este período</div>
      )}
    </section>
  );
}
