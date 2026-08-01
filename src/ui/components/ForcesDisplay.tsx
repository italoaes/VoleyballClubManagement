/**
 * Exibição das forças ATK/DEF de um time (a partir do roster/escalação).
 * Mostra os mesmos números que o motor usa, para o jogador ver o efeito das
 * suas decisões (desenvolvimento, escalação, substituições) em tempo real.
 */

import { rosterForces } from "@domain/strength";
import type { Category, Roster } from "@domain/types";

/** Faixa de força esperada (elenco de elite ~52..76) para normalizar a barra. */
const MIN = 45;
const MAX = 80;

function pct(v: number): number {
  return Math.max(4, Math.min(100, ((v - MIN) / (MAX - MIN)) * 100));
}

function Row({ label, value, color }: { label: string; value: number; color: string }): JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 34, fontSize: "0.72rem", color: "var(--text-dim)", fontWeight: 700 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 8, background: "var(--bg)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: 8, width: `${pct(value)}%`, background: color, borderRadius: 4 }} />
      </div>
      <span style={{ width: 34, textAlign: "right", fontWeight: 800, fontSize: "0.85rem" }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

/**
 * Barras de ATK e DEF do roster. Compacto por padrão; use `title` para rotular
 * (ex.: nome do time na tela de partida).
 */
export function ForcesDisplay({
  roster,
  category = "male",
  title,
}: {
  roster: Roster;
  category?: Category;
  title?: string;
}): JSX.Element {
  const f = rosterForces(roster, category);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {title ? (
        <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", fontWeight: 700 }}>{title}</span>
      ) : null}
      <Row label="ATK" value={f.atk} color="var(--accent)" />
      <Row label="DEF" value={f.def} color="var(--accent-2)" />
    </div>
  );
}
