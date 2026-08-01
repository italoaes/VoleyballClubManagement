/**
 * Componentes reutilizáveis mobile-first (o "design system" mínimo do MVP).
 */

import type { CSSProperties, ReactNode } from "react";
import { assetUrl } from "../asset";

export function Card({
  children,
  style,
  onClick,
}: {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
}): JSX.Element {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface)",
        borderRadius: 12,
        padding: "0.9rem 1rem",
        border: "1px solid var(--surface-2)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  style?: CSSProperties;
}): JSX.Element {
  const bg =
    variant === "primary"
      ? "var(--accent)"
      : variant === "secondary"
        ? "var(--accent-2)"
        : "transparent";
  const color = variant === "ghost" ? "var(--text-dim)" : "#0b1b2b";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg,
        color: variant === "ghost" ? "var(--text)" : color,
        border: variant === "ghost" ? "1px solid var(--surface-2)" : "none",
        borderRadius: 10,
        padding: "0.85rem 1.1rem",
        fontSize: "1rem",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        width: "100%",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }): JSX.Element {
  return (
    <header style={{ padding: "1rem 1rem 0.5rem" }}>
      <h1 style={{ fontSize: "1.35rem", color: "var(--accent)" }}>{title}</h1>
      {subtitle ? (
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{subtitle}</p>
      ) : null}
    </header>
  );
}

/** Escudo do time (imagem). Faz fallback para a sigla se a imagem não carregar. */
export function TeamBadge({
  shortName,
  crest,
  size = 40,
}: {
  shortName: string;
  crest?: string | undefined;
  size?: number;
}): JSX.Element {
  if (crest) {
    return (
      <img
        src={assetUrl(crest)}
        alt={shortName}
        width={size}
        height={size}
        style={{ objectFit: "contain", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: "var(--surface-2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.32,
        color: "var(--text)",
        flexShrink: 0,
      }}
    >
      {shortName}
    </div>
  );
}

/** Nível do time em estrelas (usa a imagem star.png). */
export function StarRating({ stars, size = 14 }: { stars: number; size?: number }): JSX.Element {
  return (
    <div style={{ display: "flex", gap: 2 }} aria-label={`${stars} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, i) => (
        <img
          key={i}
          src={assetUrl("/assets/ui/star.png")}
          alt=""
          width={size}
          height={size}
          style={{ opacity: i < stars ? 1 : 0.2, objectFit: "contain" }}
        />
      ))}
    </div>
  );
}

/** Barra de forma recente (V/D) dos últimos jogos. */
export function FormBar({ form }: { form: ("V" | "D")[] }): JSX.Element {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {form.map((r, i) => (
        <span
          key={i}
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            fontSize: 10,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: r === "V" ? "var(--success)" : "var(--danger)",
            color: "#08131f",
          }}
        >
          {r}
        </span>
      ))}
    </div>
  );
}
