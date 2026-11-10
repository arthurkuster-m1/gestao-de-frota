/**
 * Notificações do app (a base: vamos evoluir). Hoje existe uma: "Bater o ponto", às 07:00 e às 19:20, com um botão que abre o site do ponto.
 * As escolhas ficam guardadas neste aparelho (a permissão de notificar também é do aparelho).
 */
export type Notificacao = {
  id: string; titulo: string; corpo: string; /** texto do botão da notificação */ botao: string; /** para onde o botão leva */ url: string;
  ativa: boolean; /** "HH:MM" */ horarios: string[]; /** 0 = domingo … 6 = sábado */ dias: number[];
};

/** O link do ponto (tem uma chave pessoal: dá para trocar em Configurações). */
export const URL_DO_PONTO = "https://gm.suricato.com.br:8443/codinmobileadm/Identity/Account/MarcarPontoWeb?sk=0A0CF-08DA7-22414-89E72-462AF-316A0";

export const NOTIFICACOES_PADRAO: Notificacao[] = [
  { id: "bater-ponto", titulo: "Bater o ponto", corpo: "Hora de registrar o ponto.", botao: "Bater ponto", url: URL_DO_PONTO, ativa: true, horarios: ["07:00", "19:20"], dias: [1, 2, 3, 4, 5] },
];

const CHAVE = "frota:notificacoes:v1";
export const horarioValido = (h: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

export function lerNotificacoes(): Notificacao[] {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as Partial<Notificacao>[] | null;
    if (Array.isArray(bruto)) {
      // o que está guardado manda, mas campos que faltem vêm do padrão (e notificação nova do app aparece sozinha)
      return NOTIFICACOES_PADRAO.map((p) => {
        const g = bruto.find((x) => x.id === p.id); if (!g) return p;
        return { ...p, ...g, horarios: Array.isArray(g.horarios) ? g.horarios.filter(horarioValido) : p.horarios, dias: Array.isArray(g.dias) ? g.dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : p.dias, url: typeof g.url === "string" && /^https?:\/\//.test(g.url) ? g.url : p.url };
      });
    }
  } catch { /* sem armazenamento */ }
  return NOTIFICACOES_PADRAO;
}
export function gravarNotificacoes(l: Notificacao[]) { try { localStorage.setItem(CHAVE, JSON.stringify(l)); } catch { /* sem armazenamento */ } }

export type Disparo = { notificacao: Notificacao; horario: string; /** identifica este disparo ("id|aaaa-mm-dd|HH:MM"), para não repetir */ chave: string };
const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

/**
 * Os disparos que estão "na hora" agora: o horário já chegou e faz no máximo `janelaMin` minutos (assim, abrir o app ao meio-dia
 * não dispara o aviso das 7). `jaDisparou` evita repetir o mesmo horário no mesmo dia.
 */
export function disparosDevidos(lista: readonly Notificacao[], agora: Date, jaDisparou: (chave: string) => boolean, janelaMin = 15): Disparo[] {
  const m = agora.getHours() * 60 + agora.getMinutes();
  const saida: Disparo[] = [];
  for (const n of lista) {
    if (!n.ativa || !n.dias.includes(agora.getDay())) continue;
    for (const h of n.horarios) {
      const atraso = m - minutos(h);
      const chave = `${n.id}|${dia(agora)}|${h}`;
      if (atraso >= 0 && atraso <= janelaMin && !jaDisparou(chave)) saida.push({ notificacao: n, horario: h, chave });
    }
  }
  return saida;
}

export const notificacaoSuportada = () => typeof Notification !== "undefined";
export const permissaoDeNotificar = (): NotificationPermission | "indisponivel" => (notificacaoSuportada() ? Notification.permission : "indisponivel");

/** Mostra a notificação (pelo service worker, para ter o botão). Devolve false se o aparelho não deixou. */
export async function mostrarNotificacao(n: Pick<Notificacao, "id" | "titulo" | "corpo" | "botao" | "url">): Promise<boolean> {
  if (!notificacaoSuportada() || Notification.permission !== "granted") return false;
  const opcoes = { body: n.corpo, icon: "/icon-192.png", badge: "/icon-192.png", tag: n.id, requireInteraction: true, data: { url: n.url }, actions: [{ action: "abrir", title: n.botao }] } as NotificationOptions;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(n.titulo, opcoes); return true; }
    const simples = new Notification(n.titulo, { body: n.corpo, icon: "/icon-192.png", tag: n.id, data: opcoes.data });
    simples.onclick = () => { window.open(n.url, "_blank", "noopener"); simples.close(); };
    return true;
  } catch { return false; }
}
