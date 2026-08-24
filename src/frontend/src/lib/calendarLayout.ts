import type { Agendamento } from "@/api/client";
import { zonedMinutesOfDay } from "@/lib/tz";

export interface PositionedEvent {
  agendamento: Agendamento;
  top: number;
  height: number;
  col: number;
  colCount: number;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Classic sweep-line calendar layout: walk events in start order, packing
// each into the first column whose previous occupant has already ended.
// Events are grouped into clusters of mutual overlap as we go, and only
// share a column count within their own cluster — so a lone event later in
// the day still gets the full column width instead of inheriting an earlier
// cluster's split. Shared by the day and week grid views.
export function layoutDayEvents(
  items: Agendamento[],
  gridStartMin: number,
  dayOpenMin: number,
  dayCloseMin: number,
  pxPerMin: number,
  minBlockPx: number
): PositionedEvent[] {
  const sorted = [...items].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const spans = sorted.map((a) => {
    // Minutes-of-day in the company's zone, not the viewer's — the grid rows
    // these are positioned against are the company's business hours.
    const startMin = Math.max(dayOpenMin, zonedMinutesOfDay(a.start_time));
    const endMin = Math.max(startMin + 1, Math.min(dayCloseMin, zonedMinutesOfDay(a.end_time)));
    return { agendamento: a, startMin, endMin };
  });

  const result: PositionedEvent[] = [];
  let cluster: { agendamento: Agendamento; startMin: number; endMin: number; col: number }[] = [];
  let clusterEnd = -Infinity;
  const columnEnds: number[] = [];

  const flush = () => {
    if (cluster.length === 0) return;
    const colCount = Math.max(...cluster.map((c) => c.col)) + 1;
    for (const c of cluster) {
      result.push({
        agendamento: c.agendamento,
        top: (c.startMin - gridStartMin) * pxPerMin,
        height: Math.max((c.endMin - c.startMin) * pxPerMin, minBlockPx),
        col: c.col,
        colCount,
      });
    }
    cluster = [];
    columnEnds.length = 0;
    clusterEnd = -Infinity;
  };

  for (const span of spans) {
    if (cluster.length > 0 && span.startMin >= clusterEnd) flush();
    let colIdx = columnEnds.findIndex((end) => end <= span.startMin);
    if (colIdx === -1) {
      colIdx = columnEnds.length;
      columnEnds.push(span.endMin);
    } else {
      columnEnds[colIdx] = span.endMin;
    }
    cluster.push({ ...span, col: colIdx });
    clusterEnd = Math.max(clusterEnd, span.endMin);
  }
  flush();

  return result;
}
