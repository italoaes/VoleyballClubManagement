/**
 * Testes de propriedade do motor de set/partida (regras do vôlei).
 */

import { describe, it, expect } from "vitest";
import { officialConfig } from "../config";
import { baseForces, type CourtAverages } from "../forces";
import { simulateMatch } from "../match";
import { Rng } from "../rng";

const cfg = officialConfig("male");

function uniform(rating: number): CourtAverages {
  return { attack: rating, block: rating, serve: rating, receive: rating, setting: rating, libero: rating };
}

function validSetScore(ph: number, pa: number, limit: number, minLead: number): boolean {
  const hi = Math.max(ph, pa);
  const lo = Math.min(ph, pa);
  return hi >= limit && hi - lo >= minLead;
}

describe("motor de partida (propriedades)", () => {
  it("partida sempre termina com exatamente um time em 3 sets", () => {
    for (let seed = 0; seed < 60; seed++) {
      const fa = baseForces(uniform(60), cfg);
      const fb = baseForces(uniform(60), cfg);
      const m = simulateMatch(cfg, new Rng(seed), fa, fb);
      expect(m.setsHome === 3 || m.setsAway === 3).toBe(true);
      expect(m.sets.length).toBeGreaterThanOrEqual(3);
      expect(m.sets.length).toBeLessThanOrEqual(5);
      // XOR: exatamente um chegou a 3
      expect((m.setsHome === 3) !== (m.setsAway === 3)).toBe(true);
    }
  });

  it("todo set tem placar válido (>=25/>=15 e diferença >=2)", () => {
    for (let seed = 0; seed < 60; seed++) {
      const fa = baseForces(uniform(65), cfg);
      const fb = baseForces(uniform(55), cfg);
      const m = simulateMatch(cfg, new Rng(seed), fa, fb);
      m.sets.forEach((s, idx) => {
        const limit = idx === 4 ? cfg.tiebreakPoints : cfg.setPoints;
        expect(validSetScore(s.pointsHome, s.pointsAway, limit, cfg.minLead)).toBe(true);
      });
    }
  });

  it("deuce estende além do limite com diferença de exatamente 2", () => {
    let foundDeuce = false;
    for (let seed = 0; seed < 300; seed++) {
      const fa = baseForces(uniform(60), cfg);
      const fb = baseForces(uniform(60), cfg);
      const m = simulateMatch(cfg, new Rng(seed), fa, fb);
      m.sets.forEach((s, idx) => {
        const limit = idx === 4 ? cfg.tiebreakPoints : cfg.setPoints;
        const hi = Math.max(s.pointsHome, s.pointsAway);
        if (hi > limit) {
          expect(Math.abs(s.pointsHome - s.pointsAway)).toBe(2);
          foundDeuce = true;
        }
      });
    }
    expect(foundDeuce).toBe(true);
  });

  it("time mais forte vence a maioria (monotonicidade)", () => {
    let strongWins = 0;
    const n = 200;
    for (let seed = 0; seed < n; seed++) {
      const strong = baseForces(uniform(75), cfg);
      const weak = baseForces(uniform(45), cfg);
      const m = simulateMatch(cfg, new Rng(seed), strong, weak);
      if (m.winner === "home") strongWins++;
    }
    expect(strongWins / n).toBeGreaterThan(0.6);
  });

  it("é reprodutível com a mesma seed", () => {
    const fa = baseForces(uniform(62), cfg);
    const fb = baseForces(uniform(58), cfg);
    const m1 = simulateMatch(cfg, new Rng(123), fa, fb);
    const m2 = simulateMatch(cfg, new Rng(123), fa, fb);
    expect(m1.sets.map((s) => [s.pointsHome, s.pointsAway])).toEqual(
      m2.sets.map((s) => [s.pointsHome, s.pointsAway]),
    );
  });
});
