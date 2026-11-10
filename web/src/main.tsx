import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./ds";
import { App } from "./App";
import { ErroNaTela } from "./app/ErroNaTela";
import { iniciarAtualizacao } from "./lib/versao";

iniciarAtualizacao();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ErroNaTela><App /></ErroNaTela>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
