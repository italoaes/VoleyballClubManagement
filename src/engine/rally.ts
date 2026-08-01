/**
 * Probabilidade de quebra de saque e resolução de rally (porte de rally.py).
 *
 * Fórmula canônica ÚNICA (contratos A1 + A2 + momentum):
 *   P(quebra) = sigmoid( k·(ATK_recebe − DEF_saca)/S + logit(anchor) + M )
 *
 * - Normalização por S evita saturação (G1).
 * - logit(anchor) garante P(Δ=0) == anchor quando M=0.
 * - M é o termo de momentum (0 se desligado). SEMPRE dentro da sigmoide.
 */

import type { EngineConfig } from "./config";
import type { Rng } from "./rng";

/** Sigmoide numericamente estável para x muito negativo/positivo. */
export function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1.0 / (1.0 + z);
  }
  const z = Math.exp(x);
  return z / (1.0 + z);
}

export function logit(p: number): number {
  if (!(p > 0.0 && p < 1.0)) {
    throw new Error(`logit indefinido para p=${p}; deve estar em (0,1)`);
  }
  return Math.log(p / (1.0 - p));
}

/**
 * Termo de momentum em logit-space (0 se desligado ou sem sequência).
 * Sinal + favorece o recebedor; − favorece quem saca.
 */
export function momentumTerm(
  streakLen: number,
  streakIsReceiver: boolean,
  cfg: EngineConfig,
): number {
  if (!cfg.momentumEnabled || streakLen <= 1) {
    return 0.0;
  }
  const magnitude = cfg.momentumGain * Math.tanh((streakLen - 1) / cfg.momentumScale);
  return streakIsReceiver ? magnitude : -magnitude;
}

/** P de o time que RECEBE quebrar o saque. */
export function breakProbability(
  atkReceiver: number,
  defServer: number,
  cfg: EngineConfig,
  streakLen = 0,
  streakIsReceiver = false,
): number {
  const z =
    (cfg.k * (atkReceiver - defServer)) / cfg.scale +
    logit(cfg.anchor) +
    momentumTerm(streakLen, streakIsReceiver, cfg);
  return sigmoid(z);
}

/**
 * Resolve um rally. Retorna true se o time que RECEBE ganhou o ponto (quebra e
 * assume o saque); false se o time que SACA ganhou (mantém o saque).
 */
export function resolveRally(
  atkReceiver: number,
  defServer: number,
  cfg: EngineConfig,
  rng: Rng,
  streakLen = 0,
  streakIsReceiver = false,
): boolean {
  const p = breakProbability(atkReceiver, defServer, cfg, streakLen, streakIsReceiver);
  return rng.random() < p;
}
