import { useRef } from "react";
import { Note } from "@phosphor-icons/react";
import { usePopover } from "../../ds/popover";

const ICONES = ["📝", "📌", "⭐", "💡", "📋", "📅", "✅", "❓", "🚗", "🛠️", "📞", "📎", "📊", "🔒", "🏁", "🎯", "📦", "🧾", "⚠️", "🗂️", "📍", "🤝", "🎬", "🔧"];

/** O ícone da página: clicar abre uma grade de emojis (e "Sem ícone"). */
export function SeletorDeIcone({ valor, onMudar, tamanho = 40 }: { valor: string | null; onMudar: (icone: string | null) => void; tamanho?: number }) {
  const gatilho = useRef<HTMLSpanElement>(null);
  const { ref, aberto, setAberto } = usePopover(gatilho, { largura: 260 });
  return (
    <span ref={gatilho} style={{ display: "inline-flex" }}>
      <button type="button" className="an-icone" style={{ fontSize: tamanho * 0.7, width: tamanho, height: tamanho }} aria-label="Escolher o ícone da página" aria-expanded={aberto} onClick={() => setAberto(!aberto)} data-testid="icone-da-pagina">
        {valor || <Note size={tamanho * 0.7} aria-hidden />}
      </button>
      <div ref={ref} popover="auto" className="ds-pop" role="dialog" aria-label="Ícones">
        <div className="an-icones">
          {ICONES.map((i) => <button key={i} type="button" className="an-icone an-icone--grade" onClick={() => { onMudar(i); setAberto(false); }} aria-label={`Ícone ${i}`}>{i}</button>)}
        </div>
        {valor && <button type="button" className="an-icone-limpar" onClick={() => { onMudar(null); setAberto(false); }}>Sem ícone</button>}
      </div>
    </span>
  );
}
