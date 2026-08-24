/// <reference types="vite/client" />

// Intl.supportedValuesOf is ES2022 and tsconfig targets ES2020, so TS does not
// ship its type. Declared narrowly here (only the "timeZone" key is used, by
// pages/CompanySettingsPage.tsx) rather than raising the project-wide `lib`,
// which would also start typing runtime APIs the browser baseline may lack.
// The call site still feature-detects before calling it.
declare namespace Intl {
  function supportedValuesOf(key: "timeZone"): string[];
}
