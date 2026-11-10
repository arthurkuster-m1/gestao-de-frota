import { Component, type ErrorInfo, type ReactNode } from "react";
import { recuperarApp } from "../lib/recuperar";

/**
 * Se qualquer tela quebrar, em vez da tela branca aparece este aviso, com o botão que limpa o que está guardado no aparelho e recarrega.
 */
export class ErroNaTela extends Component<{ children: ReactNode }, { erro: Error | null }> {
  state = { erro: null as Error | null };
  static getDerivedStateFromError(erro: Error) { return { erro }; }
  componentDidCatch(erro: Error, info: ErrorInfo) { console.error("Erro na tela:", erro, info.componentStack); }
  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <main className="ds-page ds-page--center" role="alert" data-testid="erro-na-tela">
        <div className="ds-stack" style={{ maxWidth: 420, textAlign: "center", margin: "0 auto" }}>
          <h1 className="t-h2">Algo deu errado nesta tela</h1>
          <p className="t-body t-muted">Pode ser uma versão antiga guardada neste aparelho. Atualizar limpa isso e abre o app de novo; seus dados não são perdidos.</p>
          <div className="ds-row" style={{ justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="ds-btn ds-btn--primary" onClick={() => void recuperarApp()} data-testid="erro-atualizar">Atualizar o app</button>
            <button type="button" className="ds-btn ds-btn--secondary" onClick={() => this.setState({ erro: null })}>Tentar de novo</button>
          </div>
          <p className="t-body-sm t-muted" style={{ wordBreak: "break-word" }}>{this.state.erro.message}</p>
        </div>
      </main>
    );
  }
}
