import { useMemo, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Input, cx } from "../../ds";
import { normalizarPlaca, normalizarVin, type Veiculo } from "../../lib/veiculos/tipos";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Os veículos que combinam com o que foi digitado (placa, código, VIN ou modelo), os de placa/código mais certeiros primeiro. */
export function buscarVeiculos(veiculos: readonly Veiculo[], texto: string, limite = 8): Veiculo[] {
  const t = texto.trim(); if (!t) return [];
  const placa = normalizarPlaca(t), vin = normalizarVin(t), q = semAcento(t);
  const pontos = (v: Veiculo): number => {
    if (placa.length >= 3 && v.placa === placa) return 0;
    if (placa.length >= 2 && v.placa?.startsWith(placa)) return 1;
    if (vin.length >= 4 && v.vin && (v.vin === vin || v.vin.endsWith(vin))) return 1;
    if ((v.codigo ?? "").toLowerCase().includes(t.toLowerCase())) return 2;
    if (placa.length >= 3 && v.placa?.includes(placa)) return 2;
    if (semAcento(`${v.modelo} ${v.cor ?? ""} ${v.my ?? ""}`).includes(q)) return 3;
    return 9;
  };
  return veiculos.map((v) => ({ v, p: pontos(v) })).filter((x) => x.p < 9).sort((a, b) => a.p - b.p || (a.v.codigo ?? "").localeCompare(b.v.codigo ?? "", "pt-BR", { numeric: true })).slice(0, limite).map((x) => x.v);
}

/**
 * Busca de carro como numa pesquisa: ao digitar a placa (ou código/VIN), mostra as opções com modelo, cor e MY para conferir.
 * Setas escolhem, Enter confirma (o primeiro já vem marcado).
 */
export function BuscaDeVeiculo({ veiculos, onEscolher }: { veiculos: readonly Veiculo[]; onEscolher: (v: Veiculo) => void }) {
  const [texto, setTexto] = useState("");
  const [marcado, setMarcado] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const achados = useMemo(() => buscarVeiculos(veiculos, texto), [veiculos, texto]);
  const escolher = (v: Veiculo) => { setTexto(""); setMarcado(0); onEscolher(v); };
  return (
    <div className="mt-busca-carro" data-testid="busca-de-veiculo">
      <div className="mt-busca-carro__campo">
        <MagnifyingGlass size={20} aria-hidden />
        <Input ref={campo} value={texto} autoFocus autoCapitalize="characters" spellCheck={false} placeholder="Digite a placa (ou código, VIN)…" aria-label="Buscar o carro" role="combobox" aria-expanded={achados.length > 0} aria-controls="opcoes-de-carro"
          onChange={(e) => { setTexto(e.target.value.toUpperCase()); setMarcado(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setMarcado((m) => Math.min(m + 1, achados.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setMarcado((m) => Math.max(m - 1, 0)); }
            else if (e.key === "Enter" && achados[marcado]) { e.preventDefault(); escolher(achados[marcado]!); }
          }} />
      </div>
      {texto.trim() && achados.length === 0 && <p className="t-body-sm t-muted" role="status" data-testid="sem-carro">Nenhum carro com “{texto.trim()}”.</p>}
      {achados.length > 0 && (
        <ul id="opcoes-de-carro" className="mt-busca-carro__lista" role="listbox" aria-label="Carros encontrados">
          {achados.map((v, i) => (
            <li key={v.id} role="option" aria-selected={i === marcado}>
              <button type="button" className={cx("mt-busca-carro__item", i === marcado && "is-on")} onMouseEnter={() => setMarcado(i)} onClick={() => escolher(v)} data-testid="carro-encontrado">
                <b>{v.placa ?? "sem placa"}</b><span>{v.codigo ?? v.modelo.toUpperCase()}</span><span className="t-muted">{[v.modelo, v.cor, v.my].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
