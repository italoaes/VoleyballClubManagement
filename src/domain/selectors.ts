/**
 * Seletores derivados do GameState para a UI (funções puras de leitura).
 */

import { teamStarsFromTeam } from "./strength";
import type { Category, Fixture, GameState, Standing, Team } from "./types";

export function teamById(state: GameState, id: string): Team | undefined {
  return state.teams.find((t) => t.id === id);
}

/** Nível do time em ESTRELAS (1 a 5). Reexporta a lógica pura de strength.ts. */
export function teamStars(team: Team, category: Category = "male"): number {
  return teamStarsFromTeam(team, category);
}

export function standingOf(state: GameState, teamId: string): Standing | undefined {
  return state.standings.find((s) => s.teamId === teamId);
}

export function positionOf(state: GameState, teamId: string): number {
  const idx = state.standings.findIndex((s) => s.teamId === teamId);
  return idx < 0 ? 0 : idx + 1;
}

/** Próximo fixture não jogado envolvendo o time do jogador. */
export function nextPlayerFixture(state: GameState): Fixture | null {
  return (
    state.fixtures.find(
      (f) =>
        f.result === null &&
        f.round === state.currentRound &&
        (f.homeId === state.playerTeamId || f.awayId === state.playerTeamId),
    ) ?? null
  );
}

/** Últimos N resultados do time (V/D), do mais antigo ao mais recente. */
export function recentForm(state: GameState, teamId: string, n = 5): ("V" | "D")[] {
  const played = state.fixtures.filter(
    (f) => f.result !== null && (f.homeId === teamId || f.awayId === teamId),
  );
  const form = played.map<"V" | "D">((f) => (f.result!.winnerId === teamId ? "V" : "D"));
  return form.slice(-n);
}

/** Rodadas que já têm ao menos um jogo concluído (para o histórico de resultados). */
export function playedRounds(state: GameState): number[] {
  const rounds = new Set<number>();
  for (const f of state.fixtures) {
    if (f.result) rounds.add(f.round);
  }
  return [...rounds].sort((a, b) => a - b);
}

/** Fixtures concluídos de uma rodada específica. */
export function resultsForRound(state: GameState, round: number): Fixture[] {
  return state.fixtures.filter((f) => f.round === round && f.result !== null);
}

/** Último resultado do time do jogador (para a tela de resultado). */
export function lastPlayerResult(state: GameState): Fixture | null {
  const played = state.fixtures.filter(
    (f) =>
      f.result !== null &&
      (f.homeId === state.playerTeamId || f.awayId === state.playerTeamId),
  );
  return played.length > 0 ? played[played.length - 1]! : null;
}
