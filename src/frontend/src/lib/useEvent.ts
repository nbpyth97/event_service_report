import { useCallback, useLayoutEffect, useRef } from "react";

// Returns a stable function that always calls the latest `fn` — for effects
// that need to call a callback prop (Escape-to-close, focus-on-mount)
// without re-running every time the caller passes a new function reference
// for that prop, which happens on every render for an inline arrow function
// prop like `onClose={() => setOpen(false)}`. See NewCustomerModal.tsx,
// CustomerEditModal.tsx, AgendamentoDetailModal.tsx: their mount-time
// useEffect used to depend on `[onClose]` directly, so any unrelated
// re-render of the page while the modal was open (a query refetch, a
// notification-driven cache update, etc.) recreated the inline `onClose`
// prop, re-ran the effect, and stole focus back to the close button —
// interrupting whatever the user was mid-typing in the modal.
export function useEvent<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T;
}
