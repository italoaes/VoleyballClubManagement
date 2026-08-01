import { useState } from "react";
import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import { teamById } from "@domain/selectors";
import { Position, type Lineup, type Player } from "@domain/types";
import { LineupError, setLineup as applyLineup } from "@domain/lineup";
import { Button, Card, ScreenHeader } from "../components/ui";

function overall(p: Player): number {
  const a = p.attributes;
  return Math.round((a.attack + a.block + a.serve + a.receive + a.setting + a.libero) / 6);
}

const FUNDAMENTALS: { key: keyof Player["attributes"]; label: string }[] = [
  { key: "attack", label: "ATA" },
  { key: "block", label: "BLO" },
  { key: "serve", label: "SAQ" },
  { key: "receive", label: "REC" },
  { key: "setting", label: "LEV" },
  { key: "libero", label: "DEF" },
];

function attrColor(v: number): string {
  if (v >= 70) return "var(--success)";
  if (v >= 55) return "var(--text)";
  return "var(--danger)";
}

/** Mostra os 6 fundamentos do jogador em barras compactas. */
function Fundamentals({ player }: { player: Player }): JSX.Element {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
      {FUNDAMENTALS.map((f) => {
        const v = player.attributes[f.key];
        return (
          <div key={f.key} style={{ textAlign: "center", minWidth: 40 }}>
            <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>{f.label}</div>
            <div style={{ fontWeight: 800, fontSize: "0.9rem", color: attrColor(v) }}>{v}</div>
            <div style={{ height: 3, background: "var(--surface-2)", borderRadius: 2 }}>
              <div
                style={{
                  height: 3,
                  width: `${v}%`,
                  background: attrColor(v),
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

type SlotKey =
  | "setter"
  | "outside0"
  | "outside1"
  | "middle0"
  | "middle1"
  | "opposite"
  | "libero";

/** Slots a preencher, na ordem exigida pela regra. */
const SLOTS: { key: SlotKey; label: string; pos: Position }[] = [
  { key: "setter", label: "Levantador", pos: Position.Setter },
  { key: "outside0", label: "Ponteiro 1", pos: Position.Outside },
  { key: "outside1", label: "Ponteiro 2", pos: Position.Outside },
  { key: "middle0", label: "Central 1", pos: Position.Middle },
  { key: "middle1", label: "Central 2", pos: Position.Middle },
  { key: "opposite", label: "Oposto", pos: Position.Opposite },
  { key: "libero", label: "Líbero", pos: Position.Libero },
];

function toLineup(sel: Record<SlotKey, string>): Lineup {
  return {
    setter: sel.setter,
    outsides: [sel.outside0, sel.outside1],
    middles: [sel.middle0, sel.middle1],
    opposite: sel.opposite,
    libero: sel.libero,
  };
}

function fromLineup(l: Lineup): Record<SlotKey, string> {
  return {
    setter: l.setter,
    outside0: l.outsides[0],
    outside1: l.outsides[1],
    middle0: l.middles[0],
    middle1: l.middles[1],
    opposite: l.opposite,
    libero: l.libero,
  };
}

export function Squad(): JSX.Element {
  const state = useGameStore((s) => s.state);
  const setLineupStore = useGameStore((s) => s.setLineup);
  const go = useNavStore((s) => s.go);

  const team = state ? teamById(state, state.playerTeamId) : undefined;
  const [sel, setSel] = useState<Record<SlotKey, string>>(
    team ? fromLineup(team.roster.lineup) : ({} as Record<SlotKey, string>),
  );
  const [error, setError] = useState<string | null>(null);

  if (!state || !team) return <p style={{ padding: "1rem" }}>Carregando…</p>;

  const chosenIds = new Set(Object.values(sel));

  const choose = (slot: SlotKey, playerId: string): void => {
    setSel((cur) => ({ ...cur, [slot]: playerId }));
    setError(null);
  };

  // se veio da tela de partida, volta pra ela; senão, ao dashboard
  const returnTo = state.phase === "league" ? "match-preview" : "dashboard";

  const save = (): void => {
    try {
      const lineup = toLineup(sel);
      applyLineup(team.roster, lineup); // valida
      setLineupStore(lineup);
      go(returnTo);
    } catch (e) {
      setError(e instanceof LineupError ? e.message : "escalação inválida");
    }
  };

  return (
    <div>
      <ScreenHeader title="Escalação" subtitle={`${team.name} · 1 lev, 2 pont, 2 cent, 1 oposto, 1 líbero`} />
      <div style={{ padding: "0 1rem 1rem", display: "flex", flexDirection: "column", gap: 12 }}>
        {SLOTS.map((slot) => {
          const options = team.roster.players.filter((p) => p.position === slot.pos);
          const current = sel[slot.key];
          const currentPlayer = team.roster.players.find((p) => p.id === current);
          return (
            <Card key={slot.key}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: 6 }}>
                {slot.label}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {options.map((p) => {
                  const isChosenHere = current === p.id;
                  const isChosenElsewhere = !isChosenHere && chosenIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => choose(slot.key, p.id)}
                      disabled={isChosenElsewhere}
                      style={{
                        padding: "0.5rem 0.7rem",
                        borderRadius: 8,
                        border: isChosenHere ? "2px solid var(--accent)" : "1px solid var(--surface-2)",
                        background: isChosenHere ? "var(--surface-2)" : "var(--bg)",
                        color: isChosenElsewhere ? "var(--text-dim)" : "var(--text)",
                        opacity: isChosenElsewhere ? 0.4 : 1,
                        cursor: isChosenElsewhere ? "not-allowed" : "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      {p.name} <strong>{overall(p)}</strong>
                    </button>
                  );
                })}
              </div>
              {currentPlayer ? <Fundamentals player={currentPlayer} /> : null}
            </Card>
          );
        })}

        {error ? <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</p> : null}

        <Button onClick={save}>Confirmar escalação</Button>
        <Button variant="ghost" onClick={() => go(returnTo)}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
