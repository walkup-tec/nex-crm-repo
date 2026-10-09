import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { applyMask } from "@/lib/masks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AccountTheme = "light" | "dark";

type AccountInfo = {
  name: string;
  email: string;
  whatsapp: string;
  theme: AccountTheme;
  organization: string;
};

type AccountDraft = {
  name: string;
  whatsapp: string;
  theme: AccountTheme;
};

function applyTheme(theme: AccountTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("nex-theme", theme);
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

async function loadSignedInAccount(): Promise<AccountInfo> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Entre novamente para ver sua conta.");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, email, whatsapp, theme, organization_id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) throw new Error("Não foi possível ler os dados desta conta.");
  if (!profile) throw new Error("Não encontramos os dados desta conta.");
  let organization = "";
  if (profile.organization_id) {
    const { data: company } = await supabase
      .from("organizations")
      .select("legal_name")
      .eq("id", profile.organization_id)
      .maybeSingle();
    organization = company?.legal_name?.trim() ?? "";
  }
  const theme: AccountTheme = profile.theme === "dark" ? "dark" : "light";
  return {
    name: profile.full_name?.trim() ?? "",
    email: profile.email || data.user.email || "",
    whatsapp: profile.whatsapp ? applyMask("phone", profile.whatsapp) : "",
    theme,
    organization,
  };
}

async function saveSignedInAccount(draft: AccountDraft) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Entre novamente para salvar sua conta.");
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      full_name: draft.name.trim(),
      whatsapp: draft.whatsapp.trim() || null,
      theme: draft.theme,
    })
    .eq("id", data.user.id);
  if (updateError) throw new Error("Não foi possível salvar os dados desta conta.");
  applyTheme(draft.theme);
}

export function AccountSettings({
  loadAccount = loadSignedInAccount,
  saveAccount = saveSignedInAccount,
}: {
  loadAccount?: () => Promise<AccountInfo>;
  saveAccount?: (draft: AccountDraft) => Promise<void>;
}) {
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [theme, setTheme] = useState<AccountTheme>("light");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setSaved(false);
    void loadAccount()
      .then((account) => {
        if (!active) return;
        setName(account.name);
        setEmail(account.email);
        setWhatsapp(account.whatsapp);
        setTheme(account.theme);
        setOrganization(account.organization);
        applyTheme(account.theme);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error ? caught.message : "Não foi possível ler os dados desta conta.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, loadAccount]);

  async function save() {
    const trimmed = name.trim();
    const digits = phoneDigits(whatsapp);
    if (!trimmed) {
      setError("Informe o nome completo.");
      setSaved(false);
      return;
    }
    if (digits && (digits.length < 10 || digits.length > 11)) {
      setError("Informe um WhatsApp com DDD.");
      setSaved(false);
      return;
    }
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await saveAccount({
        name: trimmed,
        whatsapp: digits ? applyMask("phone", digits) : "",
        theme,
      });
      setName(trimmed);
      setWhatsapp(digits ? applyMask("phone", digits) : "");
      setSaved(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível salvar os dados desta conta.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-48 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Carregando sua conta...
      </div>
    );
  }

  if (error && !email && !name) {
    return (
      <div className="max-w-3xl rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p>{error}</p>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => setAttempt((current) => current + 1)}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Dados da conta</CardTitle>
        <p className="text-sm text-muted-foreground">
          Estas são as informações da conta que está logada.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="account-name">Nome completo</Label>
          <Input
            id="account-name"
            className="mt-2"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
          />
        </div>
        <div>
          <Label htmlFor="account-email">E-mail</Label>
          <Input id="account-email" className="mt-2" value={email} disabled />
        </div>
        <div>
          <Label htmlFor="account-whatsapp">WhatsApp</Label>
          <Input
            id="account-whatsapp"
            className="mt-2"
            inputMode="tel"
            value={whatsapp}
            onChange={(event) => {
              setWhatsapp(applyMask("phone", event.target.value));
              setSaved(false);
            }}
          />
        </div>
        <div>
          <Label htmlFor="account-theme">Tema preferido</Label>
          <Select
            value={theme}
            onValueChange={(value) => {
              const next: AccountTheme = value === "dark" ? "dark" : "light";
              setTheme(next);
              applyTheme(next);
              setSaved(false);
            }}
          >
            <SelectTrigger id="account-theme" className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Claro</SelectItem>
              <SelectItem value="dark">Escuro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {organization ? (
          <div className="sm:col-span-2">
            <Label htmlFor="account-organization">Empresa</Label>
            <Input id="account-organization" className="mt-2" value={organization} disabled />
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
          {saved ? (
            <span className="flex items-center gap-1 text-sm text-success">
              <CheckCircle2 className="size-4" />
              Alterações salvas
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
