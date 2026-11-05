import { useState, type FormEvent } from "react";
import { Car } from "@phosphor-icons/react";
import { supabase } from "../lib/supabase";
import { Button, Card, Field, Input, Page } from "../ds";

export function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) setErro("E-mail ou senha incorretos.");
    setEnviando(false);
  }

  return (
    <Page center>
      <div style={{ display: "grid", justifyItems: "center", gap: 12, textAlign: "center" }}>
        <span className="ds-avatar ds-avatar--lg ds-avatar--brand" style={{ width: 72, height: 72, borderRadius: 24 }} aria-hidden><Car size={36} weight="fill" /></span>
        <div>
          <h1 className="t-display">Frota</h1>
          <p className="t-body t-muted">Acesso restrito</p>
        </div>
      </div>
      <Card>
        <form className="ds-stack" onSubmit={entrar}>
          <Field label="E-mail"><Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Senha" error={erro}><Input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} /></Field>
          <Button type="submit" size="lg" block loading={enviando}>Entrar</Button>
        </form>
      </Card>
    </Page>
  );
}
