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
  deleteChatbotTeamFn,
  inviteChatbotAttendantFn,
  setChatbotAttendantTeamsFn,
} from "@/lib/chatbot.functions";
import { whatsappMask } from "@/lib/chatbot-evo";

type TeamRecord = { id: string; name: string; connectionId: string; channelName: string; channelPhone: string };
type AttendantRecord = { id: string; name: string; email: string; teamIds: string[] };
type ChannelRecord = { id: string; name: string; phone: string };
type TeamData = { teams: TeamRecord[]; attendants: AttendantRecord[]; channels: ChannelRecord[] };

export function LiveTeams() {
  const [data, setData] = useState<TeamData | null>(null);
  const [message, setMessage] = useState("");
  const [teamName, setTeamName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [attendantName, setAttendantName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState("");
  const [removing, setRemoving] = useState<TeamRecord | null>(null);

  async function load() {
    const result = await chatbotTeamSnapshotFn();
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setData(result.data);
    setChoices(Object.fromEntries(result.data.attendants.map((item) => [item.id, item.teamIds])));
    setMessage("");
  }

  useEffect(() => {
    void load();
  }, []);

  function toggle(list: string[], id: string) {
    return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  }

  async function createTeam() {
    setPending("team");
    const result = await createChatbotTeamFn({ data: { name: teamName, connectionId: channelId } });
    setPending("");
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setTeamName("");
    setChannelId("");
    await load();
  }

  async function invite() {
    setPending("invite");
    const result = await inviteChatbotAttendantFn({ data: { name: attendantName, email, teamIds: selectedTeams } });
    setPending("");
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setAttendantName("");
    setEmail("");
    setSelectedTeams([]);
    await load();
    setMessage(result.data.created ? (result.data.emailSent ? "Convite enviado." : "Atendente criado. O e-mail de convite não foi enviado.") : "Atendente incluído nas equipes selecionadas.");
  }

  async function saveTeams(attendantId: string) {
    setPending(attendantId);
    const result = await setChatbotAttendantTeamsFn({ data: { attendantId, teamIds: choices[attendantId] ?? [] } });
    setPending("");
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    await load();
  }

  const teams = data?.teams ?? [];
  const channels = data?.channels ?? [];

  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <h1>Time</h1>
          <p>Cada equipe atende somente o canal de WhatsApp escolhido na criação.</p>
        </div>
      </div>
      {message ? <p className="info-note mb-5">{message}</p> : null}
      <section className="team-board">
        <article className="team-panel">
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              void createTeam();
            }}
          >
            <h2>Nova equipe</h2>
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
            <Button disabled={pending === "team" || teamName.trim().length < 2 || !channelId} type="submit">
              {pending === "team" ? "Salvando" : "Criar equipe"}
            </Button>
          </form>
          <div className="team-panel-list">
            {teams.length ? (
              teams.map((team) => (
                <article key={team.id} className="team-row">
                  <div className="team-row-head">
                    <div className="team-row-main">
                      <strong>{team.name}</strong>
                      <p>{team.channelName}</p>
                      <p>{whatsappMask(team.channelPhone) || "Canal sem número"}</p>
                    </div>
                    <span className="status-pill">Canal</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(team)}>
                    Excluir
                  </Button>
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
              void invite();
            }}
          >
            <h2>Novo atendente</h2>
            <label>
              Nome
              <input value={attendantName} onChange={(event) => setAttendantName(event.target.value)} placeholder="Nome do atendente" />
            </label>
            <label>
              E-mail
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="atendente@empresa.com" />
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
            <Button disabled={pending === "invite" || attendantName.trim().length < 2 || !email.includes("@") || !selectedTeams.length} type="submit">
              <UsersRound />
              {pending === "invite" ? "Convidando" : "Convidar atendente"}
            </Button>
          </form>
          <div className="team-panel-list">
            {data?.attendants.length ? (
              data.attendants.map((attendant) => (
                <article key={attendant.id} className="team-row">
                  <div className="team-row-main">
                    <strong>{attendant.name}</strong>
                    <p>{attendant.email}</p>
                  </div>
                  <div className="team-choices">
                    {teams.map((team) => (
                      <label className="team-choice" key={team.id}>
                        <input
                          type="checkbox"
                          checked={(choices[attendant.id] ?? []).includes(team.id)}
                          onChange={() =>
                            setChoices((current) => ({
                              ...current,
                              [attendant.id]: toggle(current[attendant.id] ?? [], team.id),
                            }))
                          }
                        />
                        {team.name}
                        <span>{team.channelName}</span>
                      </label>
                    ))}
                  </div>
                  <Button size="sm" disabled={pending === attendant.id || !(choices[attendant.id] ?? []).length} onClick={() => void saveTeams(attendant.id)}>
                    {pending === attendant.id ? "Salvando" : "Salvar equipes"}
                  </Button>
                </article>
              ))
            ) : (
              <p className="team-empty">Nenhum atendente nesta empresa.</p>
            )}
          </div>
        </article>
      </section>
      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir equipe</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir {removing?.name}? Os atendentes deixam de receber as mensagens do canal {removing?.channelName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                if (!removing) return;
                const teamId = removing.id;
                setPending("delete");
                void deleteChatbotTeamFn({ data: { teamId } }).then(async (result) => {
                  setPending("");
                  if (!result.ok) {
                    setMessage(result.message);
                    setRemoving(null);
                    return;
                  }
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
