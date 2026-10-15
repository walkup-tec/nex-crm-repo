import logoBranca from "../../../logo/logo_branca.png";
import logoEscura from "../../../logo/logo_escura.png";

export function Brand({ compact = false, onDark = false }: { compact?: boolean; onDark?: boolean }) {
  const size = compact ? "h-[32.4px] w-[43.2px] object-cover object-left" : "h-[43.2px] w-auto max-w-[158.4px] object-contain";
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
