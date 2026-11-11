/**
 * Importação em massa de eventos (colar do Excel/CSV), inclusive eventos históricos. Funções puras: a tela só as chama.
 * Cada linha vira um resultado com a situação (tom) e, se ok, o evento pronto. Os carros vão numa célula só (separados por ; , ou quebra de linha)
 * ou em várias linhas com o MESMO título (os carros se somam num evento só).
 */
import { enderecoValido, MENSAGEM_DO_ENDERECO } from "../enderecos";
import { normalizarPlaca, normalizarVin, type Veiculo } from "../veiculos/tipos";
import { nomeAutomatico, nomeUnico } from "./nome";
import { STATUS_EVENTO, type StatusEvento } from "./tipos";

export type CampoEvento = "titulo" | "cliente" | "tipo" | "status" | "solicitante" | "contato" | "chegada" | "retirada" | "local" | "endereco" | "origem" | "veiculos" | "comentarios";
export type LinhaCrua = Partial<Record<CampoEvento, string>>;
export type Tom = "ok" | "erro" | "dup" | "ign";

export const CAMPOS: { id: CampoEvento; titulo: string; largura: number }[] = [
  { id: "titulo", titulo: "Título", largura: 200 }, { id: "cliente", titulo: "Cliente", largura: 160 }, { id: "tipo", titulo: "Tipo", largura: 150 },
  { id: "status", titulo: "Status", largura: 150 }, { id: "solicitante", titulo: "Solicitante", largura: 150 }, { id: "contato", titulo: "Contato", largura: 170 },
  { id: "chegada", titulo: "Data de chegada", largura: 130 }, { id: "retirada", titulo: "Data de retirada", largura: 130 },
  { id: "local", titulo: "Nome do local", largura: 170 }, { id: "endereco", titulo: "Endereço completo", largura: 300 }, { id: "origem", titulo: "Origem", largura: 260 },
  { id: "veiculos", titulo: "Veículos (código, placa ou VIN)", largura: 300 }, { id: "comentarios", titulo: "Comentários", largura: 200 },
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const ALIAS: Record<string, CampoEvento> = {
  titulo: "titulo", evento: "titulo", nome: "titulo", "nome do evento": "titulo", cliente: "cliente", tipo: "tipo", status: "status", situacao: "status",
  solicitante: "solicitante", contato: "contato", chegada: "chegada", "data de chegada": "chegada", inicio: "chegada", "data de inicio": "chegada",
  retirada: "retirada", "data de retirada": "retirada", fim: "retirada", "data de fim": "retirada", local: "local", "nome do local": "local",
  endereco: "endereco", "endereco completo": "endereco", origem: "origem", "endereco de origem": "origem",
  veiculos: "veiculos", veiculo: "veiculos", carros: "veiculos", carro: "veiculos", "veiculos (codigo, placa ou vin)": "veiculos",
  comentarios: "comentarios", comentario: "comentarios", obs: "comentarios", observacao: "comentarios",
};

/** Matriz colada → linhas. Se a 1ª linha parece cabeçalho (reconhece ≥2 nomes de coluna), usa-o; senão assume a ordem de CAMPOS. */
export function linhasDeMatriz(matriz: string[][]): LinhaCrua[] {
  const dados = matriz.filter((l) => l.some((c) => (c ?? "").trim() !== ""));
  if (dados.length === 0) return [];
  const mapa = dados[0]!.map((c) => ALIAS[semAcento(c ?? "")]);
  const ehCabecalho = mapa.filter(Boolean).length >= 2;
  const ordem: (CampoEvento | undefined)[] = ehCabecalho ? mapa : CAMPOS.map((c) => c.id);
  return (ehCabecalho ? dados.slice(1) : dados).map((l) => {
    const o: LinhaCrua = {};
    l.forEach((c, i) => { const campo = ordem[i]; if (campo && (c ?? "").trim() !== "") o[campo] = c.trim(); });
    return o;
  });
}
export const linhaVazia = (l: LinhaCrua) => CAMPOS.every((c) => !(l[c.id] ?? "").trim());

/** dd/mm/aaaa, dd/mm/aa ou aaaa-mm-dd → aaaa-mm-dd (null se não existe no calendário). */
export function lerData(texto: string | undefined): string | null | "x" {
  const t = (texto ?? "").trim();
  if (!t) return null;
  let a: number, m: number, d: number;
  const br = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(t), iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (br) { d = +br[1]!; m = +br[2]!; a = br[3] === undefined ? new Date().getFullYear() : br[3].length === 2 ? 2000 + +br[3] : +br[3]; } else if (iso) { a = +iso[1]!; m = +iso[2]!; d = +iso[3]!; } else return "x";
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "x";
  return `${String(a).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Os carros de uma célula: separados por ; , ou quebra de linha (no Excel, Alt+Enter). */
export const separarVeiculos = (texto: string | undefined): string[] => (texto ?? "").split(/[;,\n\r]+/).map((t) => t.trim()).filter(Boolean);

export type Contexto = {
  veiculos: readonly Pick<Veiculo, "id" | "codigo" | "placa" | "vin" | "modelo">[];
  clientes: readonly { id: string; nome: string }[];
  nomesDeEventos: readonly string[];
  hoje: string;
};
export type EventoPronto = {
  nome: string; tipo: string | null; status: StatusEvento | null; solicitante: string | null; contato: string | null; cliente_id: string | null;
  chegada: string | null; retirada: string | null; local: { rotulo: string | null; endereco: string } | null; origem: string | null; comentarios: string | null; veiculoIds: string[];
};
export type ResultadoLinha = { tom: Tom; texto: string; evento?: EventoPronto };

const achaVeiculo = (ctx: Contexto, t: string) => {
  const k = t.trim().toLowerCase(), placa = normalizarPlaca(t), vin = normalizarVin(t);
  return ctx.veiculos.find((v) => (v.codigo ?? "").toLowerCase() === k || (placa.length === 7 && v.placa === placa) || (vin.length === 17 && v.vin === vin));
};

/** Valida uma linha. `titulosVistos` guarda os títulos já usados nesta tabela (título repetido = mais carros do MESMO evento). */
export function validarLinha(l: LinhaCrua, ctx: Contexto, usados: Set<string>): ResultadoLinha {
  if (linhaVazia(l)) return { tom: "ign", texto: "Linha vazia" };
  const chegada = lerData(l.chegada), retirada = lerData(l.retirada);
  if (chegada === "x") return { tom: "erro", texto: `Data de chegada inválida: "${l.chegada}" (use dd/mm/aaaa)` };
  if (retirada === "x") return { tom: "erro", texto: `Data de retirada inválida: "${l.retirada}" (use dd/mm/aaaa)` };
  if (chegada && retirada && retirada < chegada) return { tom: "erro", texto: "A retirada é antes da chegada" };
  let status: StatusEvento | null = null;
  if (l.status) { const k = semAcento(l.status); const s = STATUS_EVENTO.find((x) => semAcento(x.value) === k || semAcento(x.label) === k || semAcento(x.value.replace(/_/g, " ")) === k); if (!s) return { tom: "erro", texto: `Status desconhecido: "${l.status}"` }; status = s.value; }
  let cliente_id: string | null = null;
  if (l.cliente) { const c = ctx.clientes.find((x) => semAcento(x.nome) === semAcento(l.cliente!)); if (!c) return { tom: "erro", texto: `Cliente não cadastrado: "${l.cliente}"` }; cliente_id = c.id; }
  if (l.endereco && !enderecoValido(l.endereco)) return { tom: "erro", texto: `Endereço fora do formato. ${MENSAGEM_DO_ENDERECO}` };
  if (l.origem && !enderecoValido(l.origem)) return { tom: "erro", texto: `Origem fora do formato. ${MENSAGEM_DO_ENDERECO}` };
  const veiculoIds: string[] = [];
  for (const t of separarVeiculos(l.veiculos)) {
    const v = achaVeiculo(ctx, t);
    if (!v) return { tom: "erro", texto: `Veículo não encontrado: "${t}"` };
    if (!veiculoIds.includes(v.id)) veiculoIds.push(v.id);
  }
  if (veiculoIds.length > 0 && (!chegada || !retirada)) return { tom: "erro", texto: "Para reservar os carros, informe a chegada e a retirada" };

  const titulo = (l.titulo ?? "").trim();
  const chave = titulo.toLowerCase();
  if (titulo && ctx.nomesDeEventos.some((n) => n.trim().toLowerCase() === chave)) return { tom: "dup", texto: "Já existe um evento com esse título: será ignorada" };
  const repetido = !!titulo && usados.has(chave);
  if (titulo) usados.add(chave);
  const nome = titulo || nomeUnico(nomeAutomatico(chegada, l.solicitante), [...ctx.nomesDeEventos, ...usados]);
  if (!titulo) usados.add(nome.toLowerCase());
  const evento: EventoPronto = {
    nome, tipo: l.tipo?.trim() || null, status, solicitante: l.solicitante?.trim() || null, contato: l.contato?.trim() || null, cliente_id,
    chegada, retirada, local: l.endereco || l.local ? { rotulo: l.local?.trim() || null, endereco: l.endereco?.trim() || "Endereço a informar" } : null, origem: l.origem?.trim() || null,
    comentarios: l.comentarios?.trim() || null, veiculoIds,
  };
  return { tom: "ok", texto: repetido ? `Soma ${veiculoIds.length} carro(s) ao evento "${nome}"` : `Pronta: ${nome}${veiculoIds.length ? ` · ${veiculoIds.length} carro${veiculoIds.length === 1 ? "" : "s"}` : ""}`, evento };
}

export function validarTudo(linhas: LinhaCrua[], ctx: Contexto): ResultadoLinha[] {
  const usados = new Set<string>();
  return linhas.map((l) => validarLinha(l, ctx, usados));
}

/** Junta as linhas prontas de mesmo título num evento só (campos: vale o primeiro preenchido; carros: soma). */
export function agruparEventos(prontos: readonly EventoPronto[]): EventoPronto[] {
  const m = new Map<string, EventoPronto>();
  for (const e of prontos) {
    const k = e.nome.trim().toLowerCase(), a = m.get(k);
    if (!a) { m.set(k, { ...e, veiculoIds: [...e.veiculoIds] }); continue; }
    for (const campo of ["tipo", "status", "solicitante", "contato", "cliente_id", "chegada", "retirada", "local", "origem", "comentarios"] as const) a[campo] = (a[campo] ?? e[campo]) as never;
    for (const id of e.veiculoIds) if (!a.veiculoIds.includes(id)) a.veiculoIds.push(id);
  }
  return [...m.values()];
}
