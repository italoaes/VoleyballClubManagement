/**
 * Classificação da liga (contrato A8).
 *
 * Pontuação FIVB: 3-0/3-1 => 3/0; 3-2 => 2/1.
 * Desempate: pontos > vitórias > razão de sets > razão de pontos de rally >
 * confronto direto > seed determinístico (força pré-jogo / ordem estável).
 */

import type { Fixture, MatchResult, Standing, Team } from "./types";

export function emptyStanding(teamId: string): Standing {
  return {
    teamId,
    points: 0,
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    rallyPointsFor: 0,
    rallyPointsAgainst: 0,
  };
}

function setRatio(s: Standing): number {
  if (s.setsLost === 0) return s.setsWon > 0 ? s.setsWon : 1;
  return s.setsWon / s.setsLost;
}

function pointRatio(s: Standing): number {
  if (s.rallyPointsAgainst === 0) return s.rallyPointsFor > 0 ? s.rallyPointsFor : 1;
  return s.rallyPointsFor / s.rallyPointsAgainst;
}

/** Aplica um resultado de partida às standings dos dois times. */
export function applyResult(
  result: MatchResult,
  standings: Map<string, Standing>,
): void {
  const home = standings.get(result.homeId);
  const away = standings.get(result.awayId);
  if (!home || !away) {
    throw new Error("applyResult: standing ausente para um dos times");
  }

  const winner = result.winnerId === result.homeId ? home : away;
  const loser = result.winnerId === result.homeId ? away : home;

  if (result.wentToTiebreak) {
    winner.points += 2;
    loser.points += 1;
  } else {
    winner.points += 3;
    // loser += 0
  }
  winner.wins += 1;
  loser.losses += 1;

  home.setsWon += result.setsHome;
  home.setsLost += result.setsAway;
  away.setsWon += result.setsAway;
  away.setsLost += result.setsHome;

  home.rallyPointsFor += result.totalPointsHome;
  home.rallyPointsAgainst += result.totalPointsAway;
  away.rallyPointsFor += result.totalPointsAway;
  away.rallyPointsAgainst += result.totalPointsHome;
}

/** Recalcula todas as standings a partir do zero, com base nos fixtures jogados. */
export function computeStandings(teams: Team[], fixtures: Fixture[]): Standing[] {
  const map = new Map<string, Standing>();
  for (const t of teams) {
    map.set(t.id, emptyStanding(t.id));
  }
  for (const fx of fixtures) {
    if (fx.result) {
      applyResult(fx.result, map);
    }
  }
  return rankStandings([...map.values()], fixtures, teams);
}

/** Saldo de confronto direto entre dois times (+1 se A leva vantagem). */
function headToHead(aId: string, bId: string, fixtures: Fixture[]): number {
  let aWins = 0;
  let bWins = 0;
  for (const fx of fixtures) {
    if (!fx.result) continue;
    const ids = new Set([fx.homeId, fx.awayId]);
    if (ids.has(aId) && ids.has(bId)) {
      if (fx.result.winnerId === aId) aWins += 1;
      else if (fx.result.winnerId === bId) bWins += 1;
    }
  }
  return Math.sign(aWins - bWins);
}

/** Ordena as standings pelos critérios de desempate (A8). */
export function rankStandings(
  standings: Standing[],
  fixtures: Fixture[],
  teams: Team[],
): Standing[] {
  // ordem estável de fallback: ordem de declaração dos times
  const orderIndex = new Map(teams.map((t, i) => [t.id, i]));

  return [...standings].sort((x, y) => {
    if (x.points !== y.points) return y.points - x.points;
    if (x.wins !== y.wins) return y.wins - x.wins;
    const sr = setRatio(y) - setRatio(x);
    if (Math.abs(sr) > 1e-9) return sr;
    const pr = pointRatio(y) - pointRatio(x);
    if (Math.abs(pr) > 1e-9) return pr;
    const h2h = headToHead(x.teamId, y.teamId, fixtures);
    if (h2h !== 0) return -h2h;
    return (orderIndex.get(x.teamId) ?? 0) - (orderIndex.get(y.teamId) ?? 0);
  });
}
