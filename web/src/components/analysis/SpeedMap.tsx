"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { defaultLayout, silkUrl, starters, type Race, type SpeedMapLayout } from "@/lib/analysis";
import { silkDataUrl } from "@/lib/silks";

// Interactive speed map. Starts from the analyst's map (or, without one, the
// field in number order) and lets the reader rearrange it: drag a runner, or
// tap a runner and then a spot; dropping on another runner swaps them; arrow
// keys move a focused runner. The reader's version is kept in this browser.

type Line = "rail" | "outside" | "three";
type Grid = Record<Line, (number | null)[]>;
const LINES: Line[] = ["three", "outside", "rail"]; // drawn top to bottom: the rail is nearest the inside fence

function toGrid(l: SpeedMapLayout, cols: number): Grid {
  const pad = (a: number[] = []) => Array.from({ length: cols }, (_, i) => a[i] ?? null);
  return { rail: pad(l.rail), outside: pad(l.outside), three: pad(l.three) };
}
const fromGrid = (g: Grid): SpeedMapLayout => {
  const trim = (a: (number | null)[]) => {
    const out = [...a];
    while (out.length && out[out.length - 1] == null) out.pop();
    return out as number[];
  };
  return { rail: trim(g.rail), outside: trim(g.outside), three: trim(g.three) };
};

const COL = ["Lead", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
export function positionName(line: Line, col: number) {
  if (line === "rail") return col === 0 ? "Leader" : col === 1 ? "Trail" : `${col} back on the pegs`;
  if (line === "outside") return col === 0 ? "Death seat" : col === 1 ? "One-one" : `One out, ${col} back`;
  return col === 0 ? "Three wide, leading" : `Three wide, ${col} back`;
}

export default function SpeedMap({ race, layout, storageKey, analystMap }: { race: Race; layout?: SpeedMapLayout | null; storageKey: string; analystMap: boolean }) {
  const field = useMemo(() => starters(race), [race]);
  const byNo = useMemo(() => new Map(field.map((e) => [e.no, e])), [field]);
  const base = useMemo(() => layout || defaultLayout(race), [layout, race]);
  const cols = Math.min(9, Math.max(5, Math.ceil(field.length / 2) + 1));

  const [grid, setGrid] = useState<Grid>(() => toGrid(base, cols));
  const [leadLeft, setLeadLeft] = useState(false);
  const [three, setThree] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ no: number; x: number; y: number; dx: number; dy: number } | null>(null);
  const [mine, setMine] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  // The reader's own layout, if they made one (only while the field is the same).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved?.grid) {
        const g = toGrid(saved.grid, cols);
        const nos = [...g.rail, ...g.outside, ...g.three].filter((n): n is number => n != null);
        if (nos.length === field.length && nos.every((n) => byNo.has(n))) {
          setGrid(g);
          setThree(!!saved.three || g.three.some((n) => n != null));
          setMine(true);
        }
      }
      if (localStorage.getItem("hl-speedmap-lead-left") === "1") setLeadLeft(true);
    } catch {}
  }, [storageKey, cols, field.length, byNo]);

  const save = (g: Grid, t = three) => {
    setGrid(g);
    setMine(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ grid: fromGrid(g), three: t }));
    } catch {}
  };

  const where = (no: number): [Line, number] | null => {
    for (const l of LINES) {
      const i = grid[l].indexOf(no);
      if (i >= 0) return [l, i];
    }
    return null;
  };

  const moveTo = (no: number, line: Line, col: number) => {
    const from = where(no);
    if (!from) return;
    const g: Grid = { rail: [...grid.rail], outside: [...grid.outside], three: [...grid.three] };
    const other = g[line][col];
    g[from[0]][from[1]] = other ?? null;
    g[line][col] = no;
    save(g);
  };

  const reset = () => {
    setGrid(toGrid(base, cols));
    setMine(false);
    setPicked(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  };

  const toggleThree = () => {
    const next = !three;
    setThree(next);
    if (!next && grid.three.some((n) => n != null)) {
      // Fold three-wide runners back into the first free spots at the back.
      const g: Grid = { rail: [...grid.rail], outside: [...grid.outside], three: grid.three.map(() => null) };
      for (const no of grid.three.filter((n): n is number => n != null)) {
        const line = (["outside", "rail"] as Line[]).find((l) => g[l].includes(null)) || "outside";
        const i = g[line].lastIndexOf(null);
        if (i >= 0) g[line][i] = no;
      }
      save(g, next);
    } else {
      save(grid, next);
    }
  };

  const toggleLead = () => {
    setLeadLeft((v) => {
      try {
        localStorage.setItem("hl-speedmap-lead-left", v ? "0" : "1");
      } catch {}
      return !v;
    });
  };

  // ---- dragging (mouse, pen and touch) ----
  const onPointerDown = (e: React.PointerEvent, no: number) => {
    if (e.button !== 0) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ no, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag) setDrag({ ...drag, x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: React.PointerEvent, no: number) => {
    if (!drag) return;
    const moved = Math.hypot(e.clientX - (drag.x - 0), e.clientY - drag.y) > 0;
    const startedAt = drag;
    setDrag(null);
    const el = document.elementsFromPoint(e.clientX, e.clientY).find((n) => (n as HTMLElement).dataset?.cell) as HTMLElement | undefined;
    const target = el?.dataset.cell?.split(":");
    const dist = Math.hypot(e.clientX - startedAt.x, e.clientY - startedAt.y);
    if (target && moved && el && !el.contains(e.currentTarget as Node)) {
      moveTo(no, target[0] as Line, Number(target[1]));
      setPicked(null);
    } else if (dist < 6) {
      setPicked((p) => (p === no ? null : no));
    }
  };

  const onCell = (line: Line, col: number) => {
    if (picked == null) return;
    moveTo(picked, line, col);
    setPicked(null);
  };

  const onKey = (e: React.KeyboardEvent, no: number) => {
    const at = where(no);
    if (!at) return;
    const [line, col] = at;
    const lines: Line[] = three ? ["three", "outside", "rail"] : ["outside", "rail"];
    const li = lines.indexOf(line);
    const fwd = leadLeft ? "ArrowLeft" : "ArrowRight";
    const back = leadLeft ? "ArrowRight" : "ArrowLeft";
    let to: [Line, number] | null = null;
    if (e.key === fwd && col > 0) to = [line, col - 1];
    if (e.key === back && col < cols - 1) to = [line, col + 1];
    if (e.key === "ArrowUp" && li > 0) to = [lines[li - 1], col];
    if (e.key === "ArrowDown" && li < lines.length - 1) to = [lines[li + 1], col];
    if (to) {
      e.preventDefault();
      moveTo(no, to[0], to[1]);
      requestAnimationFrame(() => boardRef.current?.querySelector<HTMLElement>(`[data-runner="${no}"]`)?.focus());
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setPicked((p) => (p === no ? null : no));
    }
  };

  const order = useMemo(() => {
    const out: { no: number; pos: string }[] = [];
    for (let c = 0; c < cols; c++)
      for (const l of ["rail", "outside", "three"] as Line[]) {
        const no = grid[l][c];
        if (no != null) out.push({ no, pos: positionName(l, c) });
      }
    return out;
  }, [grid, cols]);

  const colIdx = Array.from({ length: cols }, (_, i) => i);
  const shown = leadLeft ? colIdx : [...colIdx].reverse();
  const lines = three ? LINES : LINES.filter((l) => l !== "three");

  return (
    <div className="speedmap">
      <div className="speedmap-bar">
        <p className="speedmap-help">
          {analystMap ? "Our speed map. " : "Build your own speed map. "}
          Drag a runner, or tap a runner and then a spot. Dropping on another runner swaps them.
          {mine && <strong> Showing your version.</strong>}
        </p>
        <div className="speedmap-actions">
          <button type="button" onClick={toggleThree} aria-pressed={three}>
            {three ? "Hide three-wide line" : "Three-wide line"}
          </button>
          <button type="button" onClick={toggleLead} aria-pressed={leadLeft}>
            {leadLeft ? "Lead on the right" : "Lead on the left"}
          </button>
          <button type="button" onClick={reset} disabled={!mine}>
            {analystMap ? "Back to our map" : "Reset"}
          </button>
        </div>
      </div>

      <div className="speedmap-scroll">
        <div className="speedmap-track" ref={boardRef} style={{ gridTemplateColumns: `76px repeat(${cols}, minmax(112px, 1fr))` }} onPointerMove={onPointerMove}>
          <div />
          {shown.map((c) => (
            <div key={c} className="speedmap-col">
              {COL[c]}
            </div>
          ))}
          {lines.map((l) => (
            <SpeedRow
              key={l}
              line={l}
              cols={shown}
              grid={grid}
              byNo={byNo}
              picked={picked}
              drag={drag}
              onCell={onCell}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onKey={onKey}
            />
          ))}
        </div>
      </div>

      <ol className="speedmap-order">
        {order.map((o, i) => {
          const e = byNo.get(o.no);
          if (!e) return null;
          return (
            <li key={o.no}>
              <span className="speedmap-rank">{i + 1}</span>
              <Silk path={e.silk} colours={e.colours} alt="" size={22} />
              <span>
                <strong>{e.horse}</strong> <span className="speedmap-pos" style={{ display: "inline" }}>({e.no})</span>
                <span className="speedmap-pos">{o.pos}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="speedmap-foot">Your layout is saved in this browser. Arrow keys also move a focused runner.</p>
    </div>
  );
}

function SpeedRow(props: {
  line: Line;
  cols: number[];
  grid: Grid;
  byNo: Map<number, Race["entries"][number]>;
  picked: number | null;
  drag: { no: number; x: number; y: number; dx: number; dy: number } | null;
  onCell: (l: Line, c: number) => void;
  onPointerDown: (e: React.PointerEvent, no: number) => void;
  onPointerUp: (e: React.PointerEvent, no: number) => void;
  onKey: (e: React.KeyboardEvent, no: number) => void;
}) {
  const { line, cols, grid, byNo, picked, drag } = props;
  return (
    <>
      <div className="speedmap-line">{line === "rail" ? "Rail" : line === "outside" ? "Outside" : "Three wide"}</div>
      {cols.map((c) => {
        const no = grid[line][c];
        const e = no != null ? byNo.get(no) : null;
        const dragging = drag && e && drag.no === e.no;
        return (
          <div
            key={c}
            data-cell={`${line}:${c}`}
            className={`speedmap-cell${picked != null && no !== picked ? " is-target" : ""}`}
            onClick={() => (no == null ? props.onCell(line, c) : picked != null && picked !== no ? props.onCell(line, c) : undefined)}
            title={positionName(line, c)}
          >
            {e ? (
              <button
                type="button"
                data-runner={e.no}
                className={`speedmap-runner${picked === e.no ? " is-picked" : ""}${dragging ? " is-dragging" : ""}`}
                style={dragging ? { position: "fixed", left: drag.x - drag.dx, top: drag.y - drag.dy, zIndex: 50, pointerEvents: "none", width: 150 } : undefined}
                onPointerDown={(ev) => props.onPointerDown(ev, e.no)}
                onPointerUp={(ev) => props.onPointerUp(ev, e.no)}
                onKeyDown={(ev) => props.onKey(ev, e.no)}
                aria-label={`${e.no} ${e.horse}, ${positionName(line, c)}. Arrow keys to move.`}
              >
                <Silk path={e.silk} colours={e.colours} alt="" size={30} />
                <span className="speedmap-name">
                  <span>{e.horse}</span>
                  <small>No. {e.no}</small>
                </span>
              </button>
            ) : (
              <span className="speedmap-empty">{picked != null ? "Move here" : ""}</span>
            )}
          </div>
        );
      })}
    </>
  );
}

// True for meetings more than a couple of days old, when TAB no longer has the images.
export const DrawnSilks = createContext(false);

export function Silk({ path, colours, alt, size = 34 }: { path: string | null; colours?: string | null; alt: string; size?: number }) {
  const drawn = useContext(DrawnSilks);
  // TAB's image first; when TAB has none (it drops them a few days after a
  // meeting), a jacket drawn from the written colours (lib/silks.ts).
  const [broken, setBroken] = useState(drawn);
  const tab = silkUrl(path);
  const src = !broken && tab ? tab : silkDataUrl(colours ?? null);
  const h = Math.round(size * 1.19);
  if (!src) return <span className="silk silk-blank" style={{ width: size, height: h }} aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="silk"
      src={src}
      alt={alt}
      title={colours ? colours.toLowerCase() : undefined}
      width={size}
      height={h}
      loading="lazy"
      draggable={false}
      onError={() => setBroken(true)}
    />
  );
}
