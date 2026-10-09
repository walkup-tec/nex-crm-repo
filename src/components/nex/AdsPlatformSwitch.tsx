export type AdsPlatform = "meta" | "google";

function MetaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#0082FB"
        d="M7.05 8.05c1.28 0 2.38.72 3.48 2.12.62.8 1.08 1.78 1.47 2.38.39-.6.85-1.58 1.47-2.38 1.1-1.4 2.2-2.12 3.48-2.12 2.16 0 3.7 1.72 3.7 4.45 0 2.68-1.62 5.05-3.82 5.05-1.28 0-2.34-.82-3.52-2.36L12 13.55l-1.31 1.64c-1.18 1.54-2.24 2.36-3.52 2.36-2.2 0-3.82-2.37-3.82-5.05 0-2.73 1.54-4.45 3.7-4.45Zm.05 1.62c-1.08 0-2.02.92-2.02 2.83 0 1.74.84 3.43 2.18 3.43.68 0 1.4-.58 2.36-1.86l.86-1.22-1.02-1.42c-.78-1.02-1.52-1.76-2.36-1.76Zm9.8 0c-.84 0-1.58.74-2.36 1.76l-1.02 1.42.86 1.22c.96 1.28 1.68 1.86 2.36 1.86 1.34 0 2.18-1.69 2.18-3.43 0-1.91-.94-2.83-2.02-2.83Z"
      />
    </svg>
  );
}

function GoogleAdsMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <line
        x1="16"
        y1="46"
        x2="31"
        y2="16"
        stroke="#FBBC04"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <line
        x1="47"
        y1="50"
        x2="35"
        y2="8"
        stroke="#4285F4"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <circle cx="16" cy="48" r="11" fill="#34A853" />
    </svg>
  );
}

const options = [
  { id: "meta", label: "Meta Ads", icon: MetaMark, iconClass: "size-10" },
  { id: "google", label: "Google Ads", icon: GoogleAdsMark, iconClass: "size-8" },
] as const;

export function AdsPlatformSwitch({
  value,
  onChange,
}: {
  value: AdsPlatform;
  onChange: (value: AdsPlatform) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Rede de anúncios"
      className="flex w-full items-center rounded-lg border bg-card p-1 sm:w-fit"
    >
      {options.map((option, index) => {
        const Icon = option.icon;
        const selected = value === option.id;
        return (
          <div key={option.id} className="flex min-w-0 flex-1 items-center sm:flex-none">
            {index > 0 ? (
              <span className="mx-1 h-8 w-px shrink-0 bg-border" aria-hidden="true" />
            ) : null}
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(option.id)}
              className={`flex h-14 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition sm:w-auto ${selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <Icon className={`${option.iconClass} shrink-0`} />
              {option.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function GoogleAdsOverview() {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground">Conta de anúncios</p>
      <p className="mt-1 font-semibold">Conta Google Ads não vinculada</p>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Os indicadores do Google Ads entram nesta visão quando a conta estiver vinculada. A Meta
        continua na outra opção.
      </p>
    </div>
  );
}
