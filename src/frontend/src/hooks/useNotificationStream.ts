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
