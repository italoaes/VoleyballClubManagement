/**
 * Camada de escalação — ponte domínio↔motor.
 *
 * É AQUI que a gestão de escalação e a regra do líbero acontecem. A escalação é
 * estruturada por posição (7 jogadores: 1 levantador, 2 ponteiros, 2 centrais,
 * 1 oposto, 1 líbero). O líbero entra no fundo no lugar de UM central: não
 * ataca/saca/bloqueia, mas melhora a RECEPÇÃO e a DEFESA do time.
 *
 * O motor permanece cego a tudo isso — recebe apenas as médias agregadas.
 */

import type { CourtAverages } from "@engine/forces";
import { Position, type Lineup, type Player, type Roster } from "./types";

/** Erro de escalação inválida (falha explícita, não silenciosa). */
export class LineupError extends Error {}

/** Requisitos de posição para uma escalação válida. */
export const LINEUP_REQUIREMENTS: Record<Position, number> = {
  [Position.Setter]: 1,
  [Position.Outside]: 2,
  [Position.Middle]: 2,
  [Position.Opposite]: 1,
  [Position.Libero]: 1,
};

/** Todos os ids da escalação (7 jogadores), em ordem estável. */
export function lineupIds(lineup: Lineup): string[] {
  return [
    lineup.setter,
    lineup.outsides[0],
    lineup.outsides[1],
    lineup.middles[0],
    lineup.middles[1],
    lineup.opposite,
    lineup.libero,
  ];
}

function playerMap(roster: Roster): Map<string, Player> {
  return new Map(roster.players.map((p) => [p.id, p]));
}

function requirePlayer(map: Map<string, Player>, id: string): Player {
  const p = map.get(id);
  if (!p) throw new LineupError(`jogador id=${id} não existe no elenco`);
  return p;
}

/**
 * Valida que a escalação respeita as posições exigidas e que cada jogador ocupa
 * uma posição compatível com a sua.
 */
export function validateLineup(roster: Roster, lineup: Lineup): void {
  const ids = lineupIds(lineup);
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new LineupError(`jogador id=${id} escalado em duplicidade`);
    seen.add(id);
  }
  const map = playerMap(roster);
  const check = (id: string, pos: Position): void => {
    const p = requirePlayer(map, id);
    if (p.position !== pos) {
      throw new LineupError(`jogador ${p.name} (${p.position}) não pode ocupar ${pos}`);
    }
  };
  check(lineup.setter, Position.Setter);
  check(lineup.outsides[0], Position.Outside);
  check(lineup.outsides[1], Position.Outside);
  check(lineup.middles[0], Position.Middle);
  check(lineup.middles[1], Position.Middle);
  check(lineup.opposite, Position.Opposite);
  check(lineup.libero, Position.Libero);
}

/**
 * Calcula as médias de atributos que o motor recebe, aplicando a regra do líbero.
 *
 * Efetivamente, os 6 "jogadores de quadra" (levantador, 2 ponteiros, 2 centrais,
 * oposto) definem a base. O líbero então SUBSTITUI a contribuição defensiva de
 * um central no fundo: para os atributos de recepção e líbero/defesa, usamos o
 * MELHOR entre o central substituído e o líbero (o líbero, especialista, tende a
 * elevar esses valores). Ataque/bloqueio/saque/levantamento permanecem dos 6 de
 * quadra (o líbero não realiza esses fundamentos).
 */
export function courtAverages(roster: Roster): CourtAverages {
  const map = playerMap(roster);
  const setter = requirePlayer(map, roster.lineup.setter);
  const outside1 = requirePlayer(map, roster.lineup.outsides[0]);
  const outside2 = requirePlayer(map, roster.lineup.outsides[1]);
  const middle1 = requirePlayer(map, roster.lineup.middles[0]);
  const middle2 = requirePlayer(map, roster.lineup.middles[1]);
  const opposite = requirePlayer(map, roster.lineup.opposite);
  const libero = requirePlayer(map, roster.lineup.libero);

  const courtSix = [setter, outside1, outside2, middle1, middle2, opposite];

  // Atributos "de rede" (não afetados pelo líbero): média dos 6 de quadra.
  const meanOfSix = (sel: (p: Player) => number): number =>
    courtSix.reduce((acc, p) => acc + sel(p), 0) / courtSix.length;

  const attack = meanOfSix((p) => p.attributes.attack);
  const block = meanOfSix((p) => p.attributes.block);
  const serve = meanOfSix((p) => p.attributes.serve);
  const setting = meanOfSix((p) => p.attributes.setting);

  // Recepção/defesa: o líbero substitui o central mais fraco no fundo.
  // Trocamos a contribuição desse central pela do líbero nesses dois atributos.
  const weakerMiddle =
    middle1.attributes.receive + middle1.attributes.libero <=
    middle2.attributes.receive + middle2.attributes.libero
      ? middle1
      : middle2;

  const receiveWithLibero =
    (courtSix.reduce((a, p) => a + p.attributes.receive, 0) -
      weakerMiddle.attributes.receive +
      libero.attributes.receive) /
    courtSix.length;

  const liberoWithLibero =
    (courtSix.reduce((a, p) => a + p.attributes.libero, 0) -
      weakerMiddle.attributes.libero +
      libero.attributes.libero) /
    courtSix.length;

  return {
    attack,
    block,
    serve,
    receive: receiveWithLibero,
    setting,
    libero: liberoWithLibero,
  };
}

/** Aplica uma nova escalação, validando-a antes. */
export function setLineup(roster: Roster, lineup: Lineup): Roster {
  validateLineup(roster, lineup);
  return {
    ...roster,
    lineup: {
      setter: lineup.setter,
      outsides: [lineup.outsides[0], lineup.outsides[1]],
      middles: [lineup.middles[0], lineup.middles[1]],
      opposite: lineup.opposite,
      libero: lineup.libero,
    },
  };
}

/**
 * Substitui um jogador da escalação por outro do elenco NA MESMA POSIÇÃO.
 * Retorna a nova escalação. Usado nas substituições entre sets.
 */
export function substitute(
  roster: Roster,
  outId: string,
  inId: string,
): Lineup {
  const map = playerMap(roster);
  const outP = requirePlayer(map, outId);
  const inP = requirePlayer(map, inId);
  if (outP.position !== inP.position) {
    throw new LineupError(
      `substituição inválida: ${inP.name} (${inP.position}) não joga na posição de ${outP.name} (${outP.position})`,
    );
  }
  const ids = lineupIds(roster.lineup);
  if (!ids.includes(outId)) {
    throw new LineupError(`jogador ${outP.name} não está em quadra`);
  }
  if (ids.includes(inId)) {
    throw new LineupError(`jogador ${inP.name} já está em quadra`);
  }
  const l = roster.lineup;
  const replace = (id: string): string => (id === outId ? inId : id);
  return {
    setter: replace(l.setter),
    outsides: [replace(l.outsides[0]), replace(l.outsides[1])],
    middles: [replace(l.middles[0]), replace(l.middles[1])],
    opposite: replace(l.opposite),
    libero: replace(l.libero),
  };
}

/** Reservas disponíveis para uma posição (não escalados). */
export function reservesForPosition(roster: Roster, position: Position): Player[] {
  const inCourt = new Set(lineupIds(roster.lineup));
  return roster.players.filter((p) => p.position === position && !inCourt.has(p.id));
}

/**
 * Monta uma escalação padrão a partir do elenco (primeiros jogadores de cada
 * posição). Usado na geração e como fallback.
 */
export function defaultLineup(players: Player[]): Lineup {
  const byPos = (pos: Position): Player[] => players.filter((p) => p.position === pos);
  const need = (pos: Position, n: number): Player[] => {
    const found = byPos(pos);
    if (found.length < n) {
      throw new LineupError(`elenco não tem ${n} jogador(es) na posição ${pos}`);
    }
    return found.slice(0, n);
  };
  const setter = need(Position.Setter, 1)[0]!;
  const outsides = need(Position.Outside, 2);
  const middles = need(Position.Middle, 2);
  const opposite = need(Position.Opposite, 1)[0]!;
  const libero = need(Position.Libero, 1)[0]!;
  return {
    setter: setter.id,
    outsides: [outsides[0]!.id, outsides[1]!.id],
    middles: [middles[0]!.id, middles[1]!.id],
    opposite: opposite.id,
    libero: libero.id,
  };
}
