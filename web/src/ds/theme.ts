import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";
const KEY = "frota.theme";

function lerSalvo(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system"; // armazenamento bloqueado: segue o sistema
  }
}

function resolver(modo: ThemeMode): "light" | "dark" {
  if (modo !== "system") return modo;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function aplicar(modo: ThemeMode) {
  const tema = resolver(modo);
  document.documentElement.setAttribute("data-theme", tema);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", tema === "dark" ? "#0b1220" : "#182a4a");
}

export function useTheme() {
  const [modo, setModo] = useState<ThemeMode>(lerSalvo);

  useEffect(() => {
    aplicar(modo);
    if (modo !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => aplicar("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [modo]);

  const definir = useCallback((m: ThemeMode) => {
    try {
      if (m === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, m);
    } catch {
      /* sem armazenamento: vale só nesta sessão */
    }
    setModo(m);
  }, []);

  const resolvido = resolver(modo);
  const alternar = useCallback(() => definir(resolvido === "dark" ? "light" : "dark"), [definir, resolvido]);
  return { modo, resolvido, definir, alternar };
}
