import { describe, it, expect } from "vitest";
import {
  seasonLabel,
  objectiveForTeam,
  evaluateObjective,
  generateOffers,
  managerReputation,
  requiredReputation,
} from "../career";
import { generateLeague, DEFAULT_GENERATE } from "../generator";

function teams() {
  return generateLeague({ ...DEFAULT_GENERATE, seed: 5, category: "male" });
}

describe("carreira: rótulo de temporada", () => {
  it("26 => 26/27, 27 => 27/28, 99 => 99/00", () => {
    expect(seasonLabel(26)).toBe("26/27");
    expect(seasonLabel(27)).toBe("27/28");
    expect(seasonLabel(99)).toBe("99/00");
  });
});

describe("carreira: objetivos", () => {
  it("time forte cobra título; time fraco cobra evitar rebaixamento", () => {
    const ts = teams();
    const strongest = ts[0]!;
    const weakest = ts[ts.length - 1]!;
    const objStrong = objectiveForTeam(strongest, ts.length);
    const objWeak = objectiveForTeam(weakest, ts.length);
    expect(["title", "playoffs"]).toContain(objStrong.type);
    expect(["avoid_bottom", "midtable"]).toContain(objWeak.type);
  });

  it("avalia cumprimento por posição/título", () => {
    const playoffs = { type: "playoffs" as const, description: "", targetPosition: 8 };
    expect(evaluateObjective(playoffs, 5, false)).toBe(true);
    expect(evaluateObjective(playoffs, 9, false)).toBe(false);
    const title = { type: "title" as const, description: "", targetPosition: 1 };
    expect(evaluateObjective(title, 1, true)).toBe(true);
    expect(evaluateObjective(title, 1, false)).toBe(false);
  });
});

describe("carreira: propostas", () => {
  it("sempre inclui a renovação com o time atual", () => {
    const ts = teams();
    const current = ts[ts.length - 1]!; // fraco
    const offers = generateOffers(current, ts, 10, false, false, ts.length, 42);
    const renewal = offers.find((o) => o.isRenewal);
    expect(renewal).toBeDefined();
    expect(renewal!.teamId).toBe(current.id);
  });

  it("bom desempenho (campeão + meta) gera propostas externas", () => {
    const ts = teams();
    const current = ts[ts.length - 1]!; // fraco, mas superou tudo
    // campeão + objetivo cumprido + 1º lugar => reputação máxima
    const offers = generateOffers(current, ts, 1, true, true, ts.length, 42);
    const external = offers.filter((o) => !o.isRenewal);
    expect(external.length).toBeGreaterThan(0);
  });

  it("desempenho fraco NÃO gera proposta de time forte (o bug do print)", () => {
    const ts = teams();
    // time fraco (2★, penúltimo) que NÃO cumpriu a meta => reputação baixa
    const current = ts[ts.length - 1]!;
    const penultimate = ts.length - 1; // penúltimo de N
    const offers = generateOffers(current, ts, penultimate, false, false, ts.length, 42);
    const external = offers.filter((o) => !o.isRenewal);
    // nenhuma proposta de time 4-5 estrelas para quem foi mal
    for (const o of external) {
      expect(o.stars).toBeLessThanOrEqual(3);
    }
  });

  it("reputação: cair na parte de baixo sem cumprir a meta zera a reputação", () => {
    const low = managerReputation({
      currentStars: 2,
      leaguePosition: 11,
      numTeams: 12,
      objectiveMet: false,
      wasChampion: false,
    });
    expect(low).toBe(0);

    const high = managerReputation({
      currentStars: 2,
      leaguePosition: 1,
      numTeams: 12,
      objectiveMet: true,
      wasChampion: true,
    });
    expect(high).toBeGreaterThanOrEqual(9);
  });

  it("times fortes exigem reputação alta (requiredReputation)", () => {
    expect(requiredReputation(5)).toBeGreaterThan(requiredReputation(3));
    expect(requiredReputation(3)).toBeGreaterThan(requiredReputation(1));
  });
});
