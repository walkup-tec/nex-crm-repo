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

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v2.98h3.88c2.27-2.09 3.54-5.17 3.54-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-2.98c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.76-2.11-6.7-4.95H1.29v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.32A7.2 7.2 0 0 1 4.92 12c0-.81.14-1.59.38-2.32V6.59H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.41l4.01-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.59l4.01 3.09C6.24 6.86 8.88 4.75 12 4.75z"
      />
    </svg>
  );
}

const options = [
  { id: "meta", label: "Meta Ads", icon: MetaMark },
  { id: "google", label: "Google Ads", icon: GoogleMark },
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
              <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden="true" />
            ) : null}
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(option.id)}
              className={`flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition sm:w-auto ${selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <Icon className="size-5 shrink-0" />
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
