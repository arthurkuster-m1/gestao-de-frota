import { useEffect, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Button, Combobox, Field, Sheet, useToast } from "../../ds";
import { baixarArquivo, gerarContratoDocx, nomeDoArquivoDoContrato, type SnapshotDoContrato } from "../../lib/contratos/documentos";
import { vigenciaDoEvento } from "../../lib/contratos/montar";
import type { Contrato } from "../../lib/contratos/tipos";
import { formatarDiaBr } from "../../lib/motor/datas";
import type { Evento, EventoLocal, Reserva } from "../../lib/eventos/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";
import { NovoClienteRapido } from "../eventos/NovoClienteRapido";
import type { useContratos } from "./useContratos";

/**
 * Gera o contrato do evento: o cliente é o do evento (sem cliente, pede para escolher ou criar, e isso já atualiza o evento), a vigência
 * engloba as datas do evento, os carros são os reservados, e o DOCX sai pronto do modelo das Configurações.
 */
export function GerarContrato({ aberto, onFechar, evento, clientes, reservas, veiculos, locais, k, onEscolherCliente, onGerado }: {
  aberto: boolean; onFechar: () => void; evento: Evento; clientes: { id: string; nome: string }[]; reservas: Reserva[]; veiculos: Veiculo[]; locais: EventoLocal[];
  k: ReturnType<typeof useContratos>; onEscolherCliente: (clienteId: string) => Promise<void>; onGerado?: (c: Contrato) => void;
}) {
  const toast = useToast();
  const [cliente, setCliente] = useState("");
  const [novoCliente, setNovoCliente] = useState(false);
  const [criados, setCriados] = useState<{ id: string; nome: string }[]>([]);
  const todos = [...clientes, ...criados.filter((c) => !clientes.some((x) => x.id === c.id))];
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  useEffect(() => { if (aberto) { setCliente(evento.cliente_id ?? ""); setFalha(null); } }, [aberto, evento.cliente_id]);
  const doEvento = reservas.filter((r) => r.evento_id === evento.id && r.estado !== "cancelado");
  const vig = vigenciaDoEvento(evento, doEvento);
  const nomeDe = (id: string) => todos.find((c) => c.id === id)?.nome ?? "?";
  const carros = [...new Set(doEvento.map((r) => r.veiculo_id))].map((id) => veiculos.find((v) => v.id === id)).filter((v): v is Veiculo => !!v);

  async function gerar() {
    setFalha(null); setEnviando(true);
    try {
      if (cliente !== (evento.cliente_id ?? "")) await onEscolherCliente(cliente);   // contrato e evento ficam com o MESMO cliente
      const c = await k.criarDoEvento({ evento: { ...evento, cliente_id: cliente }, clienteId: cliente, reservas: doEvento, veiculos: new Map(veiculos.map((v) => [v.id, v])), locais });
      baixarArquivo(await gerarContratoDocx(c.snapshot as unknown as SnapshotDoContrato), nomeDoArquivoDoContrato(evento.nome));
      toast("Contrato gerado: o DOCX foi baixado");
      onFechar(); onGerado?.(c);
    } catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }
  return (
    <>
      <Sheet open={aberto} onClose={onFechar} title="Gerar contrato">
        <div className="ds-stack" data-testid="form-contrato">
          <p className="t-body-sm t-muted">O contrato nasce deste evento: <b>{evento.nome}</b>. O documento é gerado pelo modelo das Configurações e baixado na hora.</p>
          <Field label={evento.cliente_id ? "Cliente do evento" : "Este evento ainda não tem cliente: escolha ou crie"} error={falha}>
            <Combobox value={cliente} onChange={(e) => setCliente(e.target.value)} opcoes={todos.map((c) => ({ value: c.id, label: c.nome }))} placeholder="Buscar cliente…" aria-label="Cliente do contrato" />
          </Field>
          <div><Button variant="secondary" size="sm" icon={<Plus size={16} />} onClick={() => setNovoCliente(true)}>Novo cliente</Button></div>
          <ul className="t-body-sm" style={{ paddingLeft: 18, display: "grid", gap: 4 }}>
            <li>Vigência: {vig.inicio ? <b>{formatarDiaBr(vig.inicio)} {vig.fim ? `a ${formatarDiaBr(vig.fim)}` : "em diante (sem data final)"}</b> : <span className="t-muted">defina a data de chegada do evento</span>}</li>
            <li>Carros: <b>{carros.length}</b>{carros.length ? ` · ${carros.map((v) => v.codigo ?? v.modelo).join(", ")}` : <span className="t-muted"> (reserve os carros na aba Veículos)</span>}</li>
          </ul>
          {cliente && cliente !== evento.cliente_id && <p className="t-body-sm t-muted">O cliente do evento vai passar a ser <b>{nomeDe(cliente)}</b>.</p>}
          <Button size="lg" block disabled={!cliente || !vig.inicio} loading={enviando} onClick={() => void gerar()} data-testid="criar-contrato">Gerar contrato e baixar DOCX</Button>
        </div>
      </Sheet>
      <NovoClienteRapido aberto={novoCliente} onFechar={() => setNovoCliente(false)} onCriado={(c) => { setCriados((l) => [...l, c]); setCliente(c.id); setNovoCliente(false); }} />
    </>
  );
}
