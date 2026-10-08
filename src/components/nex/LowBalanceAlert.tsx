import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function LowBalanceBell({ low }: { low: boolean }) {
  if (!low) {
    return (
      <Button variant="ghost" size="icon" aria-label="Notificações">
        <Bell />
      </Button>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Saldo Meta baixo"
          className="relative text-destructive"
        >
          <span className="absolute inset-1 animate-balance-wave rounded-full" />
          <Bell />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="text-sm font-semibold text-destructive">Saldo Meta baixo</p>
        <p className="mt-2 text-sm text-muted-foreground">
          O saldo de anúncios da Meta está em R$ 50,00 ou menos. O aviso permanece até o saldo ficar
          maior que R$ 50,00.
        </p>
        <Button asChild className="mt-4 w-full">
          <Link to="/creditos-meta">Adicionar saldo</Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
