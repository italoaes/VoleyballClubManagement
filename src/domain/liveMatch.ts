/**
 * Partida "ao vivo" — jogada set a set, com pausa para substituições.
 *
 * Usada só na partida do time do JOGADOR. As demais partidas da rodada são
 * simuladas de uma vez pela camada de liga. O motor continua recebendo apenas
 * forças; aqui orquestramos a sequência de sets e as substituições.
 */

import { matchConfig } from "./matchAdapter";
import { courtAverages } from "./lineup";
import { effectiveForces, type Forces } from "@engine/forces";
import { simulateSet, type EngineSetResult } from "@engine/match";
import { Rng } from "@engine/rng";
import type { Category, MatchResult, SetResult, Team } from "./types";
import { pickMatchMvp } from "./mvp";

export const MAX_SUBS_PER_BREAK = 2;

export interface LiveSetSummary {
  index: number; // 0-based
  pointsPlayer: number;
  pointsOpponent: number;
  playerWon: boolean;
  isTiebreak: boolean;
}

/** Estado de uma partida ao vivo (transitório, na store de partida). */
export interface LiveMatchState {
  category: Category;
  playerTeam: Team; // cópia mutável (substituições alteram o roster)
  opponent: Team;
  playerIsHome: boolean;
  baseSeed: number; // seed determinística da partida
  sets: LiveSetSummary[];
  setsPlayer: number;
  setsOpponent: number;
  finished: boolean;
}

function opponentForces(opponent: Team, cfg = matchConfig("male")): Forces {
  return effectiveForces(courtAverages(opponent.roster), cfg, false);
}

/** Cria o estado inicial de uma partida ao vivo. */
export function createLiveMatch(
  category: Category,
  playerTeam: Team,
  opponent: Team,
  playerIsHome: boolean,
  baseSeed: number,
): LiveMatchState {
  return {
    category,
    playerTeam,
    opponent,
    playerIsHome,
    baseSeed,
    sets: [],
    setsPlayer: 0,
    setsOpponent: 0,
    finished: false,
  };
}

/** Simula o próximo set e retorna o novo estado (imutável). */
export function playNextSet(state: LiveMatchState): LiveMatchState {
  if (state.finished) return state;

  const cfg = matchConfig(state.category);
  const setNumber = state.sets.length + 1;
  const limit = setNumber === 5 ? cfg.tiebreakPoints : cfg.setPoints;

  // forças recalculadas a cada set (refletem substituições feitas no intervalo)
  const playerForces = effectiveForces(
    courtAverages(state.playerTeam.roster),
    cfg,
    state.playerIsHome,
  );
  const oppForces = effectiveForces(
    courtAverages(state.opponent.roster),
    cfg,
    !state.playerIsHome,
  );

  // mando/saque: no motor, "home" inicia sacando em sets ímpares
  const homeForces = state.playerIsHome ? playerForces : oppForces;
  const awayForces = state.playerIsHome ? oppForces : playerForces;
  const serverIsHome = setNumber % 2 === 1;

  const rng = new Rng(state.baseSeed).spawn(setNumber);
  const raw: EngineSetResult = simulateSet(serverIsHome, limit, cfg, rng, homeForces, awayForces);

  const pointsPlayer = state.playerIsHome ? raw.pointsHome : raw.pointsAway;
  const pointsOpponent = state.playerIsHome ? raw.pointsAway : raw.pointsHome;
  const playerWon = pointsPlayer > pointsOpponent;

  const summary: LiveSetSummary = {
    index: state.sets.length,
    pointsPlayer,
    pointsOpponent,
    playerWon,
    isTiebreak: setNumber === 5,
  };

  const setsPlayer = state.setsPlayer + (playerWon ? 1 : 0);
  const setsOpponent = state.setsOpponent + (playerWon ? 0 : 1);
  const finished = setsPlayer === 3 || setsOpponent === 3;

  return {
    ...state,
    sets: [...state.sets, summary],
    setsPlayer,
    setsOpponent,
    finished,
  };
}

/**
 * Simula a partida INTEIRA de uma vez (todos os sets) e retorna o resultado.
 * Usada pela opção "Simular partida" (pula o set a set). Usa a escalação atual
 * do time do jogador — idêntica ao que o "Jogar partida" usaria sem substituições.
 */
export function simulateFullMatch(
  category: Category,
  playerTeam: Team,
  opponent: Team,
  playerIsHome: boolean,
  baseSeed: number,
): MatchResult {
  let live = createLiveMatch(category, playerTeam, opponent, playerIsHome, baseSeed);
  while (!live.finished) {
    live = playNextSet(live);
  }
  return toMatchResult(live);
}

/** Converte a partida ao vivo finalizada num MatchResult do domínio. */
export function toMatchResult(state: LiveMatchState): MatchResult {
  const homeId = state.playerIsHome ? state.playerTeam.id : state.opponent.id;
  const awayId = state.playerIsHome ? state.opponent.id : state.playerTeam.id;

  const sets: SetResult[] = state.sets.map((s) => {
    const pointsHome = state.playerIsHome ? s.pointsPlayer : s.pointsOpponent;
    const pointsAway = state.playerIsHome ? s.pointsOpponent : s.pointsPlayer;
    return {
      pointsHome,
      pointsAway,
      winnerId: pointsHome > pointsAway ? homeId : awayId,
    };
  });

  const setsHome = sets.filter((s) => s.winnerId === homeId).length;
  const setsAway = sets.length - setsHome;
  const winnerId = setsHome > setsAway ? homeId : awayId;
  const loserId = winnerId === homeId ? awayId : homeId;
  const totalPointsHome = sets.reduce((a, s) => a + s.pointsHome, 0);
  const totalPointsAway = sets.reduce((a, s) => a + s.pointsAway, 0);

  const home = state.playerIsHome ? state.playerTeam : state.opponent;
  const away = state.playerIsHome ? state.opponent : state.playerTeam;

  const base: MatchResult = {
    homeId,
    awayId,
    sets,
    setsHome,
    setsAway,
    winnerId,
    loserId,
    wentToTiebreak: sets.length === 5,
    totalPointsHome,
    totalPointsAway,
    mvpId: null,
  };
  return { ...base, mvpId: pickMatchMvp(home, away, base) };
}

void opponentForces;
