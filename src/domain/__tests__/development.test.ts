import { describe, it, expect } from "vitest";
import { Rng } from "@engine/rng";
import {
  rollPotential,
  overall,
  growFromMinutes,
  bumpFundamental,
  pdCost,
  canInvest,
  tickTraining,
  declineVeteran,
  pdFromMatch,
  pdObjectiveBonus,
} from "../development";
import type { Player } from "../types";
import { Position } from "../types";

function mkPlayer(over: number, age: number, potential: number): Player {
  return {
    id: "p",
    name: "Teste",
    position: Position.Outside,
    age,
    attributes: { attack: over, block: over, serve: over, receive: over, setting: over, libero: over },
    potential,
    growthProgress: 0,
    number: 1,
    setsPlayed: 0,
  };
}

describe("desenvolvimento: potencial", () => {
  it("jovem tem teto acima do atual; veterano fica no atual", () => {
    const rng = new Rng(1);
    const young = rollPotential(60, 19, rng);
    const vet = rollPotential(60, 33, rng);
    expect(young).toBeGreaterThan(60);
    expect(vet).toBe(60);
  });
});

describe("desenvolvimento: crescimento por minutos", () => {
  it("jovem que joga evolui ao longo de muitas rodadas, sem passar do potencial", () => {
    let p = mkPlayer(60, 19, 66);
    for (let r = 0; r < 40; r++) p = growFromMinutes(p, true);
    expect(overall(p.attributes)).toBeGreaterThan(60);
    expect(overall(p.attributes)).toBeLessThanOrEqual(66);
  });

  it("reserva (não joga) evolui bem menos que titular", () => {
    let starter = mkPlayer(60, 19, 80);
    let bench = mkPlayer(60, 19, 80);
    for (let r = 0; r < 30; r++) {
      starter = growFromMinutes(starter, true);
      bench = growFromMinutes(bench, false);
    }
    expect(overall(starter.attributes)).toBeGreaterThanOrEqual(overall(bench.attributes));
  });

  it("no potencial máximo, não cresce mais", () => {
    let p = mkPlayer(70, 19, 70);
    for (let r = 0; r < 20; r++) p = growFromMinutes(p, true);
    expect(overall(p.attributes)).toBe(70);
  });

  it("ritmo lento e realista: jovem titular ~+2 a +7 no overall por temporada", () => {
    let p = mkPlayer(62, 19, 78);
    const before = overall(p.attributes);
    // ~25 rodadas (liga + playoffs) de uma temporada
    for (let r = 0; r < 25; r++) p = growFromMinutes(p, true);
    const gain = overall(p.attributes) - before;
    expect(gain).toBeGreaterThanOrEqual(2);
    expect(gain).toBeLessThanOrEqual(7);
  });
});

describe("desenvolvimento: PD e investimento", () => {
  it("custo cresce com o valor do atributo", () => {
    expect(pdCost(55)).toBeLessThan(pdCost(75));
    expect(pdCost(75)).toBeLessThan(pdCost(92));
  });

  it("não investe além do potencial", () => {
    const p = mkPlayer(70, 25, 70); // já no teto
    expect(canInvest(p, "attack")).toBe(false);
  });

  it("bumpFundamental respeita o teto de potencial", () => {
    const p = mkPlayer(70, 25, 70);
    const bumped = bumpFundamental(p, "attack", 1);
    expect(overall(bumped.attributes)).toBeLessThanOrEqual(70);
  });

  it("PD por marcos: vitória e zebra rendem mais", () => {
    const win = pdFromMatch({ playerWon: true, wasSweep: false, wentToTiebreak: false, playerWasUnderdog: false });
    const upset = pdFromMatch({ playerWon: true, wasSweep: true, wentToTiebreak: false, playerWasUnderdog: true });
    const loss = pdFromMatch({ playerWon: false, wasSweep: false, wentToTiebreak: false, playerWasUnderdog: false });
    expect(upset).toBeGreaterThan(win);
    expect(win).toBeGreaterThan(loss);
  });

  it("bônus de objetivo/título", () => {
    expect(pdObjectiveBonus(true, true)).toBeGreaterThan(pdObjectiveBonus(false, false));
  });
});

describe("desenvolvimento: treino", () => {
  it("só aplica ganho ao concluir as rodadas", () => {
    const players = [mkPlayer(60, 22, 80)];
    players[0]!.id = "x";
    const training = { playerId: "x", fundamental: "serve" as const, roundsDone: 3, totalRounds: 5 };
    const mid = tickTraining(players, training);
    expect(mid.finished).toBe(false);
    expect(mid.players[0]!.attributes.serve).toBe(60);
    const done = tickTraining(players, { ...training, roundsDone: 4 });
    expect(done.finished).toBe(true);
    expect(done.players[0]!.attributes.serve).toBeGreaterThan(60);
  });
});

describe("desenvolvimento: declínio", () => {
  const sum = (a: Player["attributes"]): number =>
    a.attack + a.block + a.serve + a.receive + a.setting + a.libero;

  it("veterano perde pontos; jovem não", () => {
    const base = mkPlayer(80, 34, 80);
    const vet = declineVeteran(base, new Rng(1));
    const young = declineVeteran(mkPlayer(80, 24, 85), new Rng(1));
    expect(sum(vet.attributes)).toBeLessThan(sum(base.attributes));
    expect(sum(young.attributes)).toBe(sum(base.attributes));
  });
});
