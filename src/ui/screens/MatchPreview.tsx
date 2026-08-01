import { useGameStore } from "@state/gameStore";
import { useMatchStore } from "@state/matchStore";
import { useNavStore } from "@state/navStore";
import {
  nextPlayerFixture,
  positionOf,
  recentForm,
  teamById,
  teamStars,
} from "@domain/selectors";
import { simulateFullMatch } from "@domain/liveMatch";
import type { GameState, Team } from "@domain/types";
import { Button, Card, FormBar, ScreenHeader, StarRating, TeamBadge } from "../components/ui";

function TeamColumn({ team, state }: { team: Team; state: GameState }): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
      <TeamBadge shortName={team.shortName} crest={team.crest} size={64} />
      <strong style={{ fontSize: "0.85rem", textAlign: "center" }}>{team.name}</strong>
      <StarRating stars={teamStars(team, state.category)} size={13} />
      <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
        {positionOf(state, team.id)}º na tabela
      </span>
      <FormBar form={recentForm(state, team.id)} />
    </div>
  );
}

export function MatchPreview(): JSX.Element {
  const state = useGameStore((s) => s.state);
  const commitRound = useGameStore((s) => s.commitRound);
  const begin = useMatchStore((s) => s.begin);
  const go = useNavStore((s) => s.go);

  if (!state) return <p style={{ padding: "1rem" }}>Carregando…</p>;

  const fx = nextPlayerFixture(state);
  if (!fx) {
    return (
      <div>
        <ScreenHeader title="Próxima partida" />
        <div style={{ padding: "1rem" }}>
          <p style={{ color: "var(--text-dim)" }}>Nenhuma partida pendente nesta rodada.</p>
          <Button variant="ghost" onClick={() => go("dashboard")} style={{ marginTop: 12 }}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const home = teamById(state, fx.homeId)!;
  const away = teamById(state, fx.awayId)!;
  const playerIsHome = fx.homeId === state.playerTeamId;
  const opponent = playerIsHome ? away : home;
  const playerTeam = teamById(state, state.playerTeamId)!;
  const baseSeed = state.seed + state.currentRound * 7919;

  const playMatch = (): void => {
    begin(state.category, playerTeam, opponent, playerIsHome, baseSeed);
    go("live-match");
  };

  const simulateMatch = (): void => {
    const result = simulateFullMatch(state.category, playerTeam, opponent, playerIsHome, baseSeed);
    commitRound(result);
    go("standings");
  };

  return (
    <div>
      <ScreenHeader title="Próxima partida" subtitle={`Rodada ${fx.round}`} />
      <div style={{ padding: "0 1rem 1rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <TeamColumn team={home} state={state} />
            <span style={{ color: "var(--text-dim)", fontWeight: 800, padding: "0 0.4rem" }}>x</span>
            <TeamColumn team={away} state={state} />
          </div>
          <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "0.75rem", marginTop: 10 }}>
            {playerIsHome ? "Você joga em casa" : "Você joga fora"}
          </p>
        </Card>

        <Button variant="secondary" onClick={() => go("squad")}>
          Escalar time
        </Button>
        <Button onClick={playMatch}>JOGAR PARTIDA</Button>
        <Button variant="ghost" onClick={simulateMatch}>
          Simular partida
        </Button>
        <Button variant="ghost" onClick={() => go("dashboard")}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
