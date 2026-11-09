import { useState } from "react";
import { ArrowUUpLeft, CheckCircle, IdentificationCard, Receipt } from "@phosphor-icons/react";
import { Button, DateField, Field, Input, Sheet, useToast } from "../../ds";
import { hojeLocal } from "../../lib/motor/datas";
import { atualizarCampos } from "../../lib/veiculos/dados";
import { ROTULO_DO_REGISTRO, planoDoRegistro, type TipoDeRegistro } from "../../lib/veiculos/registros";
import { normalizarPlaca, placaValida, type Veiculo } from "../../lib/veiculos/tipos";

const ICONE: Record<TipoDeRegistro, React.ReactNode> = { liberacao: <CheckCircle size={18} />, faturamento: <Receipt size={18} />, emplacamento: <IdentificationCard size={18} />, devolucao: <ArrowUUpLeft size={18} /> };
const ORDEM: TipoDeRegistro[] = ["liberacao", "faturamento", "emplacamento", "devolucao"];
const JA: Record<TipoDeRegistro, keyof Veiculo> = { liberacao: "data_liberacao", faturamento: "data_faturamento", emplacamento: "data_emplacamento", devolucao: "data_devolucao" };

/**
 * Botões de automação do histórico: um clique registra o marco e muda tudo que precisa no cadastro (data, ciclo de vida e, no emplacamento, a placa).
 * Confere antes de gravar (mostra o que vai mudar) e o histórico do carro registra o que mudou.
 */
export function RegistrarAcoes({ veiculo }: { veiculo: Veiculo }) {
  const toast = useToast();
  const [tipo, setTipo] = useState<TipoDeRegistro | null>(null);
  const [data, setData] = useState(hojeLocal());
  const [placa, setPlaca] = useState("");
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const abrir = (t: TipoDeRegistro) => { setTipo(t); setData(hojeLocal()); setPlaca(veiculo.placa ?? ""); setFalha(null); };
  const placaNorm = normalizarPlaca(placa);
  const erroDaPlaca = tipo === "emplacamento" ? (!placaNorm ? "Informe a placa." : !placaValida(placaNorm) ? `A placa tem 7 caracteres (digitou ${placaNorm.length}).` : null) : null;
  const plano = tipo ? planoDoRegistro(tipo, veiculo, { data, placa: tipo === "emplacamento" ? placaNorm : undefined }) : null;

  async function confirmar() {
    if (!tipo || !plano || erroDaPlaca || !data) return;
    setEnviando(true); setFalha(null);
    try { await atualizarCampos(veiculo.id, plano.patch); toast(`${ROTULO_DO_REGISTRO[tipo].replace("Registrar ", "")} registrado(a)`); setTipo(null); }
    catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }

  return (
    <>
      <div className="mt-registrar" role="group" aria-label="Registrar ações do veículo" data-testid="registrar-acoes">
        {ORDEM.map((t) => <Button key={t} variant="secondary" size="sm" icon={ICONE[t]} onClick={() => abrir(t)} data-testid={`registrar-${t}`}>{ROTULO_DO_REGISTRO[t]}</Button>)}
      </div>
      <Sheet open={!!tipo} onClose={() => setTipo(null)} title={tipo ? ROTULO_DO_REGISTRO[tipo] : ""}>
        {tipo && plano && (
          <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void confirmar(); }} data-testid="form-registrar">
            {veiculo[JA[tipo]] && <p className="t-body-sm" role="note" style={{ color: "var(--color-warning-fg)" }}>Este carro já tem essa data ({String(veiculo[JA[tipo]]).split("-").reverse().join("/")}). Registrar de novo troca a data.</p>}
            <Field label="Data"><DateField value={data} onChange={(e) => setData(e.target.value)} /></Field>
            {tipo === "emplacamento" && <Field label="Placa" error={placa ? erroDaPlaca : null}><Input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="ABC1D23" autoCapitalize="characters" spellCheck={false} maxLength={8} autoFocus aria-label="Placa" /></Field>}
            <div className="mt-registrar__resumo" data-testid="resumo-registro"><span className="t-body-sm t-muted">O que vai mudar neste carro</span><ul>{plano.resumo.map((r) => <li key={r}>{r}</li>)}</ul></div>
            {falha && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{falha}</p>}
            <Button type="submit" size="lg" block loading={enviando} disabled={!data || !!erroDaPlaca} data-testid="confirmar-registro">Confirmar</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}
