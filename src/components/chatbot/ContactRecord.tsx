import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  chatbotContactProfileFn,
  registerChatbotClientFn,
  renameChatbotContactFileFn,
  renameChatbotContactFn,
  setChatbotContactDealFn,
  setChatbotContactIdentityFn,
  setChatbotContactNoteFn,
  setChatbotContactProductsFn,
  setChatbotContactStageFn,
  setChatbotContactTagsFn,
} from "@/lib/chatbot.functions";
import { contractingFormUrl } from "@/lib/contracting";
import { applyMask, documentDigits, rgDigits } from "@/lib/masks";
import { clientPhoneLabel, contactExtraDataCount, messageClock, negotiatedCents, negotiatedLabel, savedMediaTitle, tagInk, type ChatbotContactProfile } from "@/lib/chatbot-evo";

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

function ExtraCount({ count, label }: { count: number; label: string }) {
  return (
    <span className={`contact-extra-count${count ? " has-items" : ""}`} aria-label={`${count} ${label}`}>
      {count}
    </span>
  );
}

function ProfileAvatar({ name, avatarUrl }: { name: string; avatarUrl: string }) {
  const [hidden, setHidden] = useState(false);
  const initials = (name || "?").slice(0, 2).toUpperCase();
  useEffect(() => setHidden(false), [avatarUrl]);
  if (!avatarUrl || hidden) return <span className="avatar">{initials}</span>;
  return (
    <span className="avatar">
      <img src={avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setHidden(true)} />
    </span>
  );
}

export function ContactRecord({
  contactId,
  tick,
  preview,
  onRenamed,
}: {
  contactId: string;
  tick: number;
  preview: { name: string; phone: string; avatarUrl: string } | null;
  onRenamed: (contactId: string, name: string) => void;
}) {
  const [profile, setProfile] = useState<ChatbotContactProfile | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);
  const [deal, setDeal] = useState("");
  const [documentDraft, setDocumentDraft] = useState("");
  const [rgDraft, setRgDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const contactRef = useRef(contactId);
  contactRef.current = contactId;
  const [extraOpen, setExtraOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [contractingUrl, setContractingUrl] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    setContractingUrl(contactId ? contractingFormUrl(window.location.origin, contactId) : "");
  }, [contactId]);

  function applyProfile(data: ChatbotContactProfile) {
    setProfile(data);
    setDraft(data.name);
    setDocumentDraft(applyMask("doc", data.document));
    setRgDraft(applyMask("rg", data.rg));
    setNoteDraft(data.note.replace(/\s+/g, " ").trim().slice(0, 300));
    setDeal(negotiatedLabel(data.negotiatedCents));
    setExtraOpen(Boolean(data.contracting));
    setMediaOpen(Boolean(data.contracting));
    setLinkCopied(false);
  }

  useEffect(() => {
    setEditing(false);
    setProfile((current) => (current?.id === contactId ? current : null));
    setDocumentDraft("");
    setRgDraft("");
    setNoteDraft("");
    setExtraOpen(false);
    setLinkCopied(false);
    setMediaOpen(false);
    setRefreshing(false);
    setRefreshed(false);
    setError("");
    if (!contactId) return;
    let active = true;
    void chatbotContactProfileFn({ data: { contactId } }).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      applyProfile(result.data);
    });
    return () => {
      active = false;
    };
  }, [contactId]);

  useEffect(() => {
    if (!contactId || !tick) return;
    let active = true;
    void chatbotContactProfileFn({ data: { contactId } }).then((result) => {
      if (!active || !result.ok) return;
      setProfile(result.data);
      setMediaOpen((open) => open || Boolean(result.data.contracting));
    });
    return () => {
      active = false;
    };
  }, [contactId, tick]);

  useEffect(() => {
    if (!refreshed) return;
    const timer = window.setTimeout(() => setRefreshed(false), 1600);
    return () => window.clearTimeout(timer);
  }, [refreshed]);

  useEffect(() => {
    const element = noteRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, [noteDraft, profile?.id]);

  async function refreshExtras() {
    if (!profile || refreshing) return;
    setRefreshing(true);
    setRefreshed(false);
    setError("");
    const requestedId = profile.id;
    const result = await chatbotContactProfileFn({ data: { contactId: requestedId } });
    if (contactRef.current !== requestedId) return;
    setRefreshing(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const data = result.data;
    setProfile((current) =>
      current
        ? {
            ...current,
            files: data.files,
            contracting: data.contracting,
            contractingLink: data.contractingLink,
            document: data.document,
            rg: data.rg,
            showDocument: data.showDocument,
            showRg: data.showRg,
          }
        : current,
    );
    setDocumentDraft(applyMask("doc", data.document));
    setRgDraft(applyMask("rg", data.rg));
    setExtraOpen((open) => open || Boolean(data.contracting || data.document || data.rg));
    setMediaOpen((open) => open || data.files.length > 0);
    setRefreshed(true);
  }

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

  async function saveNote() {
    if (!profile) return;
    const note = noteDraft.replace(/\s+/g, " ").trim().slice(0, 300);
    const current = profile.note.replace(/\s+/g, " ").trim().slice(0, 300);
    if (note === current) return;
    const result = await setChatbotContactNoteFn({ data: { contactId: profile.id, note } });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    setNoteDraft(result.data.note);
    setProfile({ ...profile, note: result.data.note });
  }

  async function saveIdentity(field: "document" | "rg") {
    if (!profile) return;
    const draft = field === "document" ? documentDraft : rgDraft;
    const stored = draft.trim() ? (field === "document" ? documentDigits(draft) : rgDigits(draft)) : "";
    const current = field === "document" ? profile.document : profile.rg;
    if (draft.trim() && !stored) {
      setError(field === "document" ? "Informe um CPF com 11 dígitos ou um CNPJ com 14." : "Informe um RG com pelo menos 7 dígitos.");
      return;
    }
    if (stored === current) {
      setError("");
      return;
    }
    const result = await setChatbotContactIdentityFn({ data: { contactId: profile.id, field, value: draft } });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    if (field === "document") {
      setProfile({ ...profile, document: result.data.value });
      setDocumentDraft(applyMask("doc", result.data.value));
      return;
    }
    setProfile({ ...profile, rg: result.data.value });
    setRgDraft(applyMask("rg", result.data.value));
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
      {!contactId ? (
        <div className="contact-placeholder">
          <strong>Nenhum contato selecionado</strong>
          <p>Abra uma conversa para ver o cadastro.</p>
        </div>
      ) : !profile ? (
        <>
          {preview ? (
            <>
              <section className="contact-section contact-identity">
                <ProfileAvatar name={preview.name} avatarUrl={preview.avatarUrl} />
                <span className="contact-name">{preview.name}</span>
              </section>
              <section className="contact-section">
                <h3>WhatsApp</h3>
                <p className="contact-phone">{clientPhoneLabel(preview.phone) || preview.phone}</p>
              </section>
            </>
          ) : null}
          <div className="contact-placeholder">
            <p>{error || "Carregando o contato..."}</p>
          </div>
        </>
      ) : (
        <>
          {error ? <p className="contact-error">{error}</p> : null}
          <section className="contact-section contact-identity">
            <ProfileAvatar name={profile.name} avatarUrl={profile.avatarUrl} />
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
            <p className="contact-phone">{clientPhoneLabel(profile.phone) || profile.phone}</p>
          </section>
          <section className="contact-section">
            <h3>Observação</h3>
            <textarea
              ref={noteRef}
              className="contact-note-field"
              maxLength={300}
              rows={1}
              aria-label="Observação"
              placeholder="Observação"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value.slice(0, 300))}
              onBlur={() => void saveNote()}
            />
            <p className="contact-note-count">{noteDraft.length}/300</p>
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
          <section className="contact-section contact-refresh-section">
            <Button type="button" variant="outline" className="contact-refresh" disabled={refreshing} aria-label="Atualizar mídias e outros dados" onClick={() => void refreshExtras()}>
              {refreshing ? "Atualizando" : refreshed ? "Atualizado" : "Atualizar"}
            </Button>
          </section>
          {profile.showDocument || profile.showRg || profile.contractingLink ? (
            <section className={`contact-section${extraOpen ? "" : " is-collapsed"}`}>
              <Collapsible open={extraOpen} onOpenChange={setExtraOpen}>
                <CollapsibleTrigger className="contact-extra">
                  <span className="contact-extra-title">
                    Outros dados
                    <ExtraCount count={contactExtraDataCount(profile)} label="dados" />
                  </span>
                  <ChevronDown />
                </CollapsibleTrigger>
                <CollapsibleContent className="contact-extra-body">
                  {profile.contractingLink ? (
                    <div className="contact-contracting-link">
                      <p>Link de contratação</p>
                      <button
                        type="button"
                        onClick={() => {
                          if (!contractingUrl) return;
                          void navigator.clipboard.writeText(contractingUrl).then(() => setLinkCopied(true)).catch(() => setLinkCopied(false));
                        }}
                      >
                        {linkCopied ? "Link copiado" : "Copiar link"}
                      </button>
                      {contractingUrl ? <span>{contractingUrl}</span> : null}
                    </div>
                  ) : null}
                  {profile.contracting ? (
                    <dl className="contact-contracting">
                      <div>
                        <dt>Cliente</dt>
                        <dd>
                          {profile.name} (ID: {profile.contracting.protocol})
                        </dd>
                      </div>
                      <div>
                        <dt>CNPJ</dt>
                        <dd>{profile.contracting.cnpj}</dd>
                      </div>
                      <div>
                        <dt>Razão social</dt>
                        <dd>{profile.contracting.legalName}</dd>
                      </div>
                      <div>
                        <dt>Endereço</dt>
                        <dd>{profile.contracting.address}</dd>
                      </div>
                      <div>
                        <dt>Representante legal</dt>
                        <dd>
                          {profile.contracting.representativeName}
                          <span>{[profile.contracting.representativeDocument, profile.contracting.representativeEmail].filter(Boolean).join(" — ")}</span>
                        </dd>
                      </div>
                      <div>
                        <dt>Testemunha</dt>
                        <dd>
                          {profile.contracting.witnessName}
                          <span>
                            {profile.contracting.witnessDocument} — {profile.contracting.witnessEmail}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                  {profile.showDocument ? (
                    <label>
                      CPF/CNPJ
                      <input
                        className="contact-deal"
                        inputMode="numeric"
                        aria-label="CPF ou CNPJ"
                        placeholder="000.000.000-00"
                        value={documentDraft}
                        onChange={(event) => setDocumentDraft(applyMask("doc", event.target.value))}
                        onBlur={() => void saveIdentity("document")}
                      />
                    </label>
                  ) : null}
                  {profile.showRg ? (
                    <label>
                      RG
                      <input
                        className="contact-deal"
                        aria-label="RG"
                        placeholder="00.000.000-0"
                        value={rgDraft}
                        onChange={(event) => setRgDraft(applyMask("rg", event.target.value))}
                        onBlur={() => void saveIdentity("rg")}
                      />
                    </label>
                  ) : null}
                </CollapsibleContent>
              </Collapsible>
            </section>
          ) : null}
          <section className={`contact-section${mediaOpen ? "" : " is-collapsed"}`}>
            <Collapsible open={mediaOpen} onOpenChange={setMediaOpen}>
              <CollapsibleTrigger className="contact-extra">
                <span className="contact-extra-title">
                  Mídias salvas
                  <ExtraCount count={profile.files.length} label="mídias" />
                </span>
                <ChevronDown />
              </CollapsibleTrigger>
              <CollapsibleContent className="contact-extra-body">
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
              </CollapsibleContent>
            </Collapsible>
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
