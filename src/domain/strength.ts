/**
 * Força e nível (estrelas) de um time — funções puras, sem GameState.
 */

import { officialConfig } from "@engine/config";
import { pregameStrength } from "@engine/forces";
import { courtAverages } from "./lineup";
import type { Category, Team } from "./types";

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
