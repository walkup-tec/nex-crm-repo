import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Brand } from "@/components/nex/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { contractingAddressFn, contractingCompanyFn, contractingContactFn } from "@/lib/contracting.functions";
import {
  cepMask,
  cnpjMask,
  contractingFileKinds,
  contractingFileLabels,
  contractingFileProblem,
  contractingProblem,
  cpfMask,
  type ContractingFileKind,
  type ContractingInput,
} from "@/lib/contracting";

const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export const Route = createFileRoute("/contratacao")({
  head: () => ({
    meta: [
      { title: "Contratação — Agência NEX" },
      { name: "description", content: "Envie os dados e os documentos da contratação." },
    ],
  }),
  component: Page,
});

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Page() {
  const [contactId, setContactId] = useState("");
  const [contactName, setContactName] = useState("");
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [legalName, setLegalName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [street, setStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [representativeEmail, setRepresentativeEmail] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [witnessDocument, setWitnessDocument] = useState("");
  const [witnessEmail, setWitnessEmail] = useState("");
  const [files, setFiles] = useState<Partial<Record<ContractingFileKind, File>>>({});
  const [pending, setPending] = useState(false);
  const [lookingUp, setLookingUp] = useState("");
  const [error, setError] = useState("");
  const [protocol, setProtocol] = useState("");

  useEffect(() => {
    const contato = new URLSearchParams(window.location.search).get("contato") ?? "";
    setContactId(contato);
    void contractingContactFn({ data: { contactId: contato } })
      .then((result) => {
        if (!result.ok) {
          setBlocked(result.message);
          setReady(true);
          return;
        }
        setContactName(result.data.name);
        setReady(true);
      })
      .catch(() => {
        setBlocked("Este link de contratação não está disponível.");
        setReady(true);
      });
  }, []);

  async function fillCompany() {
    if (legalName.trim() || cnpj.replace(/\D/g, "").length !== 14) return;
    setLookingUp("cnpj");
    const result = await contractingCompanyFn({ data: { cnpj } });
    setLookingUp("");
    if (result.ok) setLegalName(result.data.legalName);
  }

  async function fillAddress() {
    if (postalCode.replace(/\D/g, "").length !== 8) return;
    setLookingUp("cep");
    setError("");
    const result = await contractingAddressFn({ data: { postalCode } });
    setLookingUp("");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.data.street) setStreet(result.data.street);
    if (result.data.district) setDistrict(result.data.district);
    setCity(result.data.city);
    setState(result.data.state);
  }

  function chooseFile(kind: ContractingFileKind, list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    const problem = contractingFileProblem({ name: file.name, size: file.size });
    if (problem) {
      setFiles((current) => {
        const next = { ...current };
        delete next[kind];
        return next;
      });
      setError(`${contractingFileLabels[kind]}: ${problem}`);
      return;
    }
    setError("");
    setFiles((current) => ({ ...current, [kind]: file }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const input: ContractingInput = {
      cnpj,
      legalName,
      postalCode,
      street,
      addressNumber,
      complement,
      district,
      city,
      state,
      representativeName,
      representativeEmail,
      witnessName,
      witnessDocument,
      witnessEmail,
    };
    const problem = contractingProblem(input);
    if (problem) {
      setError(problem);
      return;
    }
    for (const kind of contractingFileKinds) {
      const file = files[kind];
      if (!file) {
        setError(`Envie o arquivo: ${contractingFileLabels[kind]}.`);
        return;
      }
    }
    const body = new FormData();
    body.set("contato", contactId);
    body.set("cnpj", cnpj);
    body.set("legalName", legalName);
    body.set("postalCode", postalCode);
    body.set("street", street);
    body.set("addressNumber", addressNumber);
    body.set("complement", complement);
    body.set("district", district);
    body.set("city", city);
    body.set("state", state);
    body.set("representativeName", representativeName);
    body.set("representativeEmail", representativeEmail);
    body.set("witnessName", witnessName);
    body.set("witnessDocument", witnessDocument);
    body.set("witnessEmail", witnessEmail);
    for (const kind of contractingFileKinds) {
      const file = files[kind];
      if (file) body.set(kind, file);
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/contratacao", { method: "POST", body });
      const payload = (await response.json()) as { ok?: boolean; protocol?: string; message?: string };
      if (!response.ok || !payload.ok || !payload.protocol) {
        setError(payload.message || "Não foi possível receber a contratação.");
        setPending(false);
        return;
      }
      setProtocol(payload.protocol);
    } catch {
      setError("Não foi possível receber a contratação.");
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-6">
      <div className="mx-auto w-full max-w-lg rounded-xl border bg-card p-5 shadow-panel sm:p-7">
        <Brand />
        <h1 className="mt-6 font-display text-2xl font-bold">Contratação</h1>
        {!ready ? <p className="mt-3 text-sm text-muted-foreground">Carregando o formulário...</p> : null}
        {ready && blocked ? <p className="mt-3 text-sm text-destructive">{blocked}</p> : null}
        {ready && !blocked && protocol ? (
          <div className="mt-6 space-y-3">
            <p className="text-base font-medium">Contratação recebida.</p>
            <p className="text-sm text-muted-foreground">
              Cliente {contactName} (ID: {protocol})
            </p>
          </div>
        ) : null}
        {ready && !blocked && !protocol ? (
          <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-5">
            <p className="text-sm text-muted-foreground">Cliente {contactName}. Preencha todos os campos. O complemento é o único opcional.</p>
            <section className="space-y-4">
              <h2 className="text-sm font-bold tracking-wide">CONTRATANTE</h2>
              <Field id="cnpj" label="CNPJ">
                <Input id="cnpj" inputMode="numeric" autoComplete="off" className="h-12" value={cnpj} required onChange={(event) => setCnpj(cnpjMask(event.target.value))} onBlur={() => void fillCompany()} />
              </Field>
              <Field id="legal-name" label="Razão social">
                <Input id="legal-name" autoComplete="organization" className="h-12" value={legalName} required onChange={(event) => setLegalName(event.target.value)} />
              </Field>
              <Field id="postal-code" label="CEP">
                <Input id="postal-code" inputMode="numeric" autoComplete="postal-code" className="h-12" value={postalCode} required onChange={(event) => setPostalCode(cepMask(event.target.value))} onBlur={() => void fillAddress()} />
              </Field>
              <Field id="street" label="Logradouro">
                <Input id="street" autoComplete="address-line1" className="h-12" value={street} required onChange={(event) => setStreet(event.target.value)} />
              </Field>
              <Field id="address-number" label="Número">
                <Input id="address-number" autoComplete="off" className="h-12" value={addressNumber} required onChange={(event) => setAddressNumber(event.target.value)} />
              </Field>
              <Field id="complement" label="Complemento">
                <Input id="complement" autoComplete="address-line2" className="h-12" value={complement} onChange={(event) => setComplement(event.target.value)} />
              </Field>
              <Field id="district" label="Bairro">
                <Input id="district" autoComplete="off" className="h-12" value={district} required onChange={(event) => setDistrict(event.target.value)} />
              </Field>
              <Field id="city" label="Cidade">
                <Input id="city" autoComplete="address-level2" className="h-12" value={city} required onChange={(event) => setCity(event.target.value)} />
              </Field>
              <Field id="state" label="UF">
                <select id="state" className="flex h-12 w-full rounded-md border border-input bg-transparent px-3 text-base" value={state} required onChange={(event) => setState(event.target.value)}>
                  <option value="">Selecione</option>
                  {states.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="representative-name" label="Nome completo do representante legal">
                <Input id="representative-name" autoComplete="name" className="h-12" value={representativeName} required onChange={(event) => setRepresentativeName(event.target.value)} />
              </Field>
              <Field id="representative-email" label="E-mail do representante legal">
                <Input id="representative-email" type="email" autoComplete="email" className="h-12" value={representativeEmail} required onChange={(event) => setRepresentativeEmail(event.target.value)} />
              </Field>
              {contractingFileKinds.map((kind) => (
                <Field key={kind} id={kind} label={contractingFileLabels[kind]}>
                  <input
                    id={kind}
                    type="file"
                    className="block w-full text-sm"
                    required={!files[kind]}
                    onChange={(event) => chooseFile(kind, event.target.files)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{files[kind] ? files[kind]?.name : "PDF, imagem ou outro arquivo de até 15 MB."}</p>
                </Field>
              ))}
            </section>
            <section className="space-y-4">
              <h2 className="text-sm font-bold tracking-wide">TESTEMUNHA</h2>
              <Field id="witness-name" label="Nome completo">
                <Input id="witness-name" autoComplete="name" className="h-12" value={witnessName} required onChange={(event) => setWitnessName(event.target.value)} />
              </Field>
              <Field id="witness-document" label="CPF">
                <Input id="witness-document" inputMode="numeric" autoComplete="off" className="h-12" value={witnessDocument} required onChange={(event) => setWitnessDocument(cpfMask(event.target.value))} />
              </Field>
              <Field id="witness-email" label="E-mail">
                <Input id="witness-email" type="email" autoComplete="email" className="h-12" value={witnessEmail} required onChange={(event) => setWitnessEmail(event.target.value)} />
              </Field>
            </section>
            {lookingUp ? <p className="text-sm text-muted-foreground">{lookingUp === "cep" ? "Consultando o CEP..." : "Consultando o CNPJ..."}</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="h-12 w-full" disabled={pending}>
              {pending ? "Enviando..." : "Enviar contratação"}
            </Button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
