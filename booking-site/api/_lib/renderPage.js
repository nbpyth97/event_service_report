function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPage({ title, message, details, showButton, buttonLabel, actionUrl, extraButtons }) {
  const detailsHtml = details && details.length
    ? `<dl class="details">${details.map(
        (d) => `<dt>${escapeHtml(d.label)}</dt><dd>${escapeHtml(d.value)}</dd>`,
      ).join('')}</dl>`
    : '';

  const buttonsHtml = extraButtons && extraButtons.length
    ? `<div class="button-row">${extraButtons.map(
        (b) => `<form method="POST" action="${b.actionUrl}"><button type="submit" class="${b.variant || ''}">${escapeHtml(b.label)}</button></form>`,
      ).join('')}</div>`
    : '';

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", sans-serif; background:#F8FAFC; color:#0F172A; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:24px; }
  .card { background:#fff; border:1px solid #E2E8F0; border-radius:14px; padding:32px; max-width:440px; width:100%; text-align:center; box-shadow:0 1px 4px rgba(0,0,0,0.06); }
  h1 { font-size:20px; margin:0 0 12px; }
  p { color:#475569; font-size:15px; line-height:1.5; }
  .details { text-align:left; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:14px 16px; margin:18px 0; }
  .details dt { font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:#94A3B8; font-weight:600; margin-top:10px; }
  .details dt:first-child { margin-top:0; }
  .details dd { margin:2px 0 0; font-size:15px; color:#0F172A; font-weight:600; }
  button { margin-top:8px; background:#2563EB; color:#fff; border:none; border-radius:8px; padding:12px 24px; font-size:15px; font-weight:600; cursor:pointer; width:100%; }
  button:hover { background:#1D4ED8; }
  button.danger { background:#fff; color:#DC2626; border:1px solid #FECACA; }
  button.danger:hover { background:#FEF2F2; }
  .button-row { display:flex; flex-direction:column; gap:10px; margin-top:8px; }
</style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    ${detailsHtml}
    ${showButton ? `<form method="POST" action="${actionUrl}"><button type="submit">${escapeHtml(buttonLabel)}</button></form>` : ''}
    ${buttonsHtml}
  </div>
</body>
</html>`;
}

module.exports = { renderPage };
