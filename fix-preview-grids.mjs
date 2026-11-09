import fs from "node:fs";

function scope(file, fromClass, toClass) {
  let html = fs.readFileSync(file, "utf8");
  html = html.replaceAll(`class="${fromClass}"`, `class="${toClass}"`);
  html = html.replaceAll(`.${fromClass}{`, `.${toClass}{`);
  html = html.replaceAll(`.${fromClass} `, `.${toClass} `);
  html = html.replaceAll(`{.${fromClass}{`, `{.${toClass}{`);
  fs.writeFileSync(file, html);
}

scope("kpi-cards-preview.html", "grid", "kpi-grid");
scope("dashboard-charts-preview.html", "grid", "charts-grid");
console.log("scoped grids");
