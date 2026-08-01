import { describe, it, expect } from "vitest";
import { generateLeague, DEFAULT_GENERATE } from "../generator";
import { pickMatchMvp } from "../mvp";
import { courtAverages, lineupIds } from "../lineup";
import type { MatchResult, Team } from "../types";

function teams(): Team[] {
  return generateLeague({ ...DEFAULT_GENERATE, seed: 5, category: "male" });
}

function fakeResult(home: Team, away: Team, homeWon: boolean): MatchResult {
  return {
    homeId: home.id,
    awayId: away.id,
    sets: [],
    setsHome: homeWon ? 3 : 1,
    setsAway: homeWon ? 1 : 3,
    winnerId: homeWon ? home.id : away.id,
    loserId: homeWon ? away.id : home.id,
    wentToTiebreak: false,
    totalPointsHome: 0,
    totalPointsAway: 0,
    mvpId: null,
  };
}

describe("MVP da partida (heurística)", () => {
  it("é determinístico: mesma partida => mesmo MVP", () => {
    const [a, b] = teams();
    const r = fakeResult(a!, b!, true);
    const m1 = pickMatchMvp(a!, b!, r);
    const m2 = pickMatchMvp(a!, b!, r);
    expect(m1).toBe(m2);
  });

  it("o MVP é um dos 6 escalados de um dos times", () => {
    const [a, b] = teams();
    const r = fakeResult(a!, b!, true);
    const mvp = pickMatchMvp(a!, b!, r);
    const all = new Set([...lineupIds(a!.roster.lineup), ...lineupIds(b!.roster.lineup)]);
    expect(all.has(mvp)).toBe(true);
  });

  it("tende a vir do vencedor (fator de vitória)", () => {
    // com dois times de força parecida, o vencedor deve fornecer o MVP na maioria
    const ts = teams();
    let fromWinner = 0;
    const n = Math.min(6, ts.length - 1);
    for (let i = 0; i < n; i++) {
      const a = ts[i]!;
      const b = ts[i + 1]!;
      const r = fakeResult(a, b, true);
      const mvp = pickMatchMvp(a, b, r);
      if (lineupIds(a.roster.lineup).includes(mvp)) fromWinner++;
    }
    expect(fromWinner).toBeGreaterThan(n / 2);
  });

  it("varia por partida: partidas diferentes podem ter MVPs diferentes (não é sempre o craque)", () => {
    const [a, b] = teams();
    const mvps = new Set<string>();
    // 30 partidas com placares (assinaturas) diferentes → o MVP deve variar
    for (let i = 0; i < 30; i++) {
      const r: MatchResult = {
        ...fakeResult(a!, b!, true),
        sets: [
          { pointsHome: 25, pointsAway: 20 + (i % 5), winnerId: a!.id },
          { pointsHome: 25, pointsAway: 18 + (i % 6), winnerId: a!.id },
          { pointsHome: 22 + (i % 4), pointsAway: 25, winnerId: b!.id },
        ],
        totalPointsHome: 70 + i,
        totalPointsAway: 60 + (i % 7),
      };
      mvps.add(pickMatchMvp(a!, b!, r));
    }
    // mais de um jogador diferente foi MVP ao longo das partidas
    expect(mvps.size).toBeGreaterThan(1);
  });

  it("continua determinístico: mesma partida => mesmo MVP", () => {
    const [a, b] = teams();
    const r: MatchResult = {
      ...fakeResult(a!, b!, true),
      sets: [{ pointsHome: 25, pointsAway: 21, winnerId: a!.id }],
      totalPointsHome: 75,
      totalPointsAway: 60,
    };
    expect(pickMatchMvp(a!, b!, r)).toBe(pickMatchMvp(a!, b!, r));
  });
});

describe("bônus da estrela em quadra (courtAverages)", () => {
  it("estrela atacante dá +2 no ataque agregado; sem estrela não muda", () => {
    const team = teams()[0]!;
    const before = courtAverages(team.roster);

    // marca o ponteiro titular como estrela
    const outsideId = team.roster.lineup.outsides[0];
    const withStar: Team = {
      ...team,
      roster: {
        ...team.roster,
        players: team.roster.players.map((p) =>
          p.id === outsideId ? { ...p, isStar: true } : p,
        ),
      },
    };
    const after = courtAverages(withStar.roster);
    expect(after.attack).toBeCloseTo(before.attack + 2, 5);
  });

  it("estrela líbero dá +2 na defesa (recepção e líbero)", () => {
    const team = teams()[0]!;
    const before = courtAverages(team.roster);
    const liberoId = team.roster.lineup.libero;
    const withStar: Team = {
      ...team,
      roster: {
        ...team.roster,
        players: team.roster.players.map((p) =>
          p.id === liberoId ? { ...p, isStar: true } : p,
        ),
      },
    };
    const after = courtAverages(withStar.roster);
    expect(after.receive).toBeCloseTo(before.receive + 2, 5);
    expect(after.libero).toBeCloseTo(before.libero + 2, 5);
  });
});
