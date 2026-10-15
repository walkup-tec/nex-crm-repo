import { useEffect, useState } from "react";
import { UsersRound } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  chatbotTeamSnapshotFn,
  createChatbotTeamFn,
  deleteChatbotAttendantFn,
  deleteChatbotTeamFn,
  addMyselfAsChatbotAttendantFn,
  inviteChatbotAttendantFn,
  resendAttendantInviteFn,
  updateChatbotAttendantFn,
  updateChatbotTeamFn,
  chatbotAccessProfilesFn,
} from "@/lib/chatbot.functions";
import { whatsappMask } from "@/lib/chatbot-evo";
import { chatbotMenuItems, type ChatbotMenuMap } from "@/lib/chatbot-menus";
import { chatbotProfileItems, chatbotProfileLabel, defaultChatbotProfiles, profileForMenus, type ChatbotProfileKey, type ChatbotProfiles } from "@/lib/chatbot-profiles";

type TeamRecord = { id: string; name: string; connectionId: string; connectionIds?: string[]; channelName: string; channelPhone: string };
type AttendantRecord = { id: string; name: string; email: string; self?: boolean; teamIds: string[]; menus: ChatbotMenuMap };
type ChannelRecord = { id: string; name: string; phone: string };
type AccountRecord = { id: string; name: string; email: string };
type TeamData = { teams: TeamRecord[]; attendants: AttendantRecord[]; channels: ChannelRecord[]; account?: AccountRecord; canAddMyself?: boolean };

export function LiveTeams() {
  const [data, setData] = useState<TeamData | null>(null);
  const [message, setMessage] = useState("");
  const [teamName, setTeamName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [attendantName, setAttendantName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<ChatbotProfiles>(defaultChatbotProfiles);
  const [profile, setProfile] = useState<ChatbotProfileKey>("attendant");
  const [customMenus, setCustomMenus] = useState(false);
  const [pending, setPending] = useState("");
  const [editingTeamId, setEditingTeamId] = useState("");
  const [editingAttendantId, setEditingAttendantId] = useState("");
  const [addMyself, setAddMyself] = useState(false);
  const [removing, setRemoving] = useState<{ kind: "team" | "attendant"; id: string; name: string; channelName: string } | null>(null);
  const [failure, setFailure] = useState("");

  function showFailure(text: string) {
    setFailure(text.trim() || "Não foi possível concluir esta ação.");
  }

  async function load() {
    const result = await chatbotTeamSnapshotFn();
    if (!result.ok) {
      showFailure(result.message);
      return;
    }
    setData(result.data);
  }

  useEffect(() => {
    void load();
    void chatbotAccessProfilesFn().then((result) => {
      if (result.ok) setProfiles(result.data);
    });
  }, []);

  function toggle(list: string[], id: string) {
    return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  }

  function resetAttendantForm() {
    setAttendantName("");
    setEmail("");
    setSelectedTeams([]);
    setProfile("attendant");
    setCustomMenus(false);
    setEditingAttendantId("");
    setAddMyself(false);
  }

  async function saveTeam() {
    setPending("team");
    const result = editingTeamId
      ? await updateChatbotTeamFn({ data: { teamId: editingTeamId, name: teamName, connectionId: channelId } })
      : await createChatbotTeamFn({ data: { name: teamName, connectionId: channelId } });
    setPending("");
    if (!result.ok) {
      showFailure(result.message);
      return;
    }
    setTeamName("");
    setChannelId("");
    setEditingTeamId("");
    await load();
    if (editingTeamId) setMessage("Equipe atualizada.");
  }

  async function saveAttendant() {
    setPending("invite");
    if (editingAttendantId) {
      const result = await updateChatbotAttendantFn({ data: { attendantId: editingAttendantId, name: attendantName, email, teamIds: selectedTeams, menus: profiles[profile] } });
      setPending("");
      if (!result.ok) {
        showFailure(result.message);
        return;
      }
      resetAttendantForm();
      await load();
      setMessage("Atendente atualizado.");
      return;
    }
    if (addMyself) {
      const result = await addMyselfAsChatbotAttendantFn({ data: { teamIds: selectedTeams, menus: profiles[profile] } });
      setPending("");
      if (!result.ok) {
        showFailure(result.message);
        return;
      }
      resetAttendantForm();
      await load();
      setMessage("Você entrou na lista de atendentes.");
      return;
    }
    const result = await inviteChatbotAttendantFn({ data: { name: attendantName, email, teamIds: selectedTeams, menus: profiles[profile] } });
    setPending("");
    if (!result.ok) {
      showFailure(result.message);
      return;
    }
    const notice = !result.data.created
      ? result.data.mailError
        ? `Esse e-mail já é um atendente. As equipes foram atualizadas. ${result.data.mailError}`
        : result.data.emailSent
          ? "Esse e-mail já é um atendente. As equipes foram atualizadas e o e-mail para criar a senha foi enviado."
          : "Esse e-mail já é um atendente desta empresa. As equipes foram atualizadas."
      : result.data.emailSent
        ? "Convite enviado."
        : result.data.mailError || "Atendente criado. O e-mail de convite não foi enviado.";
    resetAttendantForm();
    await load();
    setMessage(notice);
  }

  async function resend(attendant: AttendantRecord) {
    setPending(`resend:${attendant.id}`);
    const result = await resendAttendantInviteFn({ data: { email: attendant.email, name: attendant.name } });
    setPending("");
    if (result.ok) setMessage("Convite reenviado.");
    else showFailure(result.message);
  }

  function editTeam(team: TeamRecord) {
    setEditingTeamId(team.id);
    setTeamName(team.name);
    setChannelId(team.connectionId);
    setMessage("");
  }

  function editAttendant(attendant: AttendantRecord) {
    setEditingAttendantId(attendant.id);
    setAttendantName(attendant.name);
    setEmail(attendant.email);
    setSelectedTeams(attendant.teamIds);
    const matched = profileForMenus(attendant.menus, profiles);
    setProfile(matched ?? "attendant");
    setCustomMenus(!matched);
    setAddMyself(false);
    setMessage("");
  }

  function menuSummary(menus: ChatbotMenuMap) {
    const labels = chatbotMenuItems.filter((item) => menus[item.key]).map((item) => item.label);
    if (labels.length === chatbotMenuItems.length) return "Todos os menus";
    return labels.join(", ") || "Nenhum menu";
  }

  function teamNames(ids: string[]) {
    return ids.map((id) => teams.find((team) => team.id === id)?.name).filter(Boolean).join(", ");
  }

  const teams = data?.teams ?? [];
  const channels = data?.channels ?? [];
  const editingSelf = Boolean(editingAttendantId && data?.attendants.some((attendant) => attendant.id === editingAttendantId && attendant.self));
  function channelIds(team: TeamRecord) {
    return team.connectionIds ?? (team.connectionId ? [team.connectionId] : []);
  }

  return (
    <main className="page">
      {message ? <p className="info-note mb-5">{message}</p> : null}
      <section className="team-board">
        <article className="team-panel">
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              void saveTeam();
            }}
          >
            <h2>{editingTeamId ? "Editar equipe" : "Nova equipe"}</h2>
            <label>
              Nome da equipe
              <input value={teamName} maxLength={40} onChange={(event) => setTeamName(event.target.value)} placeholder="Ex.: Comercial" />
            </label>
            <label>
              Canal
              <select value={channelId} onChange={(event) => setChannelId(event.target.value)} aria-label="Canal">
                <option value="">Selecione o WhatsApp</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name} {whatsappMask(channel.phone)}
                  </option>
                ))}
              </select>
            </label>
            <div className="team-form-actions">
              <Button disabled={pending === "team" || teamName.trim().length < 2 || !channelId} type="submit">
                {pending === "team" ? "Salvando" : editingTeamId ? "Salvar equipe" : "Criar equipe"}
              </Button>
              {editingTeamId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingTeamId("");
                    setTeamName("");
                    setChannelId("");
                  }}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
          <div className="team-panel-list">
            {teams.length ? (
              teams.map((team) => (
                <article key={team.id} className="team-row">
                  <div className="team-row-head">
                    <div className="team-row-main">
                      <strong>{team.name}</strong>
                      {channelIds(team).length ? (
                        <>
                          <p>{team.channelName}</p>
                          {channelIds(team).length === 1 ? <p>{whatsappMask(team.channelPhone) || "Canal sem número"}</p> : null}
                        </>
                      ) : (
                        <p className="team-channel-missing">Conecte um novo canal</p>
                      )}
                    </div>
                    <span className="status-pill">Canal</span>
                  </div>
                  <div className="team-row-actions">
                    <Button variant="ghost" size="sm" onClick={() => editTeam(team)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRemoving({ kind: "team", id: team.id, name: team.name, channelName: team.channelName })}>
                      Excluir
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <p className="team-empty">Nenhuma equipe criada nesta empresa.</p>
            )}
          </div>
        </article>
        <article className="team-panel">
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              void saveAttendant();
            }}
          >
            <h2>{editingAttendantId ? "Editar atendente" : "Novo atendente"}</h2>
            {data?.canAddMyself && !editingAttendantId ? (
              <label className="team-choice">
                <input
                  type="checkbox"
                  checked={addMyself}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setAddMyself(enabled);
                    const account = data.account;
                    if (!account) return;
                    if (enabled) {
                      setAttendantName(account.name);
                      setEmail(account.email);
                      return;
                    }
                    setAttendantName("");
                    setEmail("");
                  }}
                />
                Me adicionar
              </label>
            ) : null}
            <label>
              Nome
              <input value={attendantName} readOnly={addMyself || editingSelf} onChange={(event) => setAttendantName(event.target.value)} placeholder="Nome do atendente" />
            </label>
            <label>
              E-mail
              <input type="email" value={email} readOnly={addMyself || editingSelf} onChange={(event) => setEmail(event.target.value)} placeholder="atendente@empresa.com" />
            </label>
            <div className="team-choices">
              <span>Equipes</span>
              {teams.length ? (
                teams.map((team) => (
                  <label className="team-choice" key={team.id}>
                    <input
                      type="checkbox"
                      checked={selectedTeams.includes(team.id)}
                      onChange={() => setSelectedTeams((current) => toggle(current, team.id))}
                    />
                    {team.name}
                  </label>
                ))
              ) : (
                <p className="team-empty">Crie uma equipe antes de convidar o atendente.</p>
              )}
            </div>
            <label>
              Perfil de acesso
              <select aria-label="Perfil de acesso" value={profile} onChange={(event) => { setProfile(event.target.value as ChatbotProfileKey); setCustomMenus(false); }}>
                {chatbotProfileItems.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>
            <p className="profile-grant">Inclui: {chatbotMenuItems.filter((item) => profiles[profile][item.key]).map((item) => item.label).join(", ") || "Nenhum menu"}</p>
            {customMenus ? <p className="profile-grant">Os menus atuais não seguem um perfil. Ao salvar, passam a valer os menus do perfil escolhido.</p> : null}
            <div className="team-form-actions">
              <Button disabled={pending === "invite" || attendantName.trim().length < 2 || !email.includes("@") || !selectedTeams.length || !chatbotMenuItems.some((item) => profiles[profile][item.key])} type="submit">
                <UsersRound />
                {pending === "invite" ? "Salvando" : editingAttendantId ? "Salvar atendente" : addMyself ? "Me adicionar" : "Convidar atendente"}
              </Button>
              {editingAttendantId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => resetAttendantForm()}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
          <div className="team-panel-list">
            {data?.attendants.length ? (
              data.attendants.map((attendant) => (
                <article key={attendant.id} className="team-row">
                  <div className="team-row-main">
                    <strong>{attendant.name}</strong>
                    <p>{attendant.email}</p>
                    <p>{teamNames(attendant.teamIds) || "Sem equipe"}</p>
                    <p>{profileForMenus(attendant.menus, profiles) ? chatbotProfileLabel(profileForMenus(attendant.menus, profiles) as ChatbotProfileKey) : "Personalizado"}</p>
                    <p>{menuSummary(attendant.menus)}</p>
                  </div>
                  <div className="team-row-actions">
                    <Button variant="ghost" size="sm" onClick={() => editAttendant(attendant)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRemoving({ kind: "attendant", id: attendant.id, name: attendant.name, channelName: "" })}>
                      {attendant.self ? "Remover" : "Excluir"}
                    </Button>
                    {attendant.self ? null : (
                      <Button variant="ghost" size="sm" disabled={pending === `resend:${attendant.id}`} onClick={() => void resend(attendant)}>
                        {pending === `resend:${attendant.id}` ? "Enviando" : "Reenviar convite"}
                      </Button>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <p className="team-empty">Nenhum atendente nesta empresa.</p>
            )}
          </div>
        </article>
      </section>
      <AlertDialog open={failure !== ""} onOpenChange={(open) => !open && setFailure("")}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não foi possível concluir</AlertDialogTitle>
            <AlertDialogDescription>{failure}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Entendi</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removing?.kind === "attendant" ? "Excluir atendente" : "Excluir equipe"}</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.kind === "attendant"
                ? data?.attendants.some((attendant) => attendant.id === removing.id && attendant.self)
                  ? `Remover ${removing.name} da lista de atendentes? O acesso de administrador continua.`
                  : `Excluir ${removing.name}? O acesso é removido e as conversas dessa pessoa voltam para a fila.`
                : `Excluir ${removing?.name}? Os atendentes deixam de receber as mensagens do canal ${removing?.channelName}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending === "delete"}
              onClick={() => {
                if (!removing) return;
                const current = removing;
                setPending("delete");
                const request = current.kind === "attendant"
                  ? deleteChatbotAttendantFn({ data: { attendantId: current.id } })
                  : deleteChatbotTeamFn({ data: { teamId: current.id } });
                void request.then(async (result) => {
                  setPending("");
                  if (!result.ok) {
                    setRemoving(null);
                    showFailure(result.message);
                    return;
                  }
                  if (current.kind === "team" && editingTeamId === current.id) {
                    setEditingTeamId("");
                    setTeamName("");
                    setChannelId("");
                  }
                  if (current.kind === "attendant" && editingAttendantId === current.id) resetAttendantForm();
                  setRemoving(null);
                  await load();
                });
              }}
            >
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
