type Tom = "success" | "warning" | "error" | "info" | "neutral" | "accent";

/** Um pedaço colorido dentro de uma barra (ex.: o prazo de logística, em azul, antes e depois do evento). */
export type SegmentoDeBarra = { inicio: string; fim: string; tom: Tom; /** logística é mais clara que o miolo */ tipo: "logistica" | "principal" };

/** Uma barra da linha do tempo: período em dias inclusivos (AAAA-MM-DD). `dados` é livre: quem desenha a tela sabe o que é. */
export type Barra = {
  id: string; inicio: string; fim: string; rotulo: string; tom: Tom; segmentos?: SegmentoDeBarra[];
  /** Pode ser arrastada (mover / esticar as pontas). */
  movel?: boolean; esticavel?: boolean; destaque?: boolean; dados?: unknown;
};
export type ModoDeArrasto = "mover" | "inicio" | "fim";
