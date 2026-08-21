import { initialTheme, persistTheme } from "@/lib/theme";

// Side-effect-only module — no exports, imported by App.tsx purely to run
// this line. Applies the persisted theme to <html> before first paint, no
// matter which route loads first; a useEffect would be too late (flash of
// the wrong theme) and no component is guaranteed to mount before every
// route. The toggle itself lives on CompanySettingsPage — see useTheme.ts.
persistTheme(initialTheme());
