import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import { teamById } from "@domain/selectors";
import type { GameState, PlayoffTie } from "@domain/types";
import { Button, Card, ScreenHeader, TeamBadge } from "../components/ui";

function TieRow({ tie, state }: { tie: PlayoffTie; state: GameState }): JSX.Element {
  const high = teamById(state, tie.high.teamId);
  const low = teamById(state, tie.low.teamId);
  const decided = tie.winnerId !== null;
  const line = (
    team: ReturnType<typeof teamById>,
    seed: number,
    wins: number,
    isWinner: boolean,
    isPlayer: boolean,
  ): JSX.Element => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontWeight: isWinner || isPlayer ? 800 : 400,
        color: isWinner ? "var(--accent)" : isPlayer ? "var(--accent-2)" : "var(--text)",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <TeamBadge shortName={team?.shortName ?? "?"} crest={team?.crest} size={20} />
        {seed}. {team?.shortName ?? "?"}
      </span>
      <span>{decided ? wins : "-"}</span>
    </div>
  );
  return (
    <Card style={{ marginBottom: 8 }}>
      {line(high, tie.high.seed, tie.winsHigh, tie.winnerId === tie.high.teamId, tie.high.teamId === state.playerTeamId)}
      {line(low, tie.low.seed, tie.winsLow, tie.winnerId === tie.low.teamId, tie.low.teamId === state.playerTeamId)}
      <div style={{ color: "var(--text-dim)", fontSize: "0.72rem", marginTop: 4 }}>
        {tie.bestOf === 1 ? "Jogo único" : "Melhor de 3"} · {tie.games.length} jogo(s)
      </div>
      {tie.games.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {tie.games.map((g, i) => {
            // placar sempre na ótica do high seed
            const highIsHome = g.homeId === tie.high.teamId;
            const highSets = highIsHome ? g.setsHome : g.setsAway;
            const lowSets = highIsHome ? g.setsAway : g.setsHome;
            return (
              <span
                key={i}
                style={{
                  fontSize: "0.78rem",
                  padding: "1px 7px",
                  borderRadius: 6,
                  background: "var(--bg)",
                  border: "1px solid var(--surface-2)",
                }}
              >
                {highSets}-{lowSets}
              </span>
            );
          })}
        </div>
      ) : null}
    </Card>
  );
}

function Section({ title, ties, state }: { title: string; ties: PlayoffTie[]; state: GameState }): JSX.Element | null {
  if (ties.length === 0) return null;
  return (
    <div style={{ marginBottom: "1rem" }}>
      <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", margin: "0 0 6px" }}>{title}</p>
      {ties.map((t) => (
        <TieRow key={t.id} tie={t} state={state} />
      ))}
    </div>
  );
}

export function PlayoffBracket(): JSX.Element {
  const state = useGameStore((s) => s.state);
  const advance = useGameStore((s) => s.advance);
  const go = useNavStore((s) => s.go);
  if (!state) return <p style={{ padding: "1rem" }}>Carregando…</p>;

  const bracket = state.playoffs;
  if (!bracket) {
    return (
      <div>
        <ScreenHeader title="Playoffs da Liga" />
        <div style={{ padding: "1rem" }}>
          <p style={{ color: "var(--text-dim)" }}>Os playoffs ainda não começaram.</p>
          <Button variant="ghost" onClick={() => go("dashboard")} style={{ marginTop: 12 }}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const onAdvance = (): void => {
    advance();
    const after = useGameStore.getState().state!;
    if (after.pendingPlayoffGame) {
      // é a vez do jogador: abre a prévia (jogar/simular)
      go("match-preview");
    } else if (after.phase === "finished") {
      go("season-end");
    }
  };

  return (
    <div>
      <ScreenHeader title="Playoffs da Liga" />
      <div style={{ padding: "0 1rem 1rem" }}>
        <Section title="QUARTAS DE FINAL" ties={bracket.quarters} state={state} />
        <Section title="SEMIFINAIS" ties={bracket.semis} state={state} />
        {bracket.final ? <Section title="FINAL" ties={[bracket.final]} state={state} /> : null}

        {state.phase === "playoffs" ? (
          <Button onClick={onAdvance}>PRÓXIMA PARTIDA</Button>
        ) : (
          <Button onClick={() => go("season-end")}>Ver campeão</Button>
        )}
        <Button variant="ghost" onClick={() => go("dashboard")} style={{ marginTop: 8 }}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
