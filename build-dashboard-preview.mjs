import fs from "node:fs";

const kpi = fs.readFileSync("kpi-cards-preview.html", "utf8");
const charts = fs.readFileSync("dashboard-charts-preview.html", "utf8");
const geo = fs.readFileSync("dashboard-geo-preview.html", "utf8");
const bottom = fs.readFileSync("dashboard-bottom-preview.html", "utf8");

function extract(html) {
  const style = (html.match(/<style>([\s\S]*?)<\/style>/i) || [])[1] || "";
  const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [])[1] || "";
  return { style, body };
}

function renameClass(css, html, from, to) {
  const classRe = new RegExp(`class="${from}"`, "g");
  const cssRe = new RegExp(`\\.${from}(?=[\\s{.:#[,>+~]|$)`, "g");
  return {
    css: css.replace(cssRe, `.${to}`),
    body: html.replace(classRe, `class="${to}"`),
  };
}

/** Remove only the HTML body element rule, never ".kpi-body{...}" etc. */
function stripElementBodyRule(css) {
  return css.replace(/(^|})\s*body\s*\{[^}]*\}/g, "$1");
}

/** Charts reset *{padding:0} destroys KPI padding — keep box-sizing only. */
function sanitizeUniversalReset(css) {
  return css.replace(/\*\s*\{[^}]*\}/g, "*{box-sizing:border-box}");
}

function scopeCharts(style, body) {
  let css = sanitizeUniversalReset(stripElementBodyRule(style));
  let html = body;
  ({ css, body: html } = renameClass(css, html, "grid", "charts-grid"));
  ({ css, body: html } = renameClass(css, html, "charts-grid", "charts-grid"));
  for (const [from, to] of [
    ["card", "ch-card"],
    ["head", "ch-head"],
    ["sub", "ch-sub"],
    ["select", "ch-select"],
    ["legend", "ch-legend"],
    ["dot", "ch-dot"],
  ]) {
    ({ css, body: html } = renameClass(css, html, from, to));
  }
  return { css, body: html };
}

function scopeGeo(style, body) {
  let css = sanitizeUniversalReset(stripElementBodyRule(style)).replace(/:root\{[^}]*\}/g, "");
  let html = body;
  for (const [from, to] of [
    ["card", "geo-card"],
    ["card-head", "geo-card-head"],
    ["sub", "geo-sub"],
    ["select", "geo-select"],
    ["dot", "geo-dot"],
    ["bar", "geo-bar"],
  ]) {
    ({ css, body: html } = renameClass(css, html, from, to));
  }
  return { css, body: html };
}

const a = extract(kpi);
const bRaw = extract(charts);
const cRaw = extract(geo);
const dRaw = extract(bottom);
const b = scopeCharts(bRaw.style, bRaw.body);
const c = scopeGeo(cRaw.style, cRaw.body);
const d = {
  css: sanitizeUniversalReset(stripElementBodyRule(dRaw.style)),
  body: dRaw.body,
};

const out = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Dashboard Master – Preview acumulado</title>
<style>
  html,body{margin:0;background:#0b1220;color:#fff;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  .stack{max-width:1480px;margin:0 auto;padding:28px 20px 48px;display:flex;flex-direction:column;gap:28px}
  .stack > .kpi-page, .stack > .charts-grid, .stack > .geo-grid, .stack > .bottom-grid{max-width:none;margin:0;padding:0;width:100%}
  /* KPI last among shared resets so padding wins */
  ${b.css}
  ${c.css}
  ${d.css}
  ${a.style}
</style>
</head>
<body>
<div class="stack">
${a.body}
${b.body}
${c.body}
${d.body}
</div>
</body>
</html>`;

fs.writeFileSync("dashboard-preview.html", out);
console.log("wrote dashboard-preview.html", out.length);
const hasBody = out.includes(".kpi-body{");
const hasStarPad = /\*\{[^}]*padding:\s*0/.test(out);
console.log({ hasBody, hasStarPad });
