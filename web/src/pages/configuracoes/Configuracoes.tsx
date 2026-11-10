import { useState } from "react";
import { Bell, BellRinging, Palette, Plus, Trash } from "@phosphor-icons/react";
import { Button, Card, Field, Input, Page, Segmented, Switch, useToast } from "../../ds";
import { useDensidade, type Densidade } from "../../lib/densidade";
import { NOTIFICACOES_PADRAO, gravarNotificacoes, horarioValido, lerNotificacoes, mostrarNotificacao, notificacaoSuportada, permissaoDeNotificar, type Notificacao } from "../../lib/notificacoes/notificacoes";
import "../veiculos/veiculos.css";

/** Digitou 1920 → 19:20. */
const mascaraHorario = (t: string) => { const d = t.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d; };
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Configurações. Por enquanto: as notificações (cada uma com interruptor, horários, dias e o botão que ela traz). */
export function Configuracoes() {
  const toast = useToast();
  const { densidade, mudar: mudarDensidade } = useDensidade();
  const [lista, setLista] = useState<Notificacao[]>(lerNotificacoes);
  const [permissao, setPermissao] = useState(permissaoDeNotificar);
  const [novoHorario, setNovoHorario] = useState<Record<string, string>>({});
  const muda = (id: string, patch: Partial<Notificacao>) => setLista((l) => { const n = l.map((x) => (x.id === id ? { ...x, ...patch } : x)); gravarNotificacoes(n); return n; });

  async function permitir() {
    if (!notificacaoSuportada()) { toast("Este navegador não mostra notificações."); return; }
    setPermissao(await Notification.requestPermission());
  }
  async function testar(n: Notificacao) {
    if (permissao !== "granted") { await permitir(); if (Notification.permission !== "granted") return; }
    toast((await mostrarNotificacao(n)) ? "Notificação enviada" : "Não consegui mostrar a notificação");
  }

  return (
    <Page wide>
      <div className="ds-stack">
        <div><h1 className="t-h1">Configurações</h1><p className="t-body t-muted">Aparência e notificações do app.</p></div>

        <Card>
          <div className="ds-stack">
            <h2 className="t-h3"><Palette size={20} style={{ verticalAlign: "-4px" }} /> Aparência</h2>
            <Field label="Densidade das tabelas"><Segmented options={[{ value: "compacta", label: "Compacta" }, { value: "confortavel", label: "Confortável" }]} value={densidade} onChange={(v: Densidade) => mudarDensidade(v)} /></Field>
            <p className="t-body-sm t-muted">Compacta: linhas baixas e letra menor, cabem mais linhas na tela (como no Notion). Confortável: linhas mais altas, com mais espaço. Também dá para alternar pelo botão de linhas na barra de qualquer tabela. Vale para este aparelho.</p>
          </div>
        </Card>

        <Card>
          <div className="ds-stack">
            <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <h2 className="t-h3"><Bell size={20} style={{ verticalAlign: "-4px" }} /> Notificações</h2>
              <span className="t-body-sm" data-testid="permissao-notificacao" style={{ color: permissao === "granted" ? "var(--color-success-fg)" : permissao === "denied" ? "var(--color-error-fg)" : undefined }}>
                {permissao === "granted" ? "Permitidas neste aparelho" : permissao === "denied" ? "Bloqueadas no navegador (libere nas configurações do site)" : permissao === "indisponivel" ? "Este navegador não mostra notificações" : "Ainda não permitidas neste aparelho"}
              </span>
            </div>
            {permissao === "default" && <div><Button variant="secondary" icon={<BellRinging size={18} />} onClick={() => void permitir()} data-testid="permitir-notificacoes">Permitir notificações neste aparelho</Button></div>}
            <p className="t-body-sm t-muted">As notificações aparecem com o app aberto (aba ou app instalado, mesmo em segundo plano). Com o app fechado, é preciso o envio pelo servidor, que fica para a próxima etapa. As escolhas valem para este aparelho.</p>

            {lista.map((n) => (
              <div key={n.id} className="vei-motorista" data-testid="notificacao">
                <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div><b className="t-body">{n.titulo}</b><p className="t-body-sm t-muted">{n.corpo} · botão “{n.botao}”</p></div>
                  <div className="ds-row" style={{ gap: 12 }}>
                    <Button size="sm" variant="secondary" onClick={() => void testar(n)} data-testid="testar-notificacao">Testar agora</Button>
                    <Switch checked={n.ativa} onChange={(v) => muda(n.id, { ativa: v })} label={`${n.titulo} ligada`} />
                  </div>
                </div>

                <Field label="Horários">
                  <div className="ds-row" style={{ flexWrap: "wrap", gap: 8 }}>
                    {n.horarios.map((h) => (
                      <span key={h} className="mt-chip is-on" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px" }}>{h}
                        <button type="button" className="mt-chip__lixo" aria-label={`Tirar o horário ${h}`} onClick={() => muda(n.id, { horarios: n.horarios.filter((x) => x !== h) })}><Trash size={14} /></button></span>
                    ))}
                    <span className="ds-row" style={{ gap: 6 }}>
                      <Input inputMode="numeric" maxLength={5} placeholder="HH:MM" style={{ width: 110 }} value={novoHorario[n.id] ?? ""} onChange={(e) => setNovoHorario((x) => ({ ...x, [n.id]: mascaraHorario(e.target.value) }))} aria-label="Novo horário (HH:MM)"
                        onKeyDown={(e) => { const h = novoHorario[n.id] ?? ""; if (e.key === "Enter" && horarioValido(h) && !n.horarios.includes(h)) { e.preventDefault(); muda(n.id, { horarios: [...n.horarios, h].sort() }); setNovoHorario((x) => ({ ...x, [n.id]: "" })); } }} />
                      <Button size="sm" variant="ghost" icon={<Plus size={16} />} disabled={!horarioValido(novoHorario[n.id] ?? "") || n.horarios.includes(novoHorario[n.id] ?? "")}
                        onClick={() => { muda(n.id, { horarios: [...n.horarios, novoHorario[n.id]!].sort() }); setNovoHorario((s) => ({ ...s, [n.id]: "" })); }}>Adicionar</Button>
                    </span>
                  </div>
                </Field>

                <Field label="Dias da semana">
                  <div className="ds-row" style={{ flexWrap: "wrap", gap: 6 }}>
                    {DIAS.map((nome, i) => (
                      <button key={nome} type="button" className={n.dias.includes(i) ? "mt-opcao is-on" : "mt-opcao"} aria-pressed={n.dias.includes(i)} data-testid="dia-da-semana"
                        style={{ minWidth: 48, padding: "6px 10px", borderRadius: 999, border: "1px solid var(--color-border-strong)", background: n.dias.includes(i) ? "var(--color-accent-soft)" : "transparent", color: n.dias.includes(i) ? "var(--color-accent)" : "inherit", fontWeight: 600, cursor: "pointer" }}
                        onClick={() => muda(n.id, { dias: n.dias.includes(i) ? n.dias.filter((x) => x !== i) : [...n.dias, i].sort() })}>{nome}</button>
                    ))}
                  </div>
                </Field>

                <Field label="Endereço do botão"><Input value={n.url} onChange={(e) => muda(n.id, { url: e.target.value })} aria-label="Endereço do botão" /></Field>
                <div><Button size="sm" variant="ghost" onClick={() => { const p = NOTIFICACOES_PADRAO.find((x) => x.id === n.id); if (p) muda(n.id, p); }}>Voltar ao padrão desta notificação</Button></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  );
}
