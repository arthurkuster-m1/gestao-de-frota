import { useEffect, useState } from "react";
import { ArrowCounterClockwise, DownloadSimple, FileDoc, UploadSimple } from "@phosphor-icons/react";
import { Button, Card, useToast } from "../../ds";
import { marcadoresDoModelo } from "../../lib/contratos/docx";
import { MARCADORES, MODELOS, baixarArquivo, modeloPadrao, modeloPersonalizado, restaurarModelo, salvarModelo, type TipoDeModelo } from "../../lib/contratos/documentos";

/** Os modelos (DOCX) que o app preenche com os dados do evento. O padrão vem do app; dá para trocar por outro com os mesmos marcadores {{assim}}. */
export function ModelosDeDocumento() {
  const toast = useToast();
  const [personalizados, setPersonalizados] = useState<Partial<Record<TipoDeModelo, string>>>({});
  const [ocupado, setOcupado] = useState<TipoDeModelo | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const recarregar = async () => { const r: Partial<Record<TipoDeModelo, string>> = {}; for (const m of MODELOS) { const p = await modeloPersonalizado(m.tipo); if (p) r[m.tipo] = p.nome; } setPersonalizados(r); };
  useEffect(() => { void recarregar(); }, []);

  async function baixar(tipo: TipoDeModelo, arquivo: string) {
    setFalha(null);
    try { const p = await modeloPersonalizado(tipo); const bytes = p?.bytes ?? await modeloPadrao(tipo); baixarArquivo(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), p?.nome ?? arquivo); }
    catch (e) { setFalha((e as Error).message); }
  }
  async function trocar(tipo: TipoDeModelo, f: File | undefined) {
    if (!f) return; setFalha(null); setOcupado(tipo);
    try {
      if (!/\.docx$/i.test(f.name)) throw new Error("Envie um arquivo .docx.");
      const buf = await f.arrayBuffer();
      const marcadores = await marcadoresDoModelo(buf).catch(() => { throw new Error("Não consegui ler esse arquivo como um DOCX."); });
      if (marcadores.length === 0) throw new Error("Esse modelo não tem nenhum marcador {{assim}}: nada seria preenchido. Veja a lista abaixo.");
      await salvarModelo(tipo, f.name, buf); await recarregar(); toast("Modelo trocado");
    } catch (e) { setFalha((e as Error).message); } finally { setOcupado(null); }
  }
  async function restaurar(tipo: TipoDeModelo) { setFalha(null); setOcupado(tipo); try { await restaurarModelo(tipo); await recarregar(); toast("Voltou ao modelo padrão"); } catch (e) { setFalha((e as Error).message); } finally { setOcupado(null); } }

  return (
    <Card>
      <div className="ds-stack" data-testid="modelos-de-documento">
        <h2 className="t-h3"><FileDoc size={20} style={{ verticalAlign: "-4px" }} /> Modelos de contrato</h2>
        <p className="t-body-sm t-muted">O contrato e os aditivos são gerados em DOCX a partir destes modelos, com os dados do evento, do cliente e dos carros. Para mudar o texto, baixe o modelo, edite no Word (mantendo os marcadores) e envie de volta.</p>
        {MODELOS.map((m) => (
          <div key={m.tipo} className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div><b>{m.rotulo}</b><div className="t-body-sm t-muted">{m.descricao} {personalizados[m.tipo] ? <>Em uso: <b>{personalizados[m.tipo]}</b></> : "Em uso: modelo padrão."}</div></div>
            <div className="ds-row" style={{ flexWrap: "wrap" }}>
              <Button size="sm" variant="secondary" icon={<DownloadSimple size={16} />} onClick={() => void baixar(m.tipo, m.arquivo)}>Baixar</Button>
              <label className="ds-btn ds-btn--secondary" style={{ cursor: "pointer", minHeight: 32, padding: "0 12px", fontSize: 13 }}><UploadSimple size={16} />{ocupado === m.tipo ? "Enviando…" : "Trocar modelo"}<input type="file" accept=".docx" hidden onChange={(e) => { void trocar(m.tipo, e.target.files?.[0]); e.target.value = ""; }} /></label>
              {personalizados[m.tipo] && <Button size="sm" variant="ghost" icon={<ArrowCounterClockwise size={16} />} loading={ocupado === m.tipo} onClick={() => void restaurar(m.tipo)}>Voltar ao padrão</Button>}
            </div>
          </div>
        ))}
        {falha && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{falha}</p>}
        <details>
          <summary className="t-body-sm" style={{ cursor: "pointer", fontWeight: 600 }}>Marcadores que o modelo entende</summary>
          <div className="ds-stack" style={{ marginTop: 8 }}>
            {MARCADORES.map((g) => (
              <div key={g.grupo}><p className="t-body-sm" style={{ fontWeight: 600 }}>{g.grupo}</p>
                <ul className="t-body-sm" style={{ paddingLeft: 18 }}>{g.itens.map((i) => <li key={i.marcador}><code>{`{{${i.marcador}}}`}</code> — {i.descricao}</li>)}</ul></div>
            ))}
          </div>
        </details>
      </div>
    </Card>
  );
}
