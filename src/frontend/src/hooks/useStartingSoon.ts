import { useEffect, useState } from "react";
import { useAgendamentos } from "@/hooks/queries";
import type { Agendamento } from "@/api/client";

const LEAD_WINDOW_MIN = 30;
const TICK_MS = 60 * 1000;

export function useStartingSoon(): Agendamento[] {
  const { data } = useAgendamentos();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  if (!data) return [];
  const windowMs = LEAD_WINDOW_MIN * 60 * 1000;
  return data
    .filter((a) => a.status === "confirmed")
    .filter((a) => {
      const startMs = new Date(a.start_time).getTime();
      return startMs >= now && startMs - now <= windowMs;
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}
