/**
 * Liga: calendário (turno-returno) e simulação de rodada.
 *
 * 12 times, ida-e-volta => 22 rodadas, cada time joga 22 jogos (132 no total).
 * O time do jogador usa sua escalação; os demais são auto-escalados (já vêm com
 * courtIds definidos pela geração).
 */

import { Rng } from "@engine/rng";
import type { EngineConfig } from "@engine/config";
import type { Fixture, MatchResult, Team } from "./types";
import { playMatch } from "./matchAdapter";

/**
 * Gera o calendário de turno-returno usando o algoritmo do círculo
 * (round-robin). Para N par, são N-1 rodadas por turno × 2 turnos.
 * No returno, inverte-se o mando de quadra.
 */
export function generateFixtures(teamIds: string[]): Fixture[] {
  const n = teamIds.length;
  if (n < 2 || n % 2 !== 0) {
    throw new Error(`número de times deve ser par e >= 2 (recebido ${n})`);
  }

  const rotation = [...teamIds];
  const roundsPerLeg = n - 1;
  const half = n / 2;
  const fixtures: Fixture[] = [];

  for (let leg = 0; leg < 2; leg++) {
    // reinicia a rotação a cada turno para espelhar o mesmo pareamento
    const arr = [...teamIds];
    for (let round = 0; round < roundsPerLeg; round++) {
      const roundNumber = leg * roundsPerLeg + round + 1;
      for (let i = 0; i < half; i++) {
        const a = arr[i];
        const b = arr[n - 1 - i];
        if (a === undefined || b === undefined) continue;
        // turno 1: a manda; turno 2: b manda (inverte)
        const homeId = leg === 0 ? a : b;
        const awayId = leg === 0 ? b : a;
        fixtures.push({ round: roundNumber, homeId, awayId, result: null });
      }
      // rotaciona mantendo o primeiro fixo (algoritmo do círculo)
      const fixed = arr[0]!;
      const rest = arr.slice(1);
      rest.unshift(rest.pop()!);
      arr.splice(0, arr.length, fixed, ...rest);
    }
  }

  void rotation;
  return fixtures;
}

/** Número total de rodadas de uma liga de turno-returno. */
export function totalRounds(numTeams: number): number {
  return (numTeams - 1) * 2;
}

/**
 * Simula todas as partidas de uma rodada, retornando os resultados.
 * O RNG-mãe deriva um sub-stream por partida (reprodutível).
 */
export function simulateRound(
  round: number,
  fixtures: Fixture[],
  teamsById: Map<string, Team>,
  cfg: EngineConfig,
  rng: Rng,
  /** id de time cujo jogo NÃO deve ser auto-simulado (vem da partida ao vivo). */
  skipTeamId?: string,
): Map<number, MatchResult> {
  const results = new Map<number, MatchResult>();
  fixtures.forEach((fx, idx) => {
    if (fx.round !== round || fx.result !== null) return;
    if (skipTeamId && (fx.homeId === skipTeamId || fx.awayId === skipTeamId)) return;
    const home = teamsById.get(fx.homeId);
    const away = teamsById.get(fx.awayId);
    if (!home || !away) {
      throw new Error(`fixture com time inexistente: ${fx.homeId} x ${fx.awayId}`);
    }
    const child = rng.spawn(idx);
    results.set(idx, playMatch(home, away, cfg, child));
  });
  return results;
}

/** Índice do fixture do time na rodada corrente (ou -1). */
export function playerFixtureIndex(
  round: number,
  fixtures: Fixture[],
  teamId: string,
): number {
  return fixtures.findIndex(
    (fx) => fx.round === round && (fx.homeId === teamId || fx.awayId === teamId),
  );
}
