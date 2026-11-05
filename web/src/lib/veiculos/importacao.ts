/**
 * Importação em massa de veículos (colar do Excel/CSV). Funções puras: a tela só as chama.
 * Cada linha vira um resultado com a situação (tom) e, se ok, o veículo pronto para gravar.
 */
import { CICLO, SEGURO, normalizarPlaca, normalizarVin, placaValida, vazioParaNulo, vinValido, type Ciclo, type Seguro, type VeiculoNovo } from "./tipos";

export type CampoLinha = "modelo" | "versao" | "cor" | "my" | "pedido" | "vin" | "placa" | "blindado" | "seguro" | "ciclo" | "comentarios";
export type LinhaCrua = Partial<Record<CampoLinha, string>>;
export type Tom = "ok" | "erro" | "dup" | "ign";
export type ResultadoLinha = { tom: Tom; texto: string; veiculo?: VeiculoNovo };

export const CAMPOS: { id: CampoLinha; titulo: string; largura: number }[] = [
  { id: "modelo", titulo: "Modelo", largura: 130 }, { id: "versao", titulo: "Versão", largura: 110 }, { id: "cor", titulo: "Cor", largura: 110 },
  { id: "my", titulo: "MY", largura: 80 }, { id: "pedido", titulo: "Pedido", largura: 120 }, { id: "vin", titulo: "VIN (chassi)", largura: 190 },
  { id: "placa", titulo: "Placa", largura: 100 }, { id: "blindado", titulo: "Blindado", largura: 100 }, { id: "seguro", titulo: "Seguro", largura: 120 },
  { id: "ciclo", titulo: "Ciclo de vida", largura: 190 }, { id: "comentarios", titulo: "Comentários", largura: 200 },
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Nomes de coluna aceitos no cabeçalho colado (sem acento, minúsculas). */
const ALIAS: Record<string, CampoLinha> = {
  modelo: "modelo", versao: "versao", cor: "cor", my: "my", "ano modelo": "my", "ano-modelo": "my", pedido: "pedido", "n pedido": "pedido",
  vin: "vin", chassi: "vin", "vin (chassi)": "vin", placa: "placa", blindado: "blindado", seguro: "seguro",
  ciclo: "ciclo", "ciclo de vida": "ciclo", status: "ciclo", "status do ciclo de vida": "ciclo", comentarios: "comentarios", comentario: "comentarios", obs: "comentarios",
};

/** Matriz colada → linhas. Se a 1ª linha parece cabeçalho (reconhece ≥2 nomes de coluna), usa-o; senão assume a ordem de CAMPOS. */
export function linhasDeMatriz(matriz: string[][]): LinhaCrua[] {
  const dados = matriz.filter((l) => l.some((c) => (c ?? "").trim() !== ""));
  if (dados.length === 0) return [];
  const mapa = dados[0].map((c) => ALIAS[semAcento(c ?? "")]);
  const ehCabecalho = mapa.filter(Boolean).length >= 2;
  const ordem: (CampoLinha | undefined)[] = ehCabecalho ? mapa : CAMPOS.map((c) => c.id);
  return (ehCabecalho ? dados.slice(1) : dados).map((l) => {
    const o: LinhaCrua = {};
    l.forEach((c, i) => { const campo = ordem[i]; if (campo && (c ?? "").trim() !== "") o[campo] = c.trim(); });
    return o;
  });
}

export const linhaVazia = (l: LinhaCrua) => CAMPOS.every((c) => !(l[c.id] ?? "").trim());

function parseBlindado(s: string | undefined): boolean | null | "x" {
  const t = semAcento(s ?? "");
  if (!t) return null;
  if (["sim", "s", "true", "1", "x", "blindado"].includes(t)) return true;
  if (["nao", "n", "false", "0", "nao blindado"].includes(t)) return false;
  return "x";
}
const achar = <T extends { value: string; label: string }>(lista: readonly T[], s: string | undefined): T["value"] | null | "x" => {
  const t = semAcento(s ?? "");
  if (!t) return null;
  return lista.find((o) => semAcento(o.value) === t || semAcento(o.label) === t || semAcento(o.value.replace(/_/g, " ")) === t)?.value ?? "x";
};

export type Existentes = { vins: Set<string>; placas: Set<string> };

/** Valida uma linha. `vistas` acumula VINs/placas já usados nesta mesma importação (duplicado dentro da tabela é erro). */
export function validarLinha(l: LinhaCrua, ex: Existentes, vistas: Existentes): ResultadoLinha {
  if (linhaVazia(l)) return { tom: "ign", texto: "Linha vazia" };
  const modelo = vazioParaNulo(l.modelo);
  if (!modelo) return { tom: "erro", texto: "Falta o modelo" };
  const vin = vazioParaNulo(l.vin) ? normalizarVin(l.vin!) : null;
  const placa = vazioParaNulo(l.placa) ? normalizarPlaca(l.placa!) : null;
  if (vin && !vinValido(vin)) return { tom: "erro", texto: `VIN inválido (17 letras e números): ${vin}` };
  if (placa && !placaValida(placa)) return { tom: "erro", texto: `Placa inválida (7 caracteres): ${placa}` };
  const blind = parseBlindado(l.blindado);
  if (blind === "x") return { tom: "erro", texto: `Blindado: use Sim ou Não (veio "${l.blindado}")` };
  const seguro = achar(SEGURO, l.seguro);
  if (seguro === "x") return { tom: "erro", texto: `Seguro desconhecido: "${l.seguro}" (Pendente, Cadastrado ou Cancelado)` };
  const ciclo = achar(CICLO, l.ciclo);
  if (ciclo === "x") return { tom: "erro", texto: `Ciclo de vida desconhecido: "${l.ciclo}"` };

  if ((vin && ex.vins.has(vin)) || (placa && ex.placas.has(placa))) return { tom: "dup", texto: "Já cadastrado (VIN ou placa): será ignorada" };
  if ((vin && vistas.vins.has(vin)) || (placa && vistas.placas.has(placa))) return { tom: "erro", texto: "VIN ou placa repetidos nesta tabela" };
  if (vin) vistas.vins.add(vin);
  if (placa) vistas.placas.add(placa);

  const veiculo: VeiculoNovo = {
    modelo, versao: vazioParaNulo(l.versao), cor: vazioParaNulo(l.cor), my: vazioParaNulo(l.my), pedido: vazioParaNulo(l.pedido),
    vin, placa, blindado: blind === null ? false : blind,
    seguro_status: (seguro ?? "pendente") as Seguro, status_ciclo: (ciclo ?? "pedido_recebido") as Ciclo, comentarios: vazioParaNulo(l.comentarios),
  };
  return { tom: "ok", texto: "Pronta para cadastrar", veiculo };
}

export function validarTudo(linhas: LinhaCrua[], ex: Existentes): ResultadoLinha[] {
  const vistas: Existentes = { vins: new Set(), placas: new Set() };
  return linhas.map((l) => validarLinha(l, ex, vistas));
}
