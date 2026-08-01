/**
 * Desenvolvimento de elenco — potencial, evolução e declínio (camada de carreira).
 *
 * Três canais alimentam a evolução, todos limitados por POTENCIAL + IDADE:
 *  1. Minutos em quadra (automático, por rodada): quem joga evolui devagar.
 *  2. Pontos de Desenvolvimento (PD): ganhos por marcos, gastos pelo jogador.
 *  3. Foco de treino (lento, várias rodadas): um ganho maior ao concluir.
 * Veteranos (31+) declinam a cada temporada. Ritmo LENTO e realista.
 */

import { Rng } from "@engine/rng";
import type { Attributes, Fundamental, Player } from "./types";

export const FUNDAMENTALS: readonly Fundamental[] = [
  "attack",
  "block",
  "serve",
  "receive",
  "setting",
  "libero",
];

export const ATTR_MIN = 1;
export const ATTR_MAX = 99;
export const TRAINING_ROUNDS = 5;

function clamp(v: number, lo = ATTR_MIN, hi = ATTR_MAX): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Overall (média dos 6 fundamentos, arredondada). */
export function overall(attrs: Attributes): number {
  const sum =
    attrs.attack + attrs.block + attrs.serve + attrs.receive + attrs.setting + attrs.libero;
  return Math.round(sum / 6);
}

export function playerOverall(p: Player): number {
  return overall(p.attributes);
}

/**
 * Define o potencial (teto de overall) conforme a idade, na geração.
 * Jovens têm teto bem acima do atual; veteranos, próximo do atual.
 */
export function rollPotential(currentOverall: number, age: number, rng: Rng): number {
  let bonus: number;
  if (age <= 21) bonus = 8 + rng.integers(0, 8); // +8..+15
  else if (age <= 27) bonus = 2 + rng.integers(0, 9); // +2..+10
  else if (age <= 30) bonus = rng.integers(0, 3); // +0..+2
  else bonus = 0; // veterano: sem teto de crescimento
  return clamp(currentOverall + bonus);
}

/** true se o jogador ainda pode crescer (não atingiu o potencial). */
export function canGrow(p: Player): boolean {
  return playerOverall(p) < p.potential;
}

/**
 * Escolhe o fundamento a subir: o mais fraco entre os "de assinatura" da
 * posição tende a subir primeiro? Mantemos simples e realista: sobe o fundamento
 * mais BAIXO do jogador (reduz desníveis internos), com desempate estável.
 */
export function weakestFundamental(attrs: Attributes): Fundamental {
  let best: Fundamental = "attack";
  let bestVal = Infinity;
  for (const f of FUNDAMENTALS) {
    if (attrs[f] < bestVal) {
      bestVal = attrs[f];
      best = f;
    }
  }
  return best;
}

/** Aplica +delta a um fundamento, respeitando o teto de potencial no overall. */
export function bumpFundamental(p: Player, fundamental: Fundamental, delta: number): Player {
  if (delta <= 0) return p;
  // não ultrapassa o potencial (checado pelo overall resultante)
  const attrs = { ...p.attributes };
  const target = clamp(attrs[fundamental] + delta);
  // limita para que o overall não exceda o potencial
  const projected = { ...attrs, [fundamental]: target };
  if (overall(projected) > p.potential) {
    // permite subir só até o potencial
    const room = p.potential * 6 - (overall(attrs) * 6);
    if (room <= 0) return p;
  }
  attrs[fundamental] = target;
  return { ...p, attributes: attrs };
}

/**
 * Canal 1 — crescimento por MINUTOS em quadra (por rodada).
 * `played` indica se o jogador esteve em quadra na rodada. Jovens acumulam mais;
 * quanto mais perto do potencial, mais devagar (rendimentos decrescentes).
 * Retorna o jogador atualizado (pode ter subido 1 ponto num fundamento).
 */
export function growFromMinutes(p: Player, played: boolean): Player {
  if (!canGrow(p)) return p;

  // ganho-base de progresso por rodada. Calibrado para um jovem titular ganhar
  // ~+3 a +5 no overall por temporada (lento e realista). Reserva ganha bem menos.
  const ageFactor = p.age <= 21 ? 1 : p.age <= 27 ? 0.6 : p.age <= 30 ? 0.3 : 0;
  const playFactor = played ? 1 : 0.15;
  // rendimentos decrescentes: perto do potencial, cresce menos
  const gap = p.potential - playerOverall(p);
  const gapFactor = clamp(gap / 12, 0.2, 1); // nunca zera enquanto houver gap

  const gain = 0.7 * ageFactor * playFactor * gapFactor; // por rodada (em pontos de fundamento)
  let progress = p.growthProgress + gain;

  let updated = p;
  while (progress >= 1 && canGrow(updated)) {
    progress -= 1;
    const f = weakestFundamental(updated.attributes);
    updated = bumpFundamental(updated, f, 1);
  }
  return { ...updated, growthProgress: canGrow(updated) ? progress : 0 };
}

/**
 * Canal 2 — custo em PD para subir +1 num fundamento (rendimentos decrescentes).
 * Atributos altos custam mais. Retorna o custo em PD.
 */
export function pdCost(currentValue: number): number {
  if (currentValue < 60) return 1;
  if (currentValue < 70) return 2;
  if (currentValue < 80) return 3;
  if (currentValue < 90) return 5;
  return 8;
}

/** Verifica se é possível investir +1 no fundamento (respeita potencial). */
export function canInvest(p: Player, fundamental: Fundamental): boolean {
  if (playerOverall(p) >= p.potential) return false;
  return p.attributes[fundamental] < ATTR_MAX;
}

/**
 * Canal 3 — avança o treino ativo em 1 rodada. Ao concluir (roundsDone ==
 * totalRounds), aplica um ganho maior (+2) no fundamento e encerra o treino.
 * Retorna { players, done }: lista possivelmente modificada e se concluiu.
 */
export function tickTraining(
  players: Player[],
  training: { playerId: string; fundamental: Fundamental; roundsDone: number; totalRounds: number },
): { players: Player[]; finished: boolean } {
  const roundsDone = training.roundsDone + 1;
  if (roundsDone < training.totalRounds) {
    return { players, finished: false };
  }
  // concluiu: aplica +2 no fundamento (limitado por potencial)
  const updated = players.map((p) => {
    if (p.id !== training.playerId) return p;
    return bumpFundamental(p, training.fundamental, 2);
  });
  return { players: updated, finished: true };
}

/**
 * Canal 2 (fonte) — PD ganhos por MARCOS numa partida do time do jogador.
 *
 * Tabela oficial:
 *  - Vitória 3-0 = 5 PD; 3-1 = 3 PD; 3-2 = 2 PD.
 *  - Derrota (qualquer placar) = 1 PD.
 *  - Bônus (somados): +1 vencer time superior; +1 virada no jogo; +1 vitória fora de casa.
 */
export function pdFromMatch(params: {
  playerWon: boolean;
  setsFor: number; // sets ganhos pelo time do jogador
  setsAgainst: number; // sets perdidos pelo time do jogador
  beatSuperiorTeam: boolean; // adversário era mais forte (mais estrelas)
  wasComeback: boolean; // perdeu algum dos 2 primeiros sets e venceu
  wonAway: boolean; // venceu jogando fora de casa
}): number {
  if (!params.playerWon) {
    return 1; // derrota rende 1 PD, qualquer placar
  }
  // base por placar de sets
  let pd: number;
  if (params.setsAgainst === 0) pd = 5; // 3-0
  else if (params.setsAgainst === 1) pd = 3; // 3-1
  else pd = 2; // 3-2
  // bônus
  if (params.beatSuperiorTeam) pd += 1;
  if (params.wasComeback) pd += 1;
  if (params.wonAway) pd += 1;
  return pd;
}

/** PD de bônus ao cumprir o objetivo da temporada (pote). */
export function pdObjectiveBonus(objectiveMet: boolean, wasChampion: boolean): number {
  let pd = 0;
  if (objectiveMet) pd += 8;
  if (wasChampion) pd += 6;
  return pd;
}

/** Teto absoluto de potencial (anti-inflação em muitas temporadas). */
export const POTENTIAL_CAP = 93;

/** Teto do overall via boost de MVP do campeonato (anti-inflação). */
export const MVP_BOOST_CAP = 95;

/**
 * Boost permanente do MVP do campeonato (ponto 6): sobe alguns fundamentos e o
 * potencial junto (senão um MVP no teto não ganharia nada), com cap MVP_BOOST_CAP.
 * Aplicado uma vez ao ser eleito.
 */
export function boostChampionMvp(p: Player): Player {
  // eleva o potencial primeiro (permite o overall subir), com cap
  const potential = clamp(Math.max(p.potential, playerOverall(p)) + 2, ATTR_MIN, MVP_BOOST_CAP);
  // sobe os 3 fundamentos mais altos em +1 (assinatura do craque), respeitando o cap
  const attrs = { ...p.attributes };
  const order = [...FUNDAMENTALS].sort((a, b) => attrs[b] - attrs[a]);
  let boosted = { ...p, potential };
  for (let i = 0; i < 3; i++) {
    const f = order[i]!;
    if (attrs[f] < MVP_BOOST_CAP && overall(boosted.attributes) < potential) {
      boosted = bumpFundamental(boosted, f, 1);
    }
  }
  return boosted;
}

/**
 * Crescimento de POTENCIAL entre temporadas (ponto 1): jogadores jovens ganham
 * um pouco de margem a cada virada, para não estagnarem ao atingir o teto.
 * Incremento decresce com a idade e zera aos 28+. Cap absoluto POTENTIAL_CAP.
 */
export function growPotential(p: Player, rng: Rng): Player {
  let inc = 0;
  if (p.age <= 21) inc = 2 + rng.integers(0, 2); // +2..+3
  else if (p.age <= 27) inc = 1 + rng.integers(0, 2); // +1..+2
  else return p; // 28+ não ganha margem
  const potential = clamp(p.potential + inc, ATTR_MIN, POTENTIAL_CAP);
  return { ...p, potential };
}

/**
 * Declínio de veteranos entre temporadas (31+). Reduz 1-3 pontos distribuídos
 * nos fundamentos mais altos, proporcional à idade. Aplicado no virar da temporada.
 */
export function declineVeteran(p: Player, rng: Rng): Player {
  if (p.age < 31) return p;
  const drop = p.age >= 34 ? 3 : p.age >= 32 ? 2 : 1;
  const attrs = { ...p.attributes };
  for (let i = 0; i < drop; i++) {
    // reduz o fundamento mais ALTO (perda de ponta física)
    let hi: Fundamental = "attack";
    let hiVal = -Infinity;
    for (const f of FUNDAMENTALS) {
      if (attrs[f] > hiVal) {
        hiVal = attrs[f];
        hi = f;
      }
    }
    attrs[hi] = clamp(attrs[hi] - 1);
  }
  void rng;
  return { ...p, attributes: attrs };
}
