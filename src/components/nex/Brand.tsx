import logoBranca from "../../../logo/logo_branca.png";
import logoEscura from "../../../logo/logo_escura.png";

export function Brand({ compact = false, onDark = false }: { compact?: boolean; onDark?: boolean }) {
  const size = compact ? "h-9 w-12 object-cover object-left" : "h-12 w-auto max-w-44 object-contain";
  if (onDark) {
    return (
      <div className="flex items-center">
        <img src={logoEscura} alt="NEX Marketing Digital" className={size} />
      </div>
    );
  }
  return (
    <div className="flex items-center">
      <img src={logoBranca} alt="NEX Marketing Digital" className={`${size} dark:hidden`} />
      <img src={logoEscura} alt="" aria-hidden className={`${size} hidden dark:block`} />
    </div>
  );
}
