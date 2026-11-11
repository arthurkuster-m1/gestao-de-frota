/**
 * Importação em massa de veículos (colar do Excel/CSV). Funções puras: a tela só as chama.
 * Cada linha vira um resultado com a situação (tom) e, se ok, o veículo pronto para gravar.
 */
import { lerData } from "../eventos/importacao";
import { CICLO, DEPARTAMENTOS, SEGURO, normalizarPlaca, normalizarVin, placaValida, vazioParaNulo, vinValido, type Ciclo, type Seguro, type VeiculoNovo } from "./tipos";

export type CampoDeData = "data_pedido" | "data_liberacao" | "data_chegada_planta" | "data_faturamento" | "data_placas_solicitadas" | "data_emplacamento" | "data_devolucao";
export type CampoLinha = "modelo" | "cor" | "my" | "pedido" | "vin" | "placa" | "blindado" | "seguro" | "ciclo" | "comentarios" | "departamento" | "faturado" | CampoDeData;
export type LinhaCrua = Partial<Record<CampoLinha, string>>;
export type Tom = "ok" | "erro" | "dup" | "ign";
export type ResultadoLinha = { tom: Tom; texto: string; veiculo?: VeiculoNovo };

export const CAMPOS: { id: CampoLinha; titulo: string; largura: number }[] = [
  { id: "modelo", titulo: "Modelo", largura: 130 }, { id: "cor", titulo: "Cor", largura: 110 },
  { id: "my", titulo: "MY", largura: 80 }, { id: "pedido", titulo: "Pedido", largura: 120 }, { id: "vin", titulo: "VIN (chassi)", largura: 190 },
  { id: "departamento", titulo: "Departamento", largura: 140 }, { id: "faturado", titulo: "Faturado", largura: 110 }, { id: "placa", titulo: "Placa", largura: 100 }, { id: "blindado", titulo: "Blindado", largura: 130 }, { id: "seguro", titulo: "Seguro", largura: 150 },
  { id: "ciclo", titulo: "Ciclo de vida", largura: 190 }, { id: "comentarios", titulo: "Comentários", largura: 200 },
  { id: "data_pedido", titulo: "Data do pedido", largura: 150 }, { id: "data_liberacao", titulo: "Data de liberação", largura: 160 }, { id: "data_chegada_planta", titulo: "Chegou na planta em", largura: 170 }, { id: "data_faturamento", titulo: "Data de faturamento", largura: 170 },
  { id: "data_placas_solicitadas", titulo: "Placas solicitadas em", largura: 190 }, { id: "data_emplacamento", titulo: "Data de emplacamento", largura: 180 }, { id: "data_devolucao", titulo: "Data de devolução", largura: 160 },
];
/** As colunas que a tabela mostra de início (o resto se liga em "Colunas"). */
export const CAMPOS_PADRAO: CampoLinha[] = ["modelo", "cor", "my", "pedido", "vin", "placa", "blindado", "seguro", "ciclo", "comentarios"];
const CAMPOS_DE_DATA: CampoDeData[] = ["data_pedido", "data_liberacao", "data_chegada_planta", "data_faturamento", "data_placas_solicitadas", "data_emplacamento", "data_devolucao"];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Nomes de coluna aceitos no cabeçalho colado (sem acento, minúsculas). */
const ALIAS: Record<string, CampoLinha> = {
  modelo: "modelo", cor: "cor", my: "my", "ano modelo": "my", "ano-modelo": "my", pedido: "pedido", "n pedido": "pedido",
  vin: "vin", chassi: "vin", "vin (chassi)": "vin", placa: "placa", blindado: "blindado", seguro: "seguro", faturado: "faturado", departamento: "departamento", depto: "departamento", area: "departamento",
  "data do pedido": "data_pedido", "data pedido": "data_pedido", "data de pedido": "data_pedido",
  "data de liberacao": "data_liberacao", "data liberacao": "data_liberacao", "data da liberacao": "data_liberacao", liberacao: "data_liberacao",
  "chegou na planta": "data_chegada_planta", "chegou na planta em": "data_chegada_planta", "data de chegada na planta": "data_chegada_planta", "chegada na planta": "data_chegada_planta",
  "placas solicitadas": "data_placas_solicitadas", "placas solicitadas em": "data_placas_solicitadas", "data das placas": "data_placas_solicitadas",
  "data de faturamento": "data_faturamento", "data faturamento": "data_faturamento", "data do faturamento": "data_faturamento", faturamento: "data_faturamento",
  "data de emplacamento": "data_emplacamento", "data emplacamento": "data_emplacamento", "data do emplacamento": "data_emplacamento", emplacamento: "data_emplacamento",
  "data de devolucao": "data_devolucao", "data devolucao": "data_devolucao", "data da devolucao": "data_devolucao", devolucao: "data_devolucao",
  ciclo: "ciclo", "ciclo de vida": "ciclo", status: "ciclo", "status do ciclo de vida": "ciclo", comentarios: "comentarios", comentario: "comentarios", obs: "comentarios",
};

/**
 * Matriz colada → linhas. Se a 1ª linha parece cabeçalho (reconhece ≥2 nomes de coluna), usa-o; senão assume a ordem das colunas
 * que estão na tabela (`ordemPadrao`). Devolve também quais colunas vieram no cabeçalho (para a tela ligar as que estavam escondidas).
 */
export function analisarMatriz(matriz: string[][], ordemPadrao: readonly CampoLinha[] = CAMPOS_PADRAO): { linhas: LinhaCrua[]; campos: CampoLinha[] } {
  const dados = matriz.filter((l) => l.some((c) => (c ?? "").trim() !== ""));
  if (dados.length === 0) return { linhas: [], campos: [] };
  // Se a planilha trouxer uma coluna "Versão", ela é juntada ao modelo ("Onix" + "RS" → "Onix RS"): o app tem um campo só.
  const colVersao = dados[0].findIndex((c) => semAcento(c ?? "") === "versao");
  const mapa = dados[0].map((c) => ALIAS[semAcento(c ?? "")]);
  const ehCabecalho = mapa.filter(Boolean).length >= 2;
  const ordem: (CampoLinha | undefined)[] = ehCabecalho ? mapa : [...ordemPadrao];
  const linhas = (ehCabecalho ? dados.slice(1) : dados).map((l) => {
    const o: LinhaCrua = {};
    l.forEach((c, i) => { const campo = ordem[i]; if (campo && (c ?? "").trim() !== "") o[campo] = c.trim(); });
    if (ehCabecalho && colVersao >= 0 && (l[colVersao] ?? "").trim() && o.modelo) o.modelo = `${o.modelo} ${l[colVersao].trim()}`;
    return o;
  });
  return { linhas, campos: [...new Set(ordem.filter((c): c is CampoLinha => !!c))] };
}
export const linhasDeMatriz = (matriz: string[][], ordemPadrao: readonly CampoLinha[] = CAMPOS_PADRAO): LinhaCrua[] => analisarMatriz(matriz, ordemPadrao).linhas;

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

/** `pedidos`: números de pedido já usados (minúsculos); só identificam o carro quando a linha não tem nem VIN nem placa. */
export type Existentes = { vins: Set<string>; placas: Set<string>; pedidos?: Set<string> };
export const chaveDoPedido = (p: string | null | undefined) => (p ?? "").trim().toLowerCase();

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
  const fat = parseBlindado(l.faturado);
  if (fat === "x") return { tom: "erro", texto: `Faturado: use Sim ou Não (veio "${l.faturado}")` };
  const seguro = achar(SEGURO, l.seguro);
  if (seguro === "x") return { tom: "erro", texto: `Seguro desconhecido: "${l.seguro}" (Pendente, Cadastrado ou Cancelado)` };
  const deptoDigitado = vazioParaNulo(l.departamento);
  const departamento = deptoDigitado ? (DEPARTAMENTOS.find((d) => semAcento(d) === semAcento(deptoDigitado)) ?? deptoDigitado.trim()) : null;   // vazio: Marketing (o banco preenche)
  if (departamento && departamento.length > 60) return { tom: "erro", texto: "Departamento: no máximo 60 caracteres" };
  const ciclo = achar(CICLO, l.ciclo);
  if (ciclo === "x") return { tom: "erro", texto: `Ciclo de vida desconhecido: "${l.ciclo}"` };
  const datas: Partial<Record<CampoDeData, string>> = {};
  for (const c of CAMPOS_DE_DATA) {
    const d = lerData(l[c]);
    if (d === "x") return { tom: "erro", texto: `${CAMPOS.find((x) => x.id === c)!.titulo} inválida (use dd/mm/aaaa): "${l[c]}"` };
    if (d) datas[c] = d;
  }

  if ((vin && ex.vins.has(vin)) || (placa && ex.placas.has(placa))) return { tom: "dup", texto: "Já cadastrado (VIN ou placa): será ignorada" };
  // sem VIN nem placa, o carro é reconhecido pelo número do pedido
  const pedido = !vin && !placa ? chaveDoPedido(l.pedido) : "";
  if (pedido && ex.pedidos?.has(pedido)) return { tom: "dup", texto: "Já cadastrado (número do pedido): será ignorada" };
  if (pedido && vistas.pedidos?.has(pedido)) return { tom: "dup", texto: "Pedido repetido nesta tabela: será ignorada" };
  if ((vin && vistas.vins.has(vin)) || (placa && vistas.placas.has(placa))) return { tom: "erro", texto: "VIN ou placa repetidos nesta tabela" };
  if (pedido) vistas.pedidos?.add(pedido);
  if (vin) vistas.vins.add(vin);
  if (placa) vistas.placas.add(placa);

  const veiculo: VeiculoNovo = {
    modelo, cor: vazioParaNulo(l.cor), my: vazioParaNulo(l.my), pedido: vazioParaNulo(l.pedido),
    vin, placa, blindado: blind === null ? false : blind,
    seguro_status: (seguro ?? "pendente") as Seguro, status_ciclo: (ciclo ?? "pedido_recebido") as Ciclo, comentarios: vazioParaNulo(l.comentarios), ...(departamento ? { departamento } : {}), ...(fat === true ? { faturado: true } : {}), ...datas,
  };
  return { tom: "ok", texto: "Pronta para cadastrar", veiculo };
}

export function validarTudo(linhas: LinhaCrua[], ex: Existentes): ResultadoLinha[] {
  const vistas: Existentes = { vins: new Set(), placas: new Set(), pedidos: new Set() };
  return linhas.map((l) => validarLinha(l, ex, vistas));
}
