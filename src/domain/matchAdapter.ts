/**
 * Adaptador domínio→motor: roda uma partida entre dois Team e converte o
 * resultado do motor (home/away opaco) para um MatchResult do domínio (com ids).
 */

import { officialConfig, withOverrides, type EngineConfig } from "@engine/config";
import { effectiveForces } from "@engine/forces";
import { simulateMatch } from "@engine/match";
import { Rng } from "@engine/rng";
import type { Category, MatchResult, SetResult, Team } from "./types";
import { courtAverages } from "./lineup";
import { pickMatchMvp } from "./mvp";

/** Config do motor para uma categoria, com vantagem de casa habilitada (~2%). */
export function matchConfig(category: Category): EngineConfig {
  const base = officialConfig(category);
  return withOverrides(base, {
    modifiers: { ...base.modifiers, homeAdvantageEnabled: true, homeAdvantagePct: 0.02 },
  });
}

/**
 * Simula uma partida entre dois times. `home` recebe a vantagem de casa.
 * O RNG deve ser derivado (spawn) pela camada chamadora para reprodutibilidade.
 */
export function playMatch(
  home: Team,
  away: Team,
  cfg: EngineConfig,
  rng: Rng,
): MatchResult {
  const avgHome = courtAverages(home.roster);
  const avgAway = courtAverages(away.roster);
  const forcesHome = effectiveForces(avgHome, cfg, true, rng);
  const forcesAway = effectiveForces(avgAway, cfg, false, rng);

  const r = simulateMatch(cfg, rng, forcesHome, forcesAway);

  const sets: SetResult[] = r.sets.map((s) => ({
    pointsHome: s.pointsHome,
    pointsAway: s.pointsAway,
    winnerId: s.winner === "home" ? home.id : away.id,
  }));

  const winnerId = r.winner === "home" ? home.id : away.id;
  const loserId = r.winner === "home" ? away.id : home.id;

  const base: MatchResult = {
    homeId: home.id,
    awayId: away.id,
    sets,
    setsHome: r.setsHome,
    setsAway: r.setsAway,
    winnerId,
    loserId,
    wentToTiebreak: r.wentToTiebreak,
    totalPointsHome: r.totalPointsHome,
    totalPointsAway: r.totalPointsAway,
    mvpId: null,
  };
  // MVP calculado aqui (funil único das partidas auto-simuladas), para valer em
  // TODAS as equipes. O motor permanece cego (heurística sobre a escalação).
  return { ...base, mvpId: pickMatchMvp(home, away, base) };
}
