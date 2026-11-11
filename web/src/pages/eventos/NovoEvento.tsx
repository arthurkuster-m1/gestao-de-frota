import { useEffect, useState } from "react";
import { Button, DateField, Field, Input, Select, Sheet } from "../../ds";
import { useTiposDeEvento } from "../../lib/eventos/tiposDeEvento";
import { type Evento, type EventoLocalNovo } from "../../lib/eventos/tipos";
import { CampoDeEndereco } from "../../components/motor/EditorDeEndereco";
import { listarClientes, type ClienteResumo } from "../../lib/clientes/dados";
import { NovoClienteRapido } from "./NovoClienteRapido";
import { ModelosDesejadosForm, type PedidoDeCarro } from "./ModelosDesejadosForm";

type Dados = { nome: string; tipo: string | null; solicitante: string | null; chegada_prevista: string | null; retirada_prevista: string | null; contato: string | null; cliente_id: string | null };
const NOVO_CLIENTE = "__novo__";
const VAZIO = { cliente: "", nome: "", chegada: "", retirada: "", tipo: "", solicitante: "", endereco: "", local: "", contato: "" };

/**
 * O formulário de novo evento, em página larga. Cadastro rápido: Ctrl + Enter salva na hora só com o que foi preenchido
 * (sem título, o nome vira "EVENTO DIA 05/11 - RESPONSÁVEL") e o resto se completa depois.
 */
export function NovoEvento({ aberto, onFechar, onCriar, onCriado }: {
  aberto: boolean; onFechar: () => void;
  onCriar: (e: Dados, locais: EventoLocalNovo[], pedidos: PedidoDeCarro[]) => Promise<Evento>; onCriado: (e: Evento) => void;
}) {
  const { tipos: tiposDeEvento } = useTiposDeEvento();
  const [f, setF] = useState(VAZIO);
  const [pedidos, setPedidos] = useState<PedidoDeCarro[]>([]);
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false);
  useEffect(() => { if (aberto) listarClientes().then(setClientes, () => setClientes([])); }, [aberto]);
  const set = (p: Partial<typeof VAZIO>) => setF((x) => ({ ...x, ...p }));
  const pedidosPreenchidos = pedidos.filter((p) => p.modelo.trim());
  const algumaCoisa = Object.values(f).some((v) => v.trim()) || pedidosPreenchidos.length > 0;
  const periodoRuim = !!f.chegada && !!f.retirada && f.retirada < f.chegada;

  async function criar() {
    if (!algumaCoisa || periodoRuim || enviando) return;
    setFalha(null); setEnviando(true);
    try {
      const e = await onCriar(
        { nome: f.nome, tipo: f.tipo || null, solicitante: f.solicitante.trim() || null, chegada_prevista: f.chegada || null, retirada_prevista: f.retirada || null, contato: f.contato.trim() || null, cliente_id: f.cliente || null },
        f.endereco.trim() || f.local.trim() ? [{ rotulo: f.local.trim() || null, endereco: f.endereco.trim() || "Endereço a informar" }] : [], pedidosPreenchidos);
      setF(VAZIO); setPedidos([]); onFechar(); onCriado(e);
    } catch (x) { setFalha((x as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title="Novo evento" wide>
      <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void criar(); }} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void criar(); } }} data-testid="form-novo-evento">
        <div className="mt-evf mt-evf--3">
          <Field label="Título" error={falha}><Input value={f.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Convenção Tesouraria" maxLength={120} autoFocus /></Field>
          <Field label="Data de chegada"><DateField value={f.chegada} onChange={(e) => set({ chegada: e.target.value })} /></Field>
          <Field label="Data de retirada" error={periodoRuim ? "A retirada não pode ser antes da chegada." : null}><DateField value={f.retirada} onChange={(e) => set({ retirada: e.target.value })} /></Field>
        </div>
        <div className="mt-evf mt-evf--iguais3">
          <Field label="Tipo"><Select value={f.tipo} onChange={(e) => set({ tipo: e.target.value })} placeholder="Escolher…"><option value="">Sem tipo</option>{tiposDeEvento.map((t) => <option key={t.nome} value={t.nome}>{t.nome}</option>)}</Select></Field>
          <Field label="Solicitante"><Input value={f.solicitante} onChange={(e) => set({ solicitante: e.target.value })} /></Field>
          <Field label="Contato"><Input value={f.contato} onChange={(e) => set({ contato: e.target.value })} placeholder="Responsável no local (nome, telefone)" /></Field>
        </div>
        <Field label="Cliente">
          <Select value={f.cliente} onChange={(e) => { if (e.target.value === NOVO_CLIENTE) setCadastrandoCliente(true); else set({ cliente: e.target.value }); }} placeholder="Escolher cliente…">
            <option value="">Sem cliente</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            <option value={NOVO_CLIENTE}>+ Cadastrar novo cliente…</option>
          </Select>
        </Field>
        <div className="mt-evf mt-evf--2">
          <Field label="Nome do local"><Input value={f.local} onChange={(e) => set({ local: e.target.value })} placeholder="Ex.: Pavilhão de Exposições" maxLength={80} /></Field>
          <Field label="Endereço completo"><CampoDeEndereco valor={f.endereco} onChange={(v) => set({ endereco: v })} titulo="Endereço do evento" /></Field>
        </div>
        <ModelosDesejadosForm pedidos={pedidos} onChange={setPedidos} />
        <div className="mt-evf__rodape">
          <span className="t-body-sm t-muted"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> salva já com o que você preencheu (sem título, o nome vira “EVENTO DIA … - RESPONSÁVEL”). O resto você completa depois.</span>
          <Button type="submit" size="lg" disabled={!algumaCoisa || periodoRuim} loading={enviando} data-testid="criar-evento">Criar evento</Button>
        </div>
      </form>
      <NovoClienteRapido aberto={cadastrandoCliente} onFechar={() => setCadastrandoCliente(false)}
        onCriado={(c) => { setClientes((l) => [...l, { id: c.id, nome: c.nome, tipo_pessoa: "juridica" as const, cidade: null, estado: null, created_at: "" }].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))); set({ cliente: c.id }); setCadastrandoCliente(false); }} />
    </Sheet>
  );
}
