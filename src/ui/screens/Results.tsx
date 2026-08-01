import { useState } from "react";
import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import { playedRounds, resultsForRound, teamById } from "@domain/selectors";
import { Button, Card, ScreenHeader, TeamBadge } from "../components/ui";

export function Results(): JSX.Element {
  const state = useGameStore((s) => s.state);
  const go = useNavStore((s) => s.go);

  const rounds = state ? playedRounds(state) : [];
  const [round, setRound] = useState<number>(rounds[rounds.length - 1] ?? 1);

  if (!state) return <p style={{ padding: "1rem" }}>Carregando...</p>;

  if (rounds.length === 0) {
    return (
      <div>
        <ScreenHeader title="Resultados" />
        <div style={{ padding: "1rem" }}>
          <p style={{ color: "var(--text-dim)" }}>Nenhuma rodada jogada ainda.</p>
          <Button variant="ghost" onClick={() => go("dashboard")} style={{ marginTop: 12 }}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const activeRound = rounds.includes(round) ? round : rounds[rounds.length - 1]!;
  const fixtures = resultsForRound(state, activeRound);

  return (
    <div>
      <ScreenHeader title="Resultados" subtitle={`Rodada ${activeRound}`} />
      <div style={{ padding: "0 1rem 1rem" }}>
        {/* seletor de rodada */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 8 }}>
          {rounds.map((r) => (
            <button
              key={r}
              onClick={() => setRound(r)}
              style={{
                padding: "0.35rem 0.7rem",
                borderRadius: 8,
                border: r === activeRound ? "2px solid var(--accent)" : "1px solid var(--surface-2)",
                background: r === activeRound ? "var(--surface-2)" : "var(--bg)",
                color: "var(--text)",
                cursor: "pointer",
                fontSize: "0.8rem",
                flexShrink: 0,
              }}
            >
              R{r}
            </button>
          ))}
        </div>

        {fixtures.map((f, i) => {
          const home = teamById(state, f.homeId)!;
          const away = teamById(state, f.awayId)!;
          const r = f.result!;
          const isPlayerMatch = f.homeId === state.playerTeamId || f.awayId === state.playerTeamId;
          return (
            <Card
              key={i}
              style={{
                marginBottom: 6,
                border: isPlayerMatch ? "1px solid var(--accent-2)" : "1px solid var(--surface-2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  <TeamBadge shortName={home.shortName} crest={home.crest} size={22} />
                  <span style={{ fontWeight: r.winnerId === home.id ? 800 : 400 }}>{home.shortName}</span>
                </span>
                <strong style={{ fontSize: "1.05rem" }}>
                  {r.setsHome} - {r.setsAway}
                </strong>
                <span style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>
                  <span style={{ fontWeight: r.winnerId === away.id ? 800 : 400 }}>{away.shortName}</span>
                  <TeamBadge shortName={away.shortName} crest={away.crest} size={22} />
                </span>
              </div>
            </Card>
          );
        })}

        <Button variant="ghost" onClick={() => go("dashboard")} style={{ marginTop: 10 }}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
