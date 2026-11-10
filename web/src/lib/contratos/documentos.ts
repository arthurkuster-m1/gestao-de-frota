import { supabase } from "../supabase";
import { maskCep, maskCnpj, maskCpf, soDigitos } from "../clientes/documentos";
import type { Cliente } from "../clientes/dados";
import { gerarDocx } from "./docx";
import type { Aditivo, Contrato } from "./tipos";

export type TipoDeModelo = "contrato_comodato" | "aditivo_substituicao" | "aditivo_prorrogacao";
export const MODELOS: { tipo: TipoDeModelo; rotulo: string; arquivo: string; descricao: string }[] = [
  { tipo: "contrato_comodato", rotulo: "Contrato de comodato", arquivo: "contrato-comodato.docx", descricao: "Gerado ao criar o contrato no evento." },
  { tipo: "aditivo_substituicao", rotulo: "Aditivo de substituição de veículo", arquivo: "aditivo-substituicao.docx", descricao: "Aditivo de troca de carros." },
  { tipo: "aditivo_prorrogacao", rotulo: "Termo aditivo de extensão de prazo", arquivo: "aditivo-prorrogacao.docx", descricao: "Aditivo de extensão de prazo." },
];

/** Os marcadores que os modelos entendem: o que o app preenche com os dados do evento, do cliente e dos carros. */
export const MARCADORES: { grupo: string; itens: { marcador: string; descricao: string }[] }[] = [
  { grupo: "Cliente", itens: [{ marcador: "cliente_nome", descricao: "Nome ou razão social" }, { marcador: "cliente_documento", descricao: "CNPJ ou CPF" }, { marcador: "cliente_documento_tipo", descricao: "CNPJ/MF ou CPF" }, { marcador: "cliente_endereco", descricao: "Logradouro, nº, complemento, cidade, UF e CEP" }] },
  { grupo: "Contrato", itens: [{ marcador: "data_inicio", descricao: "Início da vigência" }, { marcador: "data_fim", descricao: "Fim da vigência" }, { marcador: "objetivo", descricao: "Objetivo do empréstimo (o evento)" }, { marcador: "local_endereco", descricao: "Local de entrega e retirada (endereço do evento)" }, { marcador: "data_assinatura", descricao: "Data de assinatura do contrato (aditivos)" }] },
  { grupo: "Carros (linha da tabela repete por carro)", itens: [{ marcador: "veiculo_modelo", descricao: "Modelo / ano" }, { marcador: "veiculo_vin", descricao: "VIN" }, { marcador: "veiculo_cor", descricao: "Cor" }, { marcador: "veiculo_placa", descricao: "Placa" }] },
  { grupo: "Motoristas do Anexo I (linha repete por motorista)", itens: [{ marcador: "motorista_nome", descricao: "Nome" }, { marcador: "motorista_cpf", descricao: "CPF" }, { marcador: "motorista_cnh", descricao: "CNH" }, { marcador: "motorista_cnh_validade", descricao: "Validade da CNH" }] },
  { grupo: "Aditivos", itens: [{ marcador: "ordinal", descricao: "Primeiro, Segundo… (ordinal_caps: PRIMEIRO)" }, { marcador: "tipo_contrato", descricao: "Comodato (tipo_contrato_caps: COMODATO)" }, { marcador: "parte", descricao: "COMODATÁRIO" }, { marcador: "data_efeito", descricao: "Data a partir da qual vale a troca" }, { marcador: "nova_data_fim", descricao: "Novo fim da vigência" }, { marcador: "sai_modelo / sai_vin / sai_cor / sai_placa", descricao: "Carros que saem (linha repete)" }, { marcador: "entra_modelo / entra_vin / entra_cor / entra_placa", descricao: "Carros que entram (linha repete)" }] },
];

export const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const ORDINAIS = ["Primeiro", "Segundo", "Terceiro", "Quarto", "Quinto", "Sexto", "Sétimo", "Oitavo", "Nono", "Décimo"];
export const ordinal = (n: number) => ORDINAIS[n - 1] ?? `${n}º`;

export type CarroDoDocumento = { codigo: string; modelo: string; vin: string; cor: string; placa: string };
export type DadosDoCliente = { nome: string; documento: string; documentoTipo: string; endereco: string; email: string; testemunhaNome: string; testemunhaEmail: string };
export type MotoristaDoDocumento = { nome: string; cpf: string; cnh: string; cnhValidade: string };
/** Tudo o que o contrato usa, "congelado" no contrato: depois de assinado o documento sai sempre igual. */
export type SnapshotDoContrato = { evento: string; cliente: DadosDoCliente; dataInicio: string | null; dataFim: string | null; objetivo: string; localEndereco: string; carros: CarroDoDocumento[]; motoristas: MotoristaDoDocumento[]; geradoEm: string };
export type SnapshotDoAditivo = { ordinal: number; cliente: DadosDoCliente; dataAssinatura: string | null; dataEfeito: string | null; novaDataFim: string | null; sai: CarroDoDocumento[]; entra: CarroDoDocumento[] };

export function dadosDoCliente(c: Cliente): DadosDoCliente {
  const dig = soDigitos(c.documento); const pj = c.tipo_pessoa === "juridica";
  const partes = [c.endereco, c.numero ? `nº ${c.numero}` : "", c.complemento, c.cidade, c.estado, c.cep ? `CEP ${maskCep(c.cep)}` : ""].map((x) => (x ?? "").trim()).filter(Boolean);
  return { nome: c.nome, documento: pj ? maskCnpj(dig) : maskCpf(dig), documentoTipo: pj ? "CNPJ/MF" : "CPF", endereco: partes.join(", "), email: c.email, testemunhaNome: c.testemunha_nome, testemunhaEmail: c.testemunha_email };
}

const base = (c: DadosDoCliente) => ({ cliente_nome: c.nome, cliente_documento: c.documento, cliente_documento_tipo: c.documentoTipo, cliente_endereco: c.endereco });
export function valoresDoContrato(s: SnapshotDoContrato) {
  return {
    valores: { ...base(s.cliente), data_inicio: dataBr(s.dataInicio), data_fim: dataBr(s.dataFim), objetivo: s.objetivo, local_endereco: s.localEndereco },
    listas: { veiculo: s.carros.map((c) => ({ modelo: c.modelo, vin: c.vin, cor: c.cor, placa: c.placa })), motorista: s.motoristas.map((m) => ({ nome: m.nome, cpf: m.cpf, cnh: m.cnh, cnh_validade: m.cnhValidade })) },
  };
}
export function valoresDoAditivo(s: SnapshotDoAditivo) {
  const carro = (c: CarroDoDocumento) => ({ modelo: c.modelo, vin: c.vin, cor: c.cor, placa: c.placa });
  return {
    valores: { ...base(s.cliente), ordinal: ordinal(s.ordinal), ordinal_caps: ordinal(s.ordinal).toUpperCase(), tipo_contrato: "Comodato", tipo_contrato_caps: "COMODATO", parte: "COMODATÁRIO", data_assinatura: dataBr(s.dataAssinatura), data_efeito: dataBr(s.dataEfeito), nova_data_fim: dataBr(s.novaDataFim) },
    listas: { sai: s.sai.map(carro), entra: s.entra.map(carro) },
  };
}
export const tituloDoAditivo = (n: number, tipo: Aditivo["tipo"]) => `${ordinal(n)} termo aditivo: ${tipo === "troca_carros" ? "substituição de veículo" : "extensão de prazo"}`;

// ---- modelos: o app traz os padrões (public/modelos); a pessoa pode trocar nas Configurações (fica no banco)
export class ErroModelo extends Error {}
const paraBase64 = (b: ArrayBuffer) => { let s = ""; const u = new Uint8Array(b); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const deBase64 = (t: string) => { const s = atob(t); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };

export async function modeloPersonalizado(tipo: TipoDeModelo): Promise<{ nome: string; bytes: Uint8Array } | null> {
  const { data, error } = await supabase.from("modelos_documento").select("nome_arquivo, conteudo").eq("tipo", tipo).maybeSingle();
  if (error) return null;   // sem a tabela (migration ainda não rodou) vale o padrão
  return data ? { nome: (data as { nome_arquivo: string }).nome_arquivo, bytes: deBase64((data as { conteudo: string }).conteudo) } : null;
}
export async function modeloPadrao(tipo: TipoDeModelo): Promise<Uint8Array> {
  const r = await fetch(`/modelos/${MODELOS.find((m) => m.tipo === tipo)!.arquivo}`);
  if (!r.ok) throw new ErroModelo("Não achei o modelo padrão. Recarregue a página.");
  return new Uint8Array(await r.arrayBuffer());
}
export async function carregarModelo(tipo: TipoDeModelo): Promise<Uint8Array> { return (await modeloPersonalizado(tipo))?.bytes ?? modeloPadrao(tipo); }
export async function salvarModelo(tipo: TipoDeModelo, nome: string, arquivo: ArrayBuffer): Promise<void> {
  const { error } = await supabase.from("modelos_documento").upsert({ tipo, nome_arquivo: nome, conteudo: paraBase64(arquivo) } as never, { onConflict: "workspace_id,tipo" });
  if (error) throw new ErroModelo(/modelos_documento/.test(error.message) && /schema cache|does not exist/.test(error.message) ? "Os modelos ainda não foram ativados no banco (falta rodar o SQL)." : error.message);
}
export async function restaurarModelo(tipo: TipoDeModelo): Promise<void> {
  const { error } = await supabase.from("modelos_documento").delete().eq("tipo", tipo);
  if (error) throw new ErroModelo(error.message);
}

export function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const nomeSeguro = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "documento";
export const nomeDoArquivoDoContrato = (evento: string) => `Contrato-de-comodato-${nomeSeguro(evento)}.docx`;
export const nomeDoArquivoDoAditivo = (evento: string, titulo: string) => `${nomeSeguro(titulo)}-${nomeSeguro(evento)}.docx`;

export async function gerarContratoDocx(s: SnapshotDoContrato): Promise<Blob> { const { valores, listas } = valoresDoContrato(s); return gerarDocx(await carregarModelo("contrato_comodato"), valores, listas); }
export async function gerarAditivoDocx(tipo: Aditivo["tipo"], s: SnapshotDoAditivo): Promise<Blob> { const { valores, listas } = valoresDoAditivo(s); return gerarDocx(await carregarModelo(tipo === "troca_carros" ? "aditivo_substituicao" : "aditivo_prorrogacao"), valores, listas); }
export type { Contrato };
