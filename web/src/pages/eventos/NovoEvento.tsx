import { useState } from "react";
import { Button, DateField, Field, Input, Select, Sheet } from "../../ds";
import { TIPOS_EVENTO, type Evento, type EventoLocalNovo } from "../../lib/eventos/tipos";
import { CampoDeEndereco } from "../../components/motor/EditorDeEndereco";
import { ModelosDesejadosForm, type PedidoDeCarro } from "./ModelosDesejadosForm";

type Dados = { nome: string; tipo: string | null; solicitante: string | null; chegada_prevista: string | null; retirada_prevista: string | null; contato: string | null };
const VAZIO = { nome: "", chegada: "", retirada: "", tipo: "", solicitante: "", endereco: "", local: "", contato: "" };

/**
 * O formulário de novo evento, em página larga. Cadastro rápido: Ctrl + Enter salva na hora só com o que foi preenchido
 * (sem título, o nome vira "EVENTO DIA 05/11 - RESPONSÁVEL") e o resto se completa depois.
 */
export function NovoEvento({ aberto, onFechar, onCriar, onCriado }: {
  aberto: boolean; onFechar: () => void;
  onCriar: (e: Dados, locais: EventoLocalNovo[], pedidos: PedidoDeCarro[]) => Promise<Evento>; onCriado: (e: Evento) => void;
}) {
  const [f, setF] = useState(VAZIO);
  const [pedidos, setPedidos] = useState<PedidoDeCarro[]>([]);
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const set = (p: Partial<typeof VAZIO>) => setF((x) => ({ ...x, ...p }));
  const pedidosPreenchidos = pedidos.filter((p) => p.modelo.trim());
  const algumaCoisa = Object.values(f).some((v) => v.trim()) || pedidosPreenchidos.length > 0;
  const periodoRuim = !!f.chegada && !!f.retirada && f.retirada < f.chegada;

  async function criar() {
    if (!algumaCoisa || periodoRuim || enviando) return;
    setFalha(null); setEnviando(true);
    try {
      const e = await onCriar(
        { nome: f.nome, tipo: f.tipo || null, solicitante: f.solicitante.trim() || null, chegada_prevista: f.chegada || null, retirada_prevista: f.retirada || null, contato: f.contato.trim() || null },
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
        <div className="mt-evf mt-evf--4">
          <Field label="Tipo"><Select value={f.tipo} onChange={(e) => set({ tipo: e.target.value })} placeholder="Escolher…"><option value="">Sem tipo</option>{TIPOS_EVENTO.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
          <Field label="Solicitante"><Input value={f.solicitante} onChange={(e) => set({ solicitante: e.target.value })} /></Field>
          <div className="ds-stack" style={{ gap: 8 }}>
            <Field label="Nome do local"><Input value={f.local} onChange={(e) => set({ local: e.target.value })} placeholder="Ex.: Pavilhão de Exposições" maxLength={80} /></Field>
            <Field label="Endereço completo"><CampoDeEndereco valor={f.endereco} onChange={(v) => set({ endereco: v })} titulo="Endereço do evento" /></Field>
          </div>
          <Field label="Contato"><Input value={f.contato} onChange={(e) => set({ contato: e.target.value })} placeholder="Responsável no local (nome, telefone)" /></Field>
        </div>
        <ModelosDesejadosForm pedidos={pedidos} onChange={setPedidos} />
        <div className="mt-evf__rodape">
          <span className="t-body-sm t-muted"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> salva já com o que você preencheu (sem título, o nome vira “EVENTO DIA … - RESPONSÁVEL”). O resto você completa depois.</span>
          <Button type="submit" size="lg" disabled={!algumaCoisa || periodoRuim} loading={enviando} data-testid="criar-evento">Criar evento</Button>
        </div>
      </form>
    </Sheet>
  );
}
