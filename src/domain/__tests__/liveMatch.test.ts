import { describe, it, expect } from "vitest";
import { generateLeague, DEFAULT_GENERATE } from "../generator";
import {
  createLiveMatch,
  playNextSet,
  toMatchResult,
  simulateFullMatch,
} from "../liveMatch";
import { substitute, reservesForPosition, lineupIds } from "../lineup";
import { Position } from "../types";

function teams() {
  return generateLeague({ ...DEFAULT_GENERATE, seed: 5, category: "male" });
}

describe("partida ao vivo (set a set)", () => {
  it("joga sets até um time chegar a 3 e finaliza", () => {
    const [a, b] = teams();
    let live = createLiveMatch("male", a!, b!, true, 12345);
    let guard = 0;
    while (!live.finished && guard < 10) {
      live = playNextSet(live);
      guard++;
    }
    expect(live.finished).toBe(true);
    expect(live.setsPlayer === 3 || live.setsOpponent === 3).toBe(true);
    expect(live.sets.length).toBeGreaterThanOrEqual(3);
    expect(live.sets.length).toBeLessThanOrEqual(5);
  });

  it("converte para MatchResult coerente", () => {
    const [a, b] = teams();
    let live = createLiveMatch("male", a!, b!, true, 999);
    while (!live.finished) live = playNextSet(live);
    const r = toMatchResult(live);
    expect(r.homeId).toBe(a!.id);
    expect(r.awayId).toBe(b!.id);
    expect(r.setsHome + r.setsAway).toBe(live.sets.length);
    expect(r.winnerId).toBe(live.setsPlayer > live.setsOpponent ? a!.id : b!.id);
  });

  it("é reprodutível com a mesma baseSeed", () => {
    const [a, b] = teams();
    const run = (): string => {
      let live = createLiveMatch("male", a!, b!, true, 77);
      while (!live.finished) live = playNextSet(live);
      return live.sets.map((s) => `${s.pointsPlayer}-${s.pointsOpponent}`).join(",");
    };
    expect(run()).toBe(run());
  });

  it("simular partida == jogar set a set (mesma seed, mesmo resultado)", () => {
    const [a, b] = teams();
    // jogar set a set
    let live = createLiveMatch("male", a!, b!, true, 4242);
    while (!live.finished) live = playNextSet(live);
    const played = toMatchResult(live);
    // simular de uma vez
    const simulated = simulateFullMatch("male", a!, b!, true, 4242);
    expect(simulated.sets).toEqual(played.sets);
    expect(simulated.winnerId).toBe(played.winnerId);
  });
});

describe("substituições", () => {
  it("substitui por reserva da mesma posição", () => {
    const team = teams()[0]!;
    const middleIn = team.roster.lineup.middles[0];
    const reserve = reservesForPosition(team.roster, Position.Middle)[0]!;
    const newLineup = substitute(team.roster, middleIn, reserve.id);
    expect(lineupIds(newLineup)).toContain(reserve.id);
    expect(lineupIds(newLineup)).not.toContain(middleIn);
  });

  it("rejeita substituição de posição diferente", () => {
    const team = teams()[0]!;
    const setter = team.roster.lineup.setter;
    const middleReserve = reservesForPosition(team.roster, Position.Middle)[0]!;
    expect(() => substitute(team.roster, setter, middleReserve.id)).toThrow();
  });
});
