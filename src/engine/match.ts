/**
 * Motor de set e de partida — melhor de 5 (porte de match.py).
 *
 * O motor é CEGO à entidade Player e a reservas: recebe apenas as forças
 * efetivas (ATK/DEF) de cada lado. A identificação dos times é feita por ids
 * opacos ("home"/"away" ou ids reais passados pela camada de domínio).
 */

import type { EngineConfig } from "./config";
import type { Forces } from "./forces";
import type { Rng } from "./rng";
import { resolveRally } from "./rally";
import { streakLengths } from "./stats";

export interface EngineSetResult {
  pointsHome: number;
  pointsAway: number;
  /** "home" ou "away". */
  winner: "home" | "away";
  breaksHome: number;
  breaksAway: number;
  /** sequência de vencedores de cada rally ("home"/"away"). */
  pointWinners: ("home" | "away")[];
}

export interface EngineMatchResult {
  sets: EngineSetResult[];
  setsHome: number;
  setsAway: number;
  winner: "home" | "away";
  wentToTiebreak: boolean;
  totalPointsHome: number;
  totalPointsAway: number;
  /** todos os comprimentos de streak da partida (para métricas). */
  allStreaks: number[];
}

function setFinished(ph: number, pa: number, limit: number, minLead: number): boolean {
  return (ph >= limit || pa >= limit) && Math.abs(ph - pa) >= minLead;
}

/**
 * Simula um set rally a rally. `serverIsHome` indica quem inicia sacando.
 * `forcesHome`/`forcesAway` são as forças efetivas já calculadas (com eventuais
 * modificadores aplicados na camada acima).
 */
export function simulateSet(
  serverIsHome: boolean,
  limit: number,
  cfg: EngineConfig,
  rng: Rng,
  forcesHome: Forces,
  forcesAway: Forces,
): EngineSetResult {
  let ph = 0;
  let pa = 0;
  let breaksHome = 0;
  let breaksAway = 0;
  const winners: ("home" | "away")[] = [];
  let servingHome = serverIsHome;
  let streakOwnerIsHome = false;
  let streakLen = 0;

  while (!setFinished(ph, pa, limit, cfg.minLead)) {
    const receiverIsHome = !servingHome;
    const streakIsReceiver = streakLen > 0 && streakOwnerIsHome === receiverIsHome;

    let receiverBroke: boolean;
    let pointToHome: boolean;
    if (servingHome) {
      // Home saca, Away recebe: P é de Away quebrar.
      receiverBroke = resolveRally(
        forcesAway.atk,
        forcesHome.def,
        cfg,
        rng,
        streakLen,
        streakIsReceiver,
      );
      pointToHome = !receiverBroke;
    } else {
      // Away saca, Home recebe: P é de Home quebrar.
      receiverBroke = resolveRally(
        forcesHome.atk,
        forcesAway.def,
        cfg,
        rng,
        streakLen,
        streakIsReceiver,
      );
      pointToHome = receiverBroke;
    }

    if (pointToHome) {
      ph += 1;
      winners.push("home");
      if (receiverBroke) {
        breaksHome += 1;
        servingHome = true;
      }
    } else {
      pa += 1;
      winners.push("away");
      if (receiverBroke) {
        breaksAway += 1;
        servingHome = false;
      }
    }

    if (streakLen > 0 && streakOwnerIsHome === pointToHome) {
      streakLen += 1;
    } else {
      streakOwnerIsHome = pointToHome;
      streakLen = 1;
    }
  }

  return {
    pointsHome: ph,
    pointsAway: pa,
    winner: ph > pa ? "home" : "away",
    breaksHome,
    breaksAway,
    pointWinners: winners,
  };
}

/**
 * Simula uma partida melhor de 5 sets. As forças são fixas durante a partida
 * (a moral, se habilitada, deve ter sido amostrada e embutida em forces* pela
 * camada chamadora).
 */
export function simulateMatch(
  cfg: EngineConfig,
  rng: Rng,
  forcesHome: Forces,
  forcesAway: Forces,
): EngineMatchResult {
  const sets: EngineSetResult[] = [];
  let setsHome = 0;
  let setsAway = 0;

  while (setsHome < 3 && setsAway < 3) {
    const setNumber = setsHome + setsAway + 1;
    const limit = setNumber === 5 ? cfg.tiebreakPoints : cfg.setPoints;
    const serverIsHome = setNumber % 2 === 1; // ímpar: home inicia sacando
    const setResult = simulateSet(serverIsHome, limit, cfg, rng, forcesHome, forcesAway);
    sets.push(setResult);
    if (setResult.winner === "home") {
      setsHome += 1;
    } else {
      setsAway += 1;
    }
  }

  const allStreaks: number[] = [];
  let totalPointsHome = 0;
  let totalPointsAway = 0;
  for (const s of sets) {
    allStreaks.push(...streakLengths(s.pointWinners));
    totalPointsHome += s.pointsHome;
    totalPointsAway += s.pointsAway;
  }

  return {
    sets,
    setsHome,
    setsAway,
    winner: setsHome > setsAway ? "home" : "away",
    wentToTiebreak: sets.length === 5,
    totalPointsHome,
    totalPointsAway,
    allStreaks,
  };
}
