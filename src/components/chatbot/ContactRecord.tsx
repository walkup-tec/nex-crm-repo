import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  chatbotContactProfileFn,
  registerChatbotClientFn,
  renameChatbotContactFileFn,
  renameChatbotContactFn,
  setChatbotContactDealFn,
  setChatbotContactProductsFn,
  setChatbotContactStageFn,
  setChatbotContactTagsFn,
} from "@/lib/chatbot.functions";
import { applyMask } from "@/lib/masks";
import { messageClock, negotiatedCents, negotiatedLabel, savedMediaTitle, tagInk, whatsappMask, type ChatbotContactProfile } from "@/lib/chatbot-evo";

function SavedMediaName({
  file,
  onRenamed,
}: {
  file: ChatbotContactProfile["files"][number];
  onRenamed: (fileId: string, name: string) => void;
}) {
  const title = savedMediaTitle(file.mime, file.name);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const name = draft.trim().replace(/\s+/g, " ");
    if (saving) return;
    if (name.length < 2) {
      setError("Informe o nome da mídia.");
      return;
    }
    setSaving(true);
    const result = await renameChatbotContactFileFn({ data: { fileId: file.id, name } });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    setEditing(false);
    onRenamed(file.id, result.data.name);
  }

  if (editing) {
    return (
      <>
        <div className="contact-name-edit">
          <input
            value={draft}
            autoFocus
            aria-label="Nome da mídia"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void save();
              }
              if (event.key === "Escape") {
                setDraft(title);
                setEditing(false);
                setError("");
              }
            }}
          />
          <button type="button" className="contact-check" aria-label="Salvar nome da mídia" disabled={saving} onClick={() => void save()}>
            <Check />
          </button>
        </div>
        {error ? <span className="contact-file-error">{error}</span> : null}
      </>
    );
  }

  return (
    <button
      type="button"
      className="contact-name"
      onClick={() => {
        setDraft(title);
        setEditing(true);
      }}
    >
      {title}
    </button>
  );
}

export function ContactRecord({
  contactId,
  tick,
  onRenamed,
}: {
  contactId: string;
  tick: number;
  onRenamed: (contactId: string, name: string) => void;
}) {
  const [profile, setProfile] = useState<ChatbotContactProfile | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);
  const [deal, setDeal] = useState("");
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    setEditing(false);
    setProfile(null);
    setError("");
    if (!contactId) return;
    let active = true;
    void chatbotContactProfileFn({ data: { contactId } }).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setProfile(result.data);
      setDraft(result.data.name);
      setDeal(negotiatedLabel(result.data.negotiatedCents));
    });
    return () => {
      active = false;
    };
  }, [contactId, tick]);

  async function saveName() {
    if (!profile || savingName) return;
    const name = draft.trim().replace(/\s+/g, " ");
    if (name.length < 2) {
      setError("Informe o nome do contato.");
      return;
    }
    setSavingName(true);
    const result = await renameChatbotContactFn({ data: { contactId: profile.id, name } });
    setSavingName(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    setEditing(false);
    setProfile({ ...profile, name: result.data.name });
    setDraft(result.data.name);
    onRenamed(profile.id, result.data.name);
  }

  async function saveDeal() {
    if (!profile || !profile.dealReady || savingLinks) return;
    const cents = negotiatedCents(deal);
    if (cents === profile.negotiatedCents) return;
    setSavingLinks(true);
    const result = await setChatbotContactDealFn({ data: { contactId: profile.id, cents } });
    setSavingLinks(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    setProfile({ ...profile, negotiatedCents: result.data.cents });
    setDeal(negotiatedLabel(result.data.cents));
  }

  async function registerClient() {
    if (!profile || !profile.dealReady || registering || profile.clientOwnerId) return;
    setRegistering(true);
    const result = await registerChatbotClientFn({ data: { contactId: profile.id } });
    setRegistering(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    setProfile({ ...profile, clientOwnerId: result.data.ownerId });
  }

  async function saveStage(stage: string) {
    if (!profile || savingLinks) return;
    setSavingLinks(true);
    const result = await setChatbotContactStageFn({ data: { contactId: profile.id, stage } });
    setSavingLinks(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    setProfile({ ...profile, stage: result.data.stage });
  }

  async function toggleTag(tagId: string) {
    if (!profile || savingLinks) return;
    const selected = profile.tags.filter((item) => item.selected).map((item) => item.id);
    const next = selected.includes(tagId) ? selected.filter((id) => id !== tagId) : [...selected, tagId];
    setSavingLinks(true);
    const result = await setChatbotContactTagsFn({ data: { contactId: profile.id, tagIds: next } });
    setSavingLinks(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    setProfile({ ...profile, tags: profile.tags.map((item) => ({ ...item, selected: next.includes(item.id) })) });
  }

  async function toggleProduct(productId: string) {
    if (!profile || savingLinks) return;
    const selected = profile.products.filter((item) => item.selected).map((item) => item.id);
    const next = selected.includes(productId) ? selected.filter((id) => id !== productId) : [...selected, productId];
    setSavingLinks(true);
    const result = await setChatbotContactProductsFn({ data: { contactId: profile.id, productIds: next } });
    setSavingLinks(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    setProfile({ ...profile, products: profile.products.map((item) => ({ ...item, selected: next.includes(item.id) })) });
  }

  return (
    <aside className="contact-panel" aria-label="Cadastro do contato">
      <div className="contact-panel-title">Contato</div>
      {!contactId ? (
        <div className="contact-placeholder">
          <strong>Nenhum contato selecionado</strong>
          <p>Abra uma conversa para ver o cadastro.</p>
        </div>
      ) : !profile ? (
        <div className="contact-placeholder">
          <p>{error || "Carregando o contato..."}</p>
        </div>
      ) : (
        <>
          {error ? <p className="contact-error">{error}</p> : null}
          <section className="contact-section">
            <h3>Nome</h3>
            {editing ? (
              <div className="contact-name-edit">
                <input
                  value={draft}
                  autoFocus
                  aria-label="Nome do contato"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void saveName();
                    }
                    if (event.key === "Escape") {
                      setDraft(profile.name);
                      setEditing(false);
                    }
                  }}
                />
                <button type="button" className="contact-check" aria-label="Salvar nome" disabled={savingName} onClick={() => void saveName()}>
                  <Check />
                </button>
              </div>
            ) : (
              <button type="button" className="contact-name" onClick={() => { setDraft(profile.name); setEditing(true); }}>
                {profile.name}
              </button>
            )}
          </section>
          <section className="contact-section">
            <h3>WhatsApp</h3>
            <p className="contact-phone">{whatsappMask(profile.phone) || profile.phone}</p>
          </section>
          <section className="contact-section">
            <h3>Produtos e serviços</h3>
            {profile.catalogReady && profile.products.length ? (
              <div className="contact-choices">
                {profile.products.map((item) => (
                  <label className="contact-choice" key={item.id}>
                    <input type="checkbox" checked={item.selected} disabled={savingLinks} onChange={() => void toggleProduct(item.id)} />
                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p>
                {profile.catalogReady ? "Nenhum produto cadastrado. " : "O cadastro de produtos ainda não está disponível. "}
                <Link to="/chatbot/produtos">Abrir Produtos</Link>
              </p>
            )}
          </section>
          <section className="contact-section">
            <h3>Kanban</h3>
            {profile.stageReady ? (
              <select className="contact-stage" aria-label="Etapa do kanban" value={profile.stage} disabled={savingLinks} onChange={(event) => void saveStage(event.target.value)}>
                <option value="">Sem etapa</option>
                {(profile.stage && !profile.stages.includes(profile.stage) ? [...profile.stages, profile.stage] : profile.stages).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            ) : (
              <p>A etapa do kanban ainda não está disponível.</p>
            )}
          </section>
          <section className="contact-section">
            <h3>Etiquetas</h3>
            {profile.catalogReady && profile.tags.length ? (
              <div className="contact-tags">
                {profile.tags.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`tag-chip${item.selected ? " selected" : ""}`}
                    aria-pressed={item.selected}
                    disabled={savingLinks}
                    style={item.selected ? { background: item.color, color: tagInk(item.color), borderColor: item.color } : { color: item.color, borderColor: item.color }}
                    onClick={() => void toggleTag(item.id)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            ) : (
              <p>
                {profile.catalogReady ? "Nenhuma etiqueta cadastrada. " : "O cadastro de etiquetas ainda não está disponível. "}
                <Link to="/chatbot/configuracoes" hash="etiquetas">Abrir Etiquetas</Link>
              </p>
            )}
          </section>
          <section className="contact-section">
            <h3>Valor negociado</h3>
            {profile.dealReady ? (
              <input
                className="contact-deal"
                inputMode="numeric"
                aria-label="Valor negociado"
                value={deal}
                disabled={savingLinks}
                placeholder="R$ 0,00"
                onChange={(event) => setDeal(applyMask("money", event.target.value))}
                onBlur={() => void saveDeal()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void saveDeal();
                  }
                }}
              />
            ) : (
              <p>O valor negociado ainda não está disponível.</p>
            )}
          </section>
          <section className="contact-section">
            <h3>Mídias salvas</h3>
            {profile.files.length ? (
              <ul className="contact-files">
                {profile.files.map((file) => (
                  <li key={file.id}>
                    <SavedMediaName
                      file={file}
                      onRenamed={(fileId, name) =>
                        setProfile((current) =>
                          current
                            ? { ...current, files: current.files.map((item) => (item.id === fileId ? { ...item, name } : item)) }
                            : current,
                        )
                      }
                    />
                    <time dateTime={file.createdAt}>{messageClock(file.createdAt)}</time>
                    {file.url ? (
                      <a href={file.url} target="_blank" rel="noreferrer">
                        Abrir
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhuma mídia salva neste contato.</p>
            )}
            {profile.dealReady ? (
              <Button type="button" className="contact-register" disabled={registering || Boolean(profile.clientOwnerId)} onClick={() => void registerClient()}>
                {profile.clientOwnerId ? "Cliente cadastrado" : registering ? "Cadastrando" : "Cadastrar cliente"}
              </Button>
            ) : null}
          </section>
        </>
      )}
    </aside>
  );
}
