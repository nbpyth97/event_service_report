import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken, refreshAccessToken } from "@/auth/auth";
import { queryKeys } from "@/hooks/queries";

// Access tokens default to a 10-minute expiry (backend config.py:
// access_token_expire_minutes). EventSource can't renegotiate auth on native
// reconnect, so this proactively tears down and reopens the connection with
// a freshly-refreshed token well before the old one expires.
const RECONNECT_MS = 5 * 60 * 1000;

export function useNotificationStream(enabled: boolean): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function openStream() {
      const token = getAccessToken();
      if (!token || cancelled) return;

      source = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
      source.addEventListener("notification", () => {
        qc.invalidateQueries({ queryKey: queryKeys.notifications });
        // A notification always corresponds to a booking change (new pending,
        // or a confirmed one cancelled/declined) — without this, the
        // agendamentos list stays stale until its 5-minute refetchInterval,
        // so clicking a fresh notification's deep link can't find the
        // booking to highlight yet.
        qc.invalidateQueries({ queryKey: queryKeys.agendamentos });
        // Those same changes take a slot or give one back, so a colleague's
        // booking would otherwise leave this staff member's open slot picker
        // offering a time that's already gone. Best-effort only: a *declined*
        // booking frees a slot without emitting a notification (update_status
        // resolves the pending one rather than notifying), so this narrows the
        // stale window instead of closing it. The guarantee stays server-side
        // — is_slot_bookable plus ex_agendamentos_no_overlap 409 on a slot
        // that was taken in the meantime.
        qc.invalidateQueries({ queryKey: ["availability"] });
      });

      reconnectTimer = setTimeout(async () => {
        source?.close();
        await refreshAccessToken();
        if (!cancelled) openStream();
      }, RECONNECT_MS);
    }

    openStream();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
    };
  }, [enabled, qc]);
}
