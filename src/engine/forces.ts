/**
 * Forças efetivas ATK/DEF (porte de forces.py).
 *
 * ATK = 0.4·ataque + 0.3·levantamento + 0.3·saque   (médias do time em quadra)
 * DEF = 0.4·bloqueio + 0.3·recepção + 0.3·líbero
 *
 * O motor recebe as MÉDIAS dos 6 jogadores em quadra (contrato: motor cego a
 * reservas). Modificadores aplicam-se sobre ATK/DEF brutos, nunca sobre P.
 */

import type { EngineConfig } from "./config";
import type { Rng } from "./rng";

/** Médias de atributos de um time em quadra (calculadas pela camada de domínio). */
export interface CourtAverages {
  attack: number;
  block: number;
  serve: number;
  receive: number;
  setting: number;
  libero: number;
}

export interface Forces {
  atk: number;
  def: number;
}

/** ATK/DEF brutos, sem modificadores. */
export function baseForces(avg: CourtAverages, cfg: EngineConfig): Forces {
  const w = cfg.weights;
  const atk = w.atkAttack * avg.attack + w.atkSet * avg.setting + w.atkServe * avg.serve;
  const def = w.defBlock * avg.block + w.defReceive * avg.receive + w.defLibero * avg.libero;
  return { atk, def };
}

/** Força escalar pré-jogo: 0.5·ATK + 0.5·DEF, sem modificadores. */
export function pregameStrength(avg: CourtAverages, cfg: EngineConfig): number {
  const f = baseForces(avg, cfg);
  return 0.5 * f.atk + 0.5 * f.def;
}

/**
 * ATK/DEF com modificadores aplicados sobre os valores brutos.
 * - Moral: fator multiplicativo aleatório em [moraleMin, moraleMax] (requer rng).
 * - Vantagem de casa: fator (1 + homeAdvantagePct) se o time é mandante.
 * - Rotação: bônus aditivo pequeno.
 */
export function effectiveForces(
  avg: CourtAverages,
  cfg: EngineConfig,
  isHome: boolean,
  rng?: Rng,
): Forces {
  const f = baseForces(avg, cfg);
  let { atk, def } = f;
  const mods = cfg.modifiers;

  if (mods.moraleEnabled) {
    if (!rng) {
      throw new Error("moraleEnabled=true requer um Rng para amostrar a moral");
    }
    const morale = rng.uniform(mods.moraleMin, mods.moraleMax);
    atk *= morale;
    def *= morale;
  }

  if (mods.homeAdvantageEnabled && isHome) {
    const factor = 1.0 + mods.homeAdvantagePct;
    atk *= factor;
    def *= factor;
  }

  if (mods.rotationEnabled) {
    atk += mods.rotationBonus;
    def += mods.rotationBonus;
  }

  return { atk, def };
}
