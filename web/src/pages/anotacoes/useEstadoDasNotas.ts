import { useCallback, useEffect, useState } from "react";
import { definirFavorita, listarEstado, registrarAbertura, type EstadoDaNota } from "../../lib/anotacoes/dados";

/** Favoritas e recentes DE CADA PESSOA (o banco só mostra o próprio estado). */
export function useEstadoDasNotas() {
  const [estado, setEstado] = useState<EstadoDaNota[]>([]);
  const carregar = useCallback(() => { void listarEstado().then(setEstado, () => setEstado([])); }, []);
  useEffect(carregar, [carregar]);
  const favoritas = new Set(estado.filter((e) => e.favorite).map((e) => e.page_id));
  const recentes = estado.filter((e) => e.last_opened_at).sort((a, b) => (b.last_opened_at ?? "").localeCompare(a.last_opened_at ?? "")).slice(0, 10).map((e) => e.page_id);
  const alternarFavorita = async (pageId: string) => {
    const nova = !favoritas.has(pageId);
    setEstado((l) => (l.some((e) => e.page_id === pageId) ? l.map((e) => (e.page_id === pageId ? { ...e, favorite: nova } : e)) : [...l, { page_id: pageId, favorite: nova, last_opened_at: null }]));
    try { await definirFavorita(pageId, nova); } catch { carregar(); }
  };
  const abriu = (pageId: string) => { setEstado((l) => (l.some((e) => e.page_id === pageId) ? l.map((e) => (e.page_id === pageId ? { ...e, last_opened_at: new Date().toISOString() } : e)) : [...l, { page_id: pageId, favorite: false, last_opened_at: new Date().toISOString() }])); void registrarAbertura(pageId).catch(() => undefined); };
  return { favoritas, recentes, alternarFavorita, abriu };
}
