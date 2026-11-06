/** Escopo visual do NEX Intelligence (mockups navy/ciano). */
export const ni = {
  root: "ni-root rounded-2xl border border-[#1e3a5f]/60 bg-[#050c1a] text-[#f4f7fb] shadow-[0_20px_60px_rgba(0,0,0,0.35)]",
  card: "rounded-xl border border-[#1e3a5f]/70 bg-[#0b1729] text-[#f4f7fb]",
  cardMuted: "rounded-xl border border-[#1e3a5f]/50 bg-[#0a1424]",
  label: "text-xs font-medium uppercase tracking-wide text-[#8fa3bf]",
  muted: "text-sm text-[#8fa3bf]",
  title: "text-base font-semibold text-white",
  value: "text-2xl font-semibold tracking-tight text-white",
  input:
    "h-10 w-full min-w-0 rounded-lg border border-[#1e3a5f] bg-[#07111f] text-sm text-white placeholder:text-[#6b7f9a] focus-visible:ring-[#2f7cf6]",
  field: "grid min-w-0 gap-1.5 text-sm",
  tabActive: "bg-[#1d6feb] text-white shadow-sm",
  tabIdle: "bg-transparent text-[#9db0c9] hover:bg-[#122038] hover:text-white",
  btnPrimary:
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1d6feb] px-4 text-sm font-medium text-white hover:bg-[#2a7bf5] disabled:opacity-50",
  btnGhost:
    "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#2a4060] bg-transparent px-3 text-sm text-[#d5e0ef] hover:bg-[#122038] disabled:opacity-50",
  badgePos: "rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400",
  badgeNeg: "rounded-md bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-400",
  badgeNeu: "rounded-md bg-slate-500/20 px-2 py-0.5 text-xs font-medium text-slate-300",
  badgePriHigh: "rounded-md bg-[#1d6feb]/20 px-2 py-0.5 text-xs font-medium text-[#7eb6ff]",
  badgePriMed: "rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300",
  badgePriLow: "rounded-md bg-slate-500/20 px-2 py-0.5 text-xs font-medium text-slate-300",
} as const;
