import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "./lib/auth";
import { supabaseConfigurado } from "./lib/supabase";
import { EspacoProvider } from "./lib/espaco";
import { EVENTO_ATUALIZADO } from "./lib/versao";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { EmBreve } from "./pages/EmBreve";
import { SemConfig } from "./pages/SemConfig";
import { Shell } from "./app/Shell";
import { Veiculos } from "./pages/veiculos/Veiculos";
import { FormVeiculo } from "./pages/veiculos/FormVeiculo";
import { Massa as MassaVeiculos } from "./pages/veiculos/Massa";
import { DESTINOS } from "./app/modules";
import { Button, useTheme } from "./ds";

/** Faixa "nova versão pronta": aparece quando o app é atualizado enquanto alguém está usando. */
function AvisoAtualizacao() {
  const [ha, setHa] = useState(false);
  useEffect(() => { const f = () => setHa(true); window.addEventListener(EVENTO_ATUALIZADO, f); return () => window.removeEventListener(EVENTO_ATUALIZADO, f); }, []);
  if (!ha) return null;
  return (
    <div role="status" data-testid="aviso-atualizacao" style={{ position: "fixed", left: 12, right: 12, bottom: 92, zIndex: 50, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 16, background: "var(--color-accent)", color: "var(--color-accent-fg)" }}>
      <span className="t-body-sm">Nova versão do app pronta.</span>
      <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>Atualizar</Button>
    </div>
  );
}

function Autenticado() {
  return (
    <EspacoProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="veiculos" element={<Veiculos />} />
          <Route path="veiculos/novo" element={<FormVeiculo />} />
          <Route path="veiculos/massa" element={<MassaVeiculos />} />
          <Route path="veiculos/:id" element={<FormVeiculo />} />
          {DESTINOS.filter((d) => d.path !== "/" && d.path !== "/veiculos").map((d) => (
            <Route key={d.path} path={d.path.slice(1)} element={<EmBreve destino={d} />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </EspacoProvider>
  );
}

export function App() {
  useTheme();
  const { session, carregando } = useAuth();
  return (
    <>
      <AvisoAtualizacao />
      {!supabaseConfigurado ? <SemConfig /> :
        carregando ? <main className="ds-page ds-page--center"><p className="t-body t-muted" style={{ textAlign: "center" }}>Carregando…</p></main> :
        session ? <Autenticado /> : <Login />}
    </>
  );
}
