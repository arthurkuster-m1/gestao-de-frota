import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../cx";

type CardProps = HTMLAttributes<HTMLDivElement> & { tone?: "default" | "brand"; flush?: boolean };

export function Card({ tone = "default", flush, className, ...rest }: CardProps) {
  return <div className={cx("ds-card", tone === "brand" && "ds-card--brand", flush && "ds-card--flush", className)} {...rest} />;
}

/** Card clicável (tile de app, item de lista): é um <button> de verdade, com foco e teclado. */
export function CardButton({ className, ...rest }: HTMLAttributes<HTMLButtonElement> & { disabled?: boolean; onClick?: () => void }) {
  return <button type="button" className={cx("ds-card", "ds-card--interactive", className)} {...rest} />;
}

export function IconChip({ children }: { children: ReactNode }) {
  return <span className="ds-iconchip" aria-hidden>{children}</span>;
}
