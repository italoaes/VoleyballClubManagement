/**
 * Força e nível (estrelas) de um time — funções puras, sem GameState.
 */

import { officialConfig } from "@engine/config";
import { baseForces, pregameStrength, type Forces } from "@engine/forces";
import { courtAverages } from "./lineup";
import type { Category, Roster, Team } from "./types";

/**
 * Forças ATK/DEF do time a partir de uma escalação (roster). Reflete a regra do
 * líbero e o bônus do MVP-estrela em quadra (ambos aplicados em courtAverages).
 * É a mesma base usada pelo motor — ideal para exibir ao jogador.
 */
export function rosterForces(roster: Roster, category: Category = "male"): Forces {
  const cfg = officialConfig(category);
  return baseForces(courtAverages(roster), cfg);
}

/** Força pré-jogo escalar do time (a partir da escalação atual). */
export function teamStrength(team: Team, category: Category = "male"): number {
  const cfg = officialConfig(category);
  return pregameStrength(courtAverages(team.roster), cfg);
}

/** Nível do time em estrelas (1 a 5), mapeando a faixa de talento ~52..76. */
export function teamStarsFromTeam(team: Team, category: Category = "male"): number {
  const strength = teamStrength(team, category);
  const min = 52;
  const max = 76;
  const norm = (strength - min) / (max - min);
  const stars = Math.round(norm * 4) + 1;
  return Math.max(1, Math.min(5, stars));
}
