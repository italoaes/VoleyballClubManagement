/**
 * Mata-mata (playoffs) — regras CRAVADAS (Task 3.4).
 *
 * - Seed de cada time = posição final na liga (1 = melhor).
 * - Quartas (cruzamento olímpico): 1×8, 2×7, 3×6, 4×5.
 * - Reseeding nas semis: os 4 vencedores reordenados pela seed original;
 *   menor seed × maior seed, e os dois do meio entre si.
 * - Séries de quartas/semis: melhor de 3 jogos. Jogo 1 e 3 na casa do melhor
 *   colocado (menor seed); jogo 2 na casa do pior. Série encerra em 2 vitórias.
 * - Final: jogo único, na casa do melhor colocado.
 */

import { Rng } from "@engine/rng";
import type { EngineConfig } from "@engine/config";
import type {
  MatchResult,
  PlayoffBracket,
  PlayoffTie,
  Seeded,
  Team,
} from "./types";
import { playMatch } from "./matchAdapter";

/** Cria os 8 semeados a partir da classificação final (top 8). */
export function seedTop8(standingsOrder: string[]): Seeded[] {
  if (standingsOrder.length < 8) {
    throw new Error("classificação precisa de ao menos 8 times para o mata-mata");
  }
  return standingsOrder.slice(0, 8).map((teamId, i) => ({ teamId, seed: i + 1 }));
}

function makeTie(
  id: string,
  round: PlayoffTie["round"],
  high: Seeded,
  low: Seeded,
  bestOf: 1 | 3,
): PlayoffTie {
  // garante high = menor seed (melhor colocado)
  const [hi, lo] = high.seed <= low.seed ? [high, low] : [low, high];
  return {
    id,
    round,
    high: hi,
    low: lo,
    bestOf,
    games: [],
    winsHigh: 0,
    winsLow: 0,
    winnerId: null,
  };
}

/** Monta as quartas com cruzamento olímpico (1×8, 2×7, 3×6, 4×5). */
export function buildQuarters(seeds: Seeded[]): PlayoffTie[] {
  const bySeed = new Map(seeds.map((s) => [s.seed, s]));
  const get = (n: number): Seeded => {
    const s = bySeed.get(n);
    if (!s) throw new Error(`seed ${n} ausente`);
    return s;
  };
  return [
    makeTie("QF1", "quarter", get(1), get(8), 3),
    makeTie("QF2", "quarter", get(2), get(7), 3),
    makeTie("QF3", "quarter", get(3), get(6), 3),
    makeTie("QF4", "quarter", get(4), get(5), 3),
  ];
}

/**
 * Reseeding nas semis: dados os 4 vencedores (com sua seed original), o de
 * menor seed enfrenta o de maior; os dois do meio se enfrentam.
 */
export function buildSemis(winners: Seeded[]): PlayoffTie[] {
  if (winners.length !== 4) {
    throw new Error(`semis exigem 4 vencedores, recebeu ${winners.length}`);
  }
  const sorted = [...winners].sort((a, b) => a.seed - b.seed);
  const s0 = sorted[0]!;
  const s1 = sorted[1]!;
  const s2 = sorted[2]!;
  const s3 = sorted[3]!;
  return [
    makeTie("SF1", "semi", s0, s3, 3),
    makeTie("SF2", "semi", s1, s2, 3),
  ];
}

/** Constrói a final (jogo único) entre os 2 vencedores das semis. */
export function buildFinal(winners: Seeded[]): PlayoffTie {
  if (winners.length !== 2) {
    throw new Error(`final exige 2 vencedores, recebeu ${winners.length}`);
  }
  const [a, b] = winners;
  return makeTie("FINAL", "final", a!, b!, 1);
}

/** Retorna o mando de quadra do jogo `gameIndex` (0-based) de uma série. */
export function homeIsHighSeed(bestOf: 1 | 3, gameIndex: number): boolean {
  if (bestOf === 1) return true; // final: sempre na casa do melhor colocado
  // melhor de 3: jogo 1 (idx 0) e jogo 3 (idx 2) na casa do melhor; jogo 2 (idx 1) na casa do pior
  return gameIndex !== 1;
}

/** Resolve um confronto (série ou jogo único) por completo. */
export function resolveTie(
  tie: PlayoffTie,
  teamsById: Map<string, Team>,
  cfg: EngineConfig,
  rng: Rng,
): PlayoffTie {
  const high = teamsById.get(tie.high.teamId);
  const low = teamsById.get(tie.low.teamId);
  if (!high || !low) throw new Error("resolveTie: time inexistente");

  const winsNeeded = tie.bestOf === 1 ? 1 : 2;
  const games: MatchResult[] = [];
  let winsHigh = 0;
  let winsLow = 0;
  let gameIndex = 0;

  while (winsHigh < winsNeeded && winsLow < winsNeeded) {
    const highHosts = homeIsHighSeed(tie.bestOf, gameIndex);
    const home = highHosts ? high : low;
    const away = highHosts ? low : high;
    const result = playMatch(home, away, cfg, rng.spawn(gameIndex));
    games.push(result);
    if (result.winnerId === high.id) winsHigh += 1;
    else winsLow += 1;
    gameIndex += 1;
  }

  const winnerId = winsHigh > winsLow ? high.id : low.id;
  return { ...tie, games, winsHigh, winsLow, winnerId };
}

/**
 * Resolve UM único jogo do tie (o próximo pendente) e retorna o tie atualizado.
 * Usado no fluxo "jogo a jogo" do mata-mata. Não faz nada se o tie já terminou.
 */
export function playOneGame(
  tie: PlayoffTie,
  teamsById: Map<string, Team>,
  cfg: EngineConfig,
  rng: Rng,
): PlayoffTie {
  if (tie.winnerId) return tie;
  const high = teamsById.get(tie.high.teamId);
  const low = teamsById.get(tie.low.teamId);
  if (!high || !low) throw new Error("playOneGame: time inexistente");

  const winsNeeded = tie.bestOf === 1 ? 1 : 2;
  const gameIndex = tie.games.length;
  const highHosts = homeIsHighSeed(tie.bestOf, gameIndex);
  const home = highHosts ? high : low;
  const away = highHosts ? low : high;
  const result = playMatch(home, away, cfg, rng.spawn(gameIndex));

  const games = [...tie.games, result];
  const winsHigh = tie.winsHigh + (result.winnerId === high.id ? 1 : 0);
  const winsLow = tie.winsLow + (result.winnerId === low.id ? 1 : 0);
  const decided = winsHigh >= winsNeeded || winsLow >= winsNeeded;
  const winnerId = decided ? (winsHigh > winsLow ? high.id : low.id) : null;

  return { ...tie, games, winsHigh, winsLow, winnerId };
}

/**
 * Aplica um MatchResult JÁ produzido (ex.: partida ao vivo do jogador) ao próximo
 * jogo pendente do tie, atualizando placar/vencedor. Espelha `playOneGame`, mas
 * com o resultado vindo de fora (não simula). `result.winnerId` deve ser um dos times.
 */
export function applyPlayoffGameResult(tie: PlayoffTie, result: MatchResult): PlayoffTie {
  if (tie.winnerId) return tie;
  const winsNeeded = tie.bestOf === 1 ? 1 : 2;
  const games = [...tie.games, result];
  const winsHigh = tie.winsHigh + (result.winnerId === tie.high.teamId ? 1 : 0);
  const winsLow = tie.winsLow + (result.winnerId === tie.low.teamId ? 1 : 0);
  const decided = winsHigh >= winsNeeded || winsLow >= winsNeeded;
  const winnerId = decided ? (winsHigh > winsLow ? tie.high.teamId : tie.low.teamId) : null;
  return { ...tie, games, winsHigh, winsLow, winnerId };
}

/** true se o confronto envolve o time informado. */
export function tieHasTeam(tie: PlayoffTie, teamId: string): boolean {
  return tie.high.teamId === teamId || tie.low.teamId === teamId;
}

/** Seeded do vencedor de um tie já resolvido. */
export function tieWinnerSeeded(tie: PlayoffTie): Seeded {
  if (!tie.winnerId) throw new Error(`tie ${tie.id} não resolvido`);
  return tie.winnerId === tie.high.teamId ? tie.high : tie.low;
}

/**
 * Roda o mata-mata inteiro de uma vez (útil para simulação/validação).
 * A UI pode, alternativamente, resolver tie a tie usando as funções acima.
 */
export function runPlayoffs(
  standingsOrder: string[],
  teams: Team[],
  cfg: EngineConfig,
  rng: Rng,
): PlayoffBracket {
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const seeds = seedTop8(standingsOrder);

  const quarters = buildQuarters(seeds).map((t, i) =>
    resolveTie(t, teamsById, cfg, rng.spawn(100 + i)),
  );
  const semiWinners = quarters.map(tieWinnerSeeded);

  const semis = buildSemis(semiWinners).map((t, i) =>
    resolveTie(t, teamsById, cfg, rng.spawn(200 + i)),
  );
  const finalWinners = semis.map(tieWinnerSeeded);

  const final = resolveTie(buildFinal(finalWinners), teamsById, cfg, rng.spawn(300));

  return {
    quarters,
    semis,
    final,
    championId: final.winnerId,
  };
}
