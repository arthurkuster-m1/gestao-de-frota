import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", block, loading, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx("ds-btn", `ds-btn--${variant}`, size !== "md" && `ds-btn--${size}`, block && "ds-btn--block", className)}
      {...rest}
    >
      {loading ? <span className="ds-spinner" aria-hidden /> : icon}
      {children}
    </button>
  );
});
