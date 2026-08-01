/**
 * Visão de elenco de OUTRO time (read-only) — scouting. Mostra as forças ATK/DEF,
 * o nível em estrelas e a lista de atletas com overall e fundamentos.
 */

import { useState } from "react";
import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import { teamById, teamStars } from "@domain/selectors";
import { playerOverall } from "@domain/development";
import { Position, type Player } from "@domain/types";
import { Button, Card, ScreenHeader, StarRating, TeamBadge } from "../components/ui";
import { ForcesDisplay } from "../components/ForcesDisplay";

const POS_ABBR: Record<Position, string> = {
  [Position.Setter]: "LEV",
  [Position.Outside]: "PON",
  [Position.Middle]: "CEN",
  [Position.Opposite]: "OPO",
  [Position.Libero]: "LIB",
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

function PlayerRow({ player, expanded, onToggle }: { player: Player; expanded: boolean; onToggle: () => void }): JSX.Element {
  const ovr = playerOverall(player);
  return (
    <Card style={{ marginBottom: 6 }} onClick={onToggle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <div
          style={{
            fontSize: "0.62rem",
            fontWeight: 800,
            color: "var(--text-dim)",
            width: 30,
            textAlign: "center",
          }}
        >
          {POS_ABBR[player.position]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
            {player.isStar ? "⭐ " : ""}
            {player.name}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{player.age} anos</div>
        </div>
        <div style={{ fontWeight: 800, fontSize: "1.2rem", color: ovrColor(ovr) }}>{ovr}</div>
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

export function TeamView(): JSX.Element {
  const state = useGameStore((s) => s.state);
  const viewTeamId = useNavStore((s) => s.viewTeamId);
  const returnTo = useNavStore((s) => s.viewReturnTo);
  const go = useNavStore((s) => s.go);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!state) return <p style={{ padding: "1rem" }}>Carregando...</p>;
  const team = viewTeamId ? teamById(state, viewTeamId) : undefined;
  if (!team) {
    return (
      <div>
        <ScreenHeader title="Elenco" />
        <div style={{ padding: "1rem" }}>
          <p style={{ color: "var(--text-dim)" }}>Time não encontrado.</p>
          <Button variant="ghost" onClick={() => go(returnTo)} style={{ marginTop: 12 }}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const players = [...team.roster.players].sort((a, b) => playerOverall(b) - playerOverall(a));

  return (
    <div>
      <ScreenHeader title={team.name} subtitle="Elenco (scouting)" />
      <div style={{ padding: "0 1rem 1rem" }}>
        <Card style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
          <TeamBadge shortName={team.shortName} crest={team.crest} size={48} />
          <div style={{ flex: 1 }}>
            <StarRating stars={teamStars(team, state.category)} size={13} />
            <div style={{ marginTop: 8 }}>
              <ForcesDisplay roster={team.roster} category={state.category} />
            </div>
          </div>
        </Card>

        {players.map((p) => (
          <PlayerRow
            key={p.id}
            player={p}
            expanded={expanded === p.id}
            onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
          />
        ))}

        <Button variant="ghost" onClick={() => go(returnTo)} style={{ marginTop: 8 }}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
