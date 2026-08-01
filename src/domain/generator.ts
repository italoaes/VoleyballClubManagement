/**
 * Geração procedural do mundo do jogo: 12 times com nomes fictícios de cidades
 * da Superliga, cada um com elenco completo (titulares + reservas).
 *
 * Faixa de talento de elite (55-75) com gradiente entre os times, para produzir
 * favoritos e azarões — condição para a liga ter dramaturgia e a zebra existir.
 */

import { Rng } from "@engine/rng";
import type { Attributes, Category, Player, Roster, Team } from "./types";
import { Position } from "./types";
import { defaultLineup } from "./lineup";
import { makePlayerName } from "./names";
import { overall, rollPotential } from "./development";
import { TEAM_CATALOG } from "./teams";

export interface GenerateOptions {
  numTeams: number;
  seed: number;
  category: Category;
  /** faixa de talento (centro) entre os times. */
  ratingLow: number;
  ratingHigh: number;
  /** dispersão dos atributos em torno do centro do time. */
  spread: number;
  /** índice do time controlado pelo humano (default: o mais fraco, para a fantasia de gestão). */
  playerTeamIndex?: number;
}

export const DEFAULT_GENERATE: Omit<GenerateOptions, "seed" | "category"> = {
  numTeams: 12,
  ratingLow: 55,
  ratingHigh: 75,
  spread: 6,
};

/**
 * Composição de posições de um elenco de 14 jogadores.
 * Titulares (7): 1 levantador, 2 ponteiros, 2 centrais, 1 oposto, 1 líbero.
 * Reservas (7): cobrem todas as posições para permitir substituições.
 */
const ROSTER_COMPOSITION: readonly Position[] = [
  // titulares (7)
  Position.Setter,
  Position.Outside,
  Position.Outside,
  Position.Middle,
  Position.Middle,
  Position.Opposite,
  Position.Libero,
  // reservas (7)
  Position.Setter,
  Position.Outside,
  Position.Outside,
  Position.Middle,
  Position.Middle,
  Position.Opposite,
  Position.Libero,
];

function clampAttr(v: number): number {
  return Math.max(1, Math.min(99, Math.round(v)));
}

function makeAttributes(center: number, spread: number, rng: Rng): Attributes {
  const a = (): number => clampAttr(center + rng.integers(-spread, spread + 1));
  return {
    attack: a(),
    block: a(),
    serve: a(),
    receive: a(),
    setting: a(),
    libero: a(),
  };
}

/**
 * Reescreve um jogador como um jovem da base (ponto 2 — "aposentar"), PRESERVANDO
 * id, posição e número (não quebra a escalação). Novo nome, idade 17-18, atributos
 * de base (menores) e potencial alto de jovem. Determinístico via rng.
 */
export function regenerateAsYouth(
  player: Player,
  rng: Rng,
  usedNames: Set<string>,
  category: Category,
): Player {
  const age = 17 + rng.integers(0, 2); // 17 ou 18
  // atributos de base: faixa ~45-58 (jovem cru)
  const attributes = makeAttributes(51, 6, rng);
  const currentOverall = overall(attributes);
  return {
    ...player, // preserva id, position, number
    name: makePlayerName(rng, usedNames, category),
    age,
    attributes,
    potential: rollPotential(currentOverall, age, rng),
    growthProgress: 0,
    setsPlayed: 0,
    isStar: false, // jovem novo não é estrela (o caller sincroniza reigningMvpId)
    seasonMvpCount: 0,
    careerMvpCount: 0, // carreira zerada (é um jogador novo)
  };
}

function makeRoster(
  teamId: string,
  center: number,
  spread: number,
  rng: Rng,
  usedNames: Set<string>,
  category: Category,
): Roster {
  const players: Player[] = ROSTER_COMPOSITION.map((position, i) => {
    const age = 20 + rng.integers(0, 16);
    const attributes = makeAttributes(center, spread, rng);
    const currentOverall = overall(attributes);
    return {
      id: `${teamId}-p${i + 1}`,
      name: makePlayerName(rng, usedNames, category),
      position,
      age,
      attributes,
      potential: rollPotential(currentOverall, age, rng),
      growthProgress: 0,
      number: i + 1,
      setsPlayed: 0,
      isStar: false,
      seasonMvpCount: 0,
      careerMvpCount: 0,
    };
  });

  // Escalação inicial estruturada por posição (líbero incluído).
  const lineup = defaultLineup(players);
  return { players, lineup };
}

/** Gera a liga completa de times a partir do catálogo real. */
export function generateLeague(opts: GenerateOptions): Team[] {
  const { numTeams, seed, category, ratingLow, ratingHigh, spread } = opts;
  if (numTeams < 2) {
    throw new Error("numTeams deve ser >= 2");
  }
  if (numTeams > TEAM_CATALOG.length) {
    throw new Error(`numTeams (${numTeams}) excede times do catálogo (${TEAM_CATALOG.length})`);
  }

  const rootRng = new Rng(seed);
  const usedNames = new Set<string>();
  const playerTeamIndex = opts.playerTeamIndex ?? numTeams - 1; // default: o mais fraco

  const teams: Team[] = [];
  for (let t = 0; t < numTeams; t++) {
    // gradiente linear de qualidade: catálogo já ordenado do mais forte ao mais fraco
    const center = Math.round(ratingHigh - ((ratingHigh - ratingLow) * t) / (numTeams - 1));
    const entry = TEAM_CATALOG[t]!;
    const teamRng = rootRng.spawn(1000 + t);
    const teamId = `team-${t + 1}`;
    const roster = makeRoster(teamId, center, spread, teamRng, usedNames, category);
    teams.push({
      id: teamId,
      name: entry.name,
      shortName: entry.shortName,
      city: entry.city,
      crest: entry.crest,
      roster,
      isPlayerControlled: t === playerTeamIndex,
    });
  }
  return teams;
}
