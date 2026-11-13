import { useEffect, useState } from "react";
import { Bell } from "@phosphor-icons/react";
import { Card, useToast } from "../../ds";
import { LinkNoLugar } from "../../app/noLugar";
import { hojeLocal } from "../../lib/motor/datas";
import { useVersaoDosDados } from "../../lib/sincronia";
import { avisoDoCicloAutomatico } from "../../lib/veiculos/ciclo";
import { atualizarCampos, listarVeiculos } from "../../lib/veiculos/dados";
import { patchDeAdiamento, patchDeConfirmacao, previsoesQueChegaram } from "../../lib/veiculos/previsoes";
import type { Veiculo } from "../../lib/veiculos/tipos";
import { PrevisoesQueChegaram } from "../veiculos/PrevisoesQueChegaram";

/** Início: os carros cuja data PREVISTA (liberação, faturamento, emplacamento) chegou, para confirmar se realmente aconteceu ou mudar a data. Some quando não há nenhum. */
export function PrevisoesDoInicio() {
  const toast = useToast();
  const versao = useVersaoDosDados();
  const hoje = hojeLocal();
  const [lista, setLista] = useState<Veiculo[]>([]);
  useEffect(() => { listarVeiculos().then(setLista, () => setLista([])); }, [versao]);
  const trocar = (novo: Veiculo) => setLista((l) => l.map((x) => (x.id === novo.id ? novo : x)));
  const comAviso = lista.filter((v) => previsoesQueChegaram(v, hoje).length > 0);
  if (comAviso.length === 0) return null;
  return (
    <Card>
      <h2 className="t-h3" style={{ marginBottom: 12 }}><Bell size={20} style={{ verticalAlign: "-4px" }} /> Previsões que chegaram</h2>
      <div className="ds-stack" data-testid="previsoes-do-inicio">
        {comAviso.map((v) => (
          <div key={v.id} className="ds-stack" style={{ gap: 6 }}>
            <LinkNoLugar to={`/veiculos/${v.id}`} className="mt-reserva__evento">{v.codigo ?? v.modelo.toUpperCase()}</LinkNoLugar>
            <PrevisoesQueChegaram veiculo={v} hoje={hoje}
              aoConfirmar={async (m) => { try { const novo = await atualizarCampos(v.id, patchDeConfirmacao(v, m) as Partial<Veiculo>); trocar(novo); toast(avisoDoCicloAutomatico(v, novo, m.real) ?? `Confirmado: ${m.rotulo} em ${novo[m.real]?.split("-").reverse().join("/")}`); } catch (e) { toast((e as Error).message); } }}
              aoAdiar={async (m, nova) => { try { trocar(await atualizarCampos(v.id, patchDeAdiamento(m, nova) as Partial<Veiculo>)); toast(`Previsão de ${m.rotulo} mudou para ${nova.split("-").reverse().join("/")}`); } catch (e) { toast((e as Error).message); } }} />
          </div>
        ))}
      </div>
    </Card>
  );
}
