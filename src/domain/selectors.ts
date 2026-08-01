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

/** Rodadas ainda NÃO jogadas (com ao menos um fixture pendente), em ordem. */
export function upcomingRounds(state: GameState, limit?: number): number[] {
  const rounds = new Set<number>();
  for (const f of state.fixtures) {
    if (f.result === null) rounds.add(f.round);
  }
  const sorted = [...rounds].sort((a, b) => a - b);
  return limit != null ? sorted.slice(0, limit) : sorted;
}

/** Fixtures ainda não jogados de uma rodada específica (próximos adversários). */
export function fixturesForRound(state: GameState, round: number): Fixture[] {
  return state.fixtures.filter((f) => f.round === round && f.result === null);
}

/** Confronto de playoff do jogador aguardando disputa (opponent + mando + seed). */
export function pendingPlayoffMatchup(state: GameState): {
  opponent: Team;
  playerIsHome: boolean;
  baseSeed: number;
} | null {
  const pending = state.pendingPlayoffGame;
  const bracket = state.playoffs;
  if (!pending || !bracket) return null;
  const allTies = [...bracket.quarters, ...bracket.semis, ...(bracket.final ? [bracket.final] : [])];
  const tie = allTies.find((t) => t.id === pending.tieId);
  if (!tie) return null;
  const opponentId = tie.high.teamId === state.playerTeamId ? tie.low.teamId : tie.high.teamId;
  const opponent = teamById(state, opponentId);
  if (!opponent) return null;
  // seed determinística estável para o jogo do jogador
  const baseSeed = state.seed + pending.gameIndex * 131 + tie.id.length * 17;
  return { opponent, playerIsHome: pending.playerIsHome, baseSeed };
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
