import { useEffect, useState } from "react";
import { initialTheme, persistTheme, type Theme } from "@/lib/theme";

// Whoever renders the toggle owns this hook — the persistTheme call below is
// what actually writes the choice, so it still applies (and survives
// navigating away) even after that component unmounts. See
// applyStoredTheme.ts for the module-load bootstrap that applies the stored
// value before this hook's first render.
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    persistTheme(theme);
  }, [theme]);

  return [theme, setTheme];
}
