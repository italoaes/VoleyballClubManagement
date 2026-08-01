import { useState } from "react";
import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import { teamById } from "@domain/selectors";
import { playerOverall } from "@domain/development";
import { Position, type Player } from "@domain/types";
import { Button, Card, ScreenHeader } from "../components/ui";

const POS_ABBR: Record<Position, string> = {
  [Position.Setter]: "LEV",
  [Position.Outside]: "PON",
  [Position.Middle]: "CEN",
  [Position.Opposite]: "OPO",
  [Position.Libero]: "LIB",
};

const POS_COLOR: Record<Position, string> = {
  [Position.Setter]: "#1e88e5",
  [Position.Outside]: "#ff7a1a",
  [Position.Middle]: "#35c46a",
  [Position.Opposite]: "#e5484d",
  [Position.Libero]: "#f5c518",
};

const FUNDAMENTALS: { key: keyof Player["attributes"]; label: string }[] = [
  { key: "attack", label: "ATA" },
  { key: "block", label: "BLO" },
  { key: "serve", label: "SAQ" },
  { key: "receive", label: "REC" },
  { key: "setting", label: "LEV" },
  { key: "libero", label: "DEF" },
];

function ovrColor(v: number): string {
  if (v >= 72) return "var(--success)";
  if (v >= 60) return "var(--accent)";
  return "var(--danger)";
}

/** Barra de potencial: preenchida = overall atual; trilho = potencial. */
function PotentialBar({ current, potential }: { current: number; potential: number }): JSX.Element {
  const pct = Math.min(100, (current / 99) * 100);
  const potPct = Math.min(100, (potential / 99) * 100);
  return (
    <div style={{ position: "relative", height: 6, background: "var(--bg)", borderRadius: 3, marginTop: 6 }}>
      {/* teto de potencial */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: 6,
          width: `${potPct}%`,
          background: "var(--surface-2)",
          borderRadius: 3,
        }}
      />
      {/* overall atual */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: 6,
          width: `${pct}%`,
          background: "var(--accent-2)",
          borderRadius: 3,
        }}
      />
    </div>
  );
}

function PlayerRow({ player, expanded, onToggle }: { player: Player; expanded: boolean; onToggle: () => void }): JSX.Element {
  const ovr = playerOverall(player);
  const canGrow = ovr < player.potential;
  return (
    <Card style={{ marginBottom: 6 }} onClick={onToggle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        {/* número + posição */}
        <div style={{ textAlign: "center", width: 40 }}>
          <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{player.number}</div>
          <div
            style={{
              fontSize: "0.62rem",
              fontWeight: 800,
              color: "#08131f",
              background: POS_COLOR[player.position],
              borderRadius: 4,
              padding: "1px 0",
            }}
          >
            {POS_ABBR[player.position]}
          </div>
        </div>

        {/* nome + idade + barra */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{player.name}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
            {player.age} anos{canGrow ? " · em evolução" : ""}
          </div>
          <PotentialBar current={ovr} potential={player.potential} />
        </div>

        {/* overall */}
        <div
          style={{
            fontWeight: 800,
            fontSize: "1.3rem",
            color: ovrColor(ovr),
            minWidth: 34,
            textAlign: "right",
          }}
        >
          {ovr}
        </div>
      </div>

      {expanded ? (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
          {FUNDAMENTALS.map((f) => (
            <div key={f.key} style={{ textAlign: "center", minWidth: 42 }}>
              <div style={{ fontSize: "0.62rem", color: "var(--text-dim)" }}>{f.label}</div>
              <div style={{ fontWeight: 800, color: ovrColor(player.attributes[f.key]) }}>
                {player.attributes[f.key]}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

export function Roster(): JSX.Element {
  const state = useGameStore((s) => s.state);
  const go = useNavStore((s) => s.go);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!state) return <p style={{ padding: "1rem" }}>Carregando...</p>;
  const team = teamById(state, state.playerTeamId)!;

  // ordena por overall desc
  const players = [...team.roster.players].sort((a, b) => playerOverall(b) - playerOverall(a));

  return (
    <div>
      <ScreenHeader title="Plantel" subtitle={`${team.name} · ${players.length} atletas`} />
      <div style={{ padding: "0 1rem 1rem" }}>
        {players.map((p) => (
          <PlayerRow
            key={p.id}
            player={p}
            expanded={expanded === p.id}
            onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
          />
        ))}

        <Button onClick={() => go("development")} style={{ marginTop: 10 }}>
          Desenvolvimento do elenco
        </Button>
        <Button variant="ghost" onClick={() => go("dashboard")} style={{ marginTop: 8 }}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
