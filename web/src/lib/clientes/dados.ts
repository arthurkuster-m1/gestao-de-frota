import { supabase } from "../supabase";
import { soDigitos } from "./documentos";

export class ErroCliente extends Error {}

export type TipoPessoa = "fisica" | "juridica";
export type ClienteResumo = { id: string; tipo_pessoa: TipoPessoa; nome: string; cidade: string | null; estado: string | null; created_at: string };
export type Motorista = { id?: string; nome: string; cpf: string; cnh_registro: string; cnh_validade: string };
export type Cliente = {
  id?: string; tipo_pessoa: TipoPessoa; nome: string; documento: string; email: string;
  cep: string; endereco: string; numero: string; complemento: string; cidade: string; estado: string;
  testemunha_nome: string; testemunha_email: string; comentarios: string; motoristas: Motorista[];
};
export const clienteVazio = (): Cliente => ({ tipo_pessoa: "juridica", nome: "", documento: "", email: "", cep: "", endereco: "", numero: "", complemento: "", cidade: "", estado: "", testemunha_nome: "", testemunha_email: "", comentarios: "", motoristas: [] });
export const motoristaVazio = (): Motorista => ({ nome: "", cpf: "", cnh_registro: "", cnh_validade: "" });

function traduzir(e: { code?: string; message: string; details?: string }): ErroCliente {
  if (e.code === "23505") return new ErroCliente("Já existe um cliente com esse CPF/CNPJ.");
  if (e.code === "23514") return new ErroCliente(e.message);
  if (e.code === "42501") return new ErroCliente("Cliente não encontrado, ou sem permissão. Entre de novo na conta.");
  return new ErroCliente(e.message);
}

/** Colunas liberadas ao app (as confidenciais ficam de fora: só as funções do banco as leem). */
const COLUNAS = "id, tipo_pessoa, nome, cidade, estado, created_at";
const COLUNAS_FICHA = "id, tipo_pessoa, nome, cep, endereco, numero, complemento, cidade, estado, testemunha_nome, comentarios";

export async function listarClientes(): Promise<ClienteResumo[]> {
  const { data, error } = await supabase.from("clientes").select(COLUNAS).order("nome", { ascending: true }).limit(2000);
  if (error) throw traduzir(error);
  return (data ?? []) as ClienteResumo[];
}

export async function buscarCliente(id: string): Promise<Cliente | null> {
  const { data, error } = await supabase.from("clientes").select(COLUNAS_FICHA).eq("id", id).maybeSingle();
  if (error) throw traduzir(error);
  if (!data) return null;
  const [sens, mot] = await Promise.all([supabase.rpc("fn_cliente_sensiveis", { p_id: id }), supabase.rpc("fn_cliente_motoristas", { p_cliente: id })]);
  if (sens.error) throw traduzir(sens.error);
  if (mot.error) throw traduzir(mot.error);
  const s = (sens.data ?? {}) as Record<string, string | undefined>;
  const r = data as Record<string, string | null>;
  const t = (k: string) => r[k] ?? "";
  return {
    id, tipo_pessoa: r.tipo_pessoa as TipoPessoa, nome: t("nome"), documento: s.documento ?? "", email: s.email ?? "",
    cep: t("cep"), endereco: t("endereco"), numero: t("numero"), complemento: t("complemento"), cidade: t("cidade"), estado: t("estado"),
    testemunha_nome: t("testemunha_nome"), testemunha_email: s.testemunha_email ?? "", comentarios: t("comentarios"),
    motoristas: ((mot.data ?? []) as { id: string; nome: string; cpf: string | null; cnh_registro: string | null; cnh_validade: string | null }[]).map((m) => ({ id: m.id, nome: m.nome, cpf: m.cpf ?? "", cnh_registro: m.cnh_registro ?? "", cnh_validade: m.cnh_validade ?? "" })),
  };
}

/** Grava o cliente e os motoristas de uma vez (tudo ou nada); o banco criptografa CPF/CNPJ, CNH e e-mails. */
export async function salvarCliente(c: Cliente): Promise<string> {
  const corpo = { ...c, documento: soDigitos(c.documento), estado: c.estado.toUpperCase() };
  const motoristas = c.motoristas.map((m) => ({ nome: m.nome, cpf: soDigitos(m.cpf), cnh_registro: m.cnh_registro, cnh_validade: m.cnh_validade }));
  const { data, error } = await supabase.rpc("fn_cliente_salvar", { p_id: c.id ?? null, p_cliente: corpo, p_motoristas: motoristas });
  if (error) throw traduzir(error);
  return data as string;
}
