import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { const value = localStorage.getItem("nex-theme") === "dark"; setDark(value); document.documentElement.classList.toggle("dark", value); }, []);
  const toggle = () => { const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); localStorage.setItem("nex-theme", next ? "dark" : "light"); };
  return <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"} title={dark ? "Tema claro" : "Tema escuro"}>{dark ? <Sun /> : <Moon />}</Button>;
}
