/**
 * Configuração do motor — contrato central dos parâmetros (porte de config.py).
 *
 * Carrega os PARÂMETROS OFICIAIS calibrados (Wave 0):
 *   k=0.4, scale=25, anchor=0.65 (masculino) / 0.61 (feminino).
 * Ver prototype/docs/parametros_oficiais.md e output/golden_tests.json.
 */

import type { Category } from "@domain/types";

export interface ForceWeights {
  atkAttack: number;
  atkSet: number;
  atkServe: number;
  defBlock: number;
  defReceive: number;
  defLibero: number;
}

export interface Modifiers {
  homeAdvantageEnabled: boolean;
  homeAdvantagePct: number;
  moraleEnabled: boolean;
  moraleMin: number;
  moraleMax: number;
  rotationEnabled: boolean;
  rotationBonus: number;
}

export interface EngineConfig {
  /** Ganho da sigmoide (previsibilidade × zebra). */
  k: number;
  /** Divisor S de normalização da diferença ATK−DEF. */
  scale: number;
  /** Side-out alvo quando os times são parelhos. */
  anchor: number;

  weights: ForceWeights;
  modifiers: Modifiers;

  setPoints: number;
  tiebreakPoints: number;
  minLead: number;

  momentumEnabled: boolean;
  momentumGain: number;
  momentumScale: number;
}

export const OFFICIAL_WEIGHTS: ForceWeights = {
  atkAttack: 0.4,
  atkSet: 0.3,
  atkServe: 0.3,
  defBlock: 0.4,
  defReceive: 0.3,
  defLibero: 0.3,
};

const DEFAULT_MODIFIERS: Modifiers = {
  homeAdvantageEnabled: false,
  homeAdvantagePct: 0.02,
  moraleEnabled: false,
  moraleMin: 0.95,
  moraleMax: 1.05,
  rotationEnabled: false,
  rotationBonus: 2.0,
};

/** anchor oficial por categoria. */
export const ANCHOR_BY_CATEGORY: Record<Category, number> = {
  male: 0.65,
  female: 0.61,
};

/** Configuração oficial do motor para uma categoria. */
export function officialConfig(category: Category = "male"): EngineConfig {
  return {
    k: 0.4,
    scale: 25.0,
    anchor: ANCHOR_BY_CATEGORY[category],
    weights: OFFICIAL_WEIGHTS,
    modifiers: DEFAULT_MODIFIERS,
    setPoints: 25,
    tiebreakPoints: 15,
    minLead: 2,
    momentumEnabled: false,
    momentumGain: 0.0,
    momentumScale: 3.0,
  };
}

/** Cria uma cópia da config com campos sobrescritos. */
export function withOverrides(
  cfg: EngineConfig,
  overrides: Partial<EngineConfig>,
): EngineConfig {
  return { ...cfg, ...overrides };
}
