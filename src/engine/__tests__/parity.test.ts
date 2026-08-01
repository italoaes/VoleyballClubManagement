/**
 * Suíte de PARIDADE — valida o motor TS contra golden_tests.json (fonte única
 * de verdade exportada do motor Python calibrado).
 *
 * - Casos `deterministic`: valores exatos (tolerância do próprio caso).
 * - Casos `setRules`: condição de fim de set (determinístico).
 * - Casos `statistical`: métricas sobre N simulações dentro de faixas.
 */

import { describe, it, expect } from "vitest";
import goldenRaw from "./golden_tests.json";
import { officialConfig, withOverrides, type EngineConfig } from "../config";
import { baseForces, type CourtAverages, type Forces } from "../forces";
import { breakProbability, logit, momentumTerm } from "../rally";
import { simulateMatch } from "../match";
import { Rng } from "../rng";

// ---- tipos do golden ----
interface DeterministicCase {
  name: string;
  fn: string;
  inputs: Record<string, unknown>;
  expected: number | { atk: number; def: number };
  tolerance: number;
}
interface SetRuleCase {
  name: string;
  scores: [number, number];
  limit: number;
  minLead: number;
  finished: boolean;
}
interface StatCase {
  name: string;
  params: { k: number; scale: number; anchor: number };
  population: string;
  teamA_rating?: number;
  teamB_rating?: number;
  numTeams?: number;
  ratingLow?: number;
  ratingHigh?: number;
  seed: number;
  numSimulations: number;
  expect: Record<string, { min: number; max: number }>;
}
interface Golden {
  officialParams: { k: number; scale: number; anchor: number };
  deterministic: DeterministicCase[];
  setRules: SetRuleCase[];
  statistical: StatCase[];
}

const golden = goldenRaw as unknown as Golden;
const cfg = officialConfig("male");

function uniformAverages(rating: number): CourtAverages {
  return {
    attack: rating,
    block: rating,
    serve: rating,
    receive: rating,
    setting: rating,
    libero: rating,
  };
}

function setFinished(ph: number, pa: number, limit: number, minLead: number): boolean {
  return (ph >= limit || pa >= limit) && Math.abs(ph - pa) >= minLead;
}

// -------------------------------------------------------------------------
describe("paridade: parâmetros oficiais", () => {
  it("config oficial bate com o golden", () => {
    expect(cfg.k).toBe(golden.officialParams.k);
    expect(cfg.scale).toBe(golden.officialParams.scale);
    expect(cfg.anchor).toBe(golden.officialParams.anchor);
  });
});

describe("paridade: casos determinísticos", () => {
  for (const c of golden.deterministic) {
    it(c.name, () => {
      if (c.fn === "break_probability") {
        const got = breakProbability(
          c.inputs["atk_receiver"] as number,
          c.inputs["def_server"] as number,
          cfg,
        );
        expect(got).toBeCloseTo(c.expected as number, 9);
      } else if (c.fn === "logit") {
        const got = logit(c.inputs["p"] as number);
        expect(got).toBeCloseTo(c.expected as number, 9);
      } else if (c.fn === "base_forces") {
        const attrs = c.inputs["attrs"] as Record<string, number>;
        const avg: CourtAverages = {
          attack: attrs["attack"] ?? 0,
          block: attrs["block"] ?? 0,
          serve: attrs["serve"] ?? 0,
          receive: attrs["receive"] ?? 0,
          setting: attrs["setting"] ?? 0,
          libero: attrs["libero"] ?? 0,
        };
        const got = baseForces(avg, cfg);
        const exp = c.expected as { atk: number; def: number };
        expect(got.atk).toBeCloseTo(exp.atk, 9);
        expect(got.def).toBeCloseTo(exp.def, 9);
      } else if (c.fn === "momentum_term") {
        const momCfg = withOverrides(cfg, {
          momentumEnabled: true,
          momentumGain: c.inputs["gain"] as number,
          momentumScale: c.inputs["scale"] as number,
        });
        const got = momentumTerm(
          c.inputs["streak_len"] as number,
          c.inputs["streak_is_receiver"] as boolean,
          momCfg,
        );
        expect(got).toBeCloseTo(c.expected as number, 9);
      } else {
        throw new Error(`fn desconhecida no golden: ${c.fn}`);
      }
    });
  }
});

describe("paridade: regras de fim de set", () => {
  for (const c of golden.setRules) {
    it(c.name, () => {
      const got = setFinished(c.scores[0], c.scores[1], c.limit, c.minLead);
      expect(got).toBe(c.finished);
    });
  }
});

// ---- medição estatística (espelha metrics.py) ----
interface Measured {
  sideOut: number;
  pct30: number;
  pct31: number;
  pct32: number;
  tiebreak: number;
  meanLoserPoints: number;
}

function measureEvenTeams(
  engineCfg: EngineConfig,
  ratingA: number,
  ratingB: number,
  seed: number,
  n: number,
): Measured {
  const parent = new Rng(seed);
  const fa: Forces = baseForces(uniformAverages(ratingA), engineCfg);
  const fb: Forces = baseForces(uniformAverages(ratingB), engineCfg);

  let receiverPoints = 0;
  let totalPoints = 0;
  let c30 = 0;
  let c31 = 0;
  let c32 = 0;
  let loserPointsNormal = 0;
  let normalSets = 0;

  for (let i = 0; i < n; i++) {
    const child = parent.spawn(i);
    const m = simulateMatch(engineCfg, child, fa, fb);
    const loserSets = Math.min(m.setsHome, m.setsAway);
    if (loserSets === 0) c30++;
    else if (loserSets === 1) c31++;
    else c32++;

    m.sets.forEach((s, idx) => {
      receiverPoints += s.breaksHome + s.breaksAway;
      totalPoints += s.pointsHome + s.pointsAway;
      const isNormal = idx !== 4;
      if (isNormal) {
        loserPointsNormal += Math.min(s.pointsHome, s.pointsAway);
        normalSets += 1;
      }
    });
  }

  return {
    sideOut: receiverPoints / totalPoints,
    pct30: c30 / n,
    pct31: c31 / n,
    pct32: c32 / n,
    tiebreak: c32 / n,
    meanLoserPoints: loserPointsNormal / normalSets,
  };
}

describe("paridade: estatística (times parelhos)", () => {
  const statCase = golden.statistical.find((s) => s.population === "even_teams");
  if (!statCase) {
    it.skip("caso even_teams ausente no golden", () => {});
    return;
  }
  const engineCfg = withOverrides(cfg, {
    k: statCase.params.k,
    scale: statCase.params.scale,
    anchor: statCase.params.anchor,
  });
  const m = measureEvenTeams(
    engineCfg,
    statCase.teamA_rating ?? 60,
    statCase.teamB_rating ?? 60,
    statCase.seed,
    statCase.numSimulations,
  );

  const checks: [keyof Measured, string][] = [
    ["sideOut", "side_out"],
    ["pct30", "pct_3_0"],
    ["pct31", "pct_3_1"],
    ["pct32", "pct_3_2"],
    ["tiebreak", "tiebreak_rate"],
    ["meanLoserPoints", "mean_loser_points"],
  ];

  for (const [key, goldenKey] of checks) {
    it(`${goldenKey} dentro da faixa`, () => {
      const range = statCase.expect[goldenKey];
      if (!range) throw new Error(`faixa ausente para ${goldenKey}`);
      expect(m[key]).toBeGreaterThanOrEqual(range.min);
      expect(m[key]).toBeLessThanOrEqual(range.max);
    });
  }
});
