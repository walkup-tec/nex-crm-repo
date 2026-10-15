import { Switch } from "@/components/ui/switch";

export function ClientFields({
  documentEnabled,
  rgEnabled,
  onDocument,
  onRg,
}: {
  documentEnabled: boolean;
  rgEnabled: boolean;
  onDocument: (value: boolean) => void;
  onRg: (value: boolean) => void;
}) {
  return (
    <>
      <div className="settings-row">
        <div>
          <strong>Nome</strong>
          <p>Obrigatório no cadastro do contato.</p>
        </div>
        <span className="status-pill good">Obrigatório</span>
      </div>
      <div className="settings-row">
        <div>
          <strong>WhatsApp</strong>
          <p>Obrigatório. O número aparece com a máscara de telefone.</p>
        </div>
        <span className="status-pill good">Obrigatório</span>
      </div>
      <div className="settings-row">
        <div>
          <strong>CPF/CNPJ</strong>
          <p>Quando ativo, entra no contato com a máscara de CPF ou CNPJ.</p>
        </div>
        <Switch checked={documentEnabled} onCheckedChange={onDocument} aria-label="Ativar CPF/CNPJ" />
      </div>
      <div className="settings-row">
        <div>
          <strong>RG</strong>
          <p>Quando ativo, entra no contato com a máscara de RG.</p>
        </div>
        <Switch checked={rgEnabled} onCheckedChange={onRg} aria-label="Ativar RG" />
      </div>
    </>
  );
}
