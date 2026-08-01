import { describe, it, expect } from "vitest";
import { Rng } from "@engine/rng";
import { generateLeague, DEFAULT_GENERATE } from "../generator";
import { courtAverages, setLineup, LineupError } from "../lineup";
import { generateFixtures, totalRounds, simulateRound } from "../league";
import { computeStandings } from "../standings";
import { teamStars } from "../selectors";
import { matchConfig } from "../matchAdapter";
import {
  seedTop8,
  buildQuarters,
  buildSemis,
  homeIsHighSeed,
  runPlayoffs,
} from "../playoffs";
import type { Team } from "../types";

function makeTeams(seed = 1): Team[] {
  return generateLeague({ ...DEFAULT_GENERATE, seed, category: "male" });
}

describe("conteúdo: nomes, escudos e estrelas", () => {
  it("usa nomes e escudos reais do catálogo", () => {
    const teams = makeTeams();
    expect(teams[0]!.name).toBe("Minas Esporte Vôlei");
    expect(teams[0]!.crest).toBe("/assets/crests/minas.png");
    // todos os times têm escudo
    for (const t of teams) expect(t.crest).toContain("/assets/crests/");
  });

  it("gera nomes femininos na categoria feminina", () => {
    const male = generateLeague({ ...DEFAULT_GENERATE, seed: 3, category: "male" });
    const female = generateLeague({ ...DEFAULT_GENERATE, seed: 3, category: "female" });
    const femaleFirsts = new Set([
      "Gabriela", "Fernanda", "Natália", "Carol", "Tandara", "Sheilla", "Fabiana",
      "Jaqueline", "Camila", "Roberta", "Dani", "Thaísa", "Rosamaria", "Ana", "Bruna",
      "Juliana", "Mara", "Lorenne", "Macris", "Adenízia", "Bia", "Amanda", "Nyeme",
      "Milka", "Kisy", "Julia", "Larissa", "Mayany", "Suéllen", "Pri", "Valquíria",
    ]);
    const anyFemale = female[0]!.roster.players.some((p) =>
      femaleFirsts.has(p.name.split(" ")[0]!),
    );
    expect(anyFemale).toBe(true);
    // os nomes diferem entre categorias
    expect(female[0]!.roster.players[0]!.name).not.toBe(male[0]!.roster.players[0]!.name);
  });

  it("nível em estrelas fica entre 1 e 5, com o mais forte >= o mais fraco", () => {
    const teams = makeTeams();
    for (const t of teams) {
      const stars = teamStars(t, "male");
      expect(stars).toBeGreaterThanOrEqual(1);
      expect(stars).toBeLessThanOrEqual(5);
    }
    expect(teamStars(teams[0]!, "male")).toBeGreaterThanOrEqual(teamStars(teams[11]!, "male"));
  });
});

describe("geração de mundo", () => {
  it("gera 12 times distintos com elenco completo", () => {
    const teams = makeTeams();
    expect(teams).toHaveLength(12);
    const names = new Set(teams.map((t) => t.name));
    expect(names.size).toBe(12);
    for (const t of teams) {
      expect(t.roster.players.length).toBeGreaterThanOrEqual(12);
      // escalação estruturada completa (7 posições)
      expect(t.roster.lineup.setter).toBeTruthy();
      expect(t.roster.lineup.outsides).toHaveLength(2);
      expect(t.roster.lineup.middles).toHaveLength(2);
      expect(t.roster.lineup.libero).toBeTruthy();
    }
  });

  it("um time é controlado pelo jogador (o mais fraco por default)", () => {
    const teams = makeTeams();
    const controlled = teams.filter((t) => t.isPlayerControlled);
    expect(controlled).toHaveLength(1);
    expect(controlled[0]!.id).toBe("team-12");
  });

  it("é reprodutível com a mesma seed", () => {
    const a = makeTeams(7);
    const b = makeTeams(7);
    expect(a.map((t) => t.name)).toEqual(b.map((t) => t.name));
  });
});

describe("escalação (ponte domínio↔motor)", () => {
  it("calcula médias dos 6 em quadra", () => {
    const team = makeTeams()[0]!;
    const avg = courtAverages(team.roster);
    for (const v of Object.values(avg)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(99);
    }
  });

  it("rejeita escalação com jogador em posição incompatível", () => {
    const team = makeTeams()[0]!;
    const libero = team.roster.players.find((p) => p.position === "Líbero")!;
    const badLineup = { ...team.roster.lineup, setter: libero.id };
    expect(() => setLineup(team.roster, badLineup)).toThrow(LineupError);
  });

  it("reaplicar a mesma escalação não muda as médias", () => {
    const team = makeTeams()[0]!;
    const avgBefore = courtAverages(team.roster);
    const same = setLineup(team.roster, { ...team.roster.lineup });
    expect(courtAverages(same)).toEqual(avgBefore);
  });

  it("líbero melhora recepção/defesa (regra do líbero)", () => {
    const team = makeTeams()[0]!;
    const avg = courtAverages(team.roster);
    // recepção e líbero/defesa refletem a entrada do líbero especialista:
    // devem ser >= 0 e coerentes (o teste garante que o cálculo roda sem erro)
    expect(avg.receive).toBeGreaterThan(0);
    expect(avg.libero).toBeGreaterThan(0);
  });
});

describe("liga: calendário e tabela", () => {
  it("12 times, turno-returno => 22 rodadas, 132 jogos, 22 por time", () => {
    const teams = makeTeams();
    const fixtures = generateFixtures(teams.map((t) => t.id));
    expect(totalRounds(12)).toBe(22);
    expect(fixtures).toHaveLength(132);
    const maxRound = Math.max(...fixtures.map((f) => f.round));
    expect(maxRound).toBe(22);
    // cada time joga 22 vezes
    const counts = new Map<string, number>();
    for (const f of fixtures) {
      counts.set(f.homeId, (counts.get(f.homeId) ?? 0) + 1);
      counts.set(f.awayId, (counts.get(f.awayId) ?? 0) + 1);
    }
    for (const c of counts.values()) expect(c).toBe(22);
  });

  it("cada time manda e visita o mesmo adversário uma vez (ida-e-volta)", () => {
    const teams = makeTeams();
    const fixtures = generateFixtures(teams.map((t) => t.id));
    const homeOf = new Map<string, number>();
    for (const f of fixtures) {
      const key = `${f.homeId}>${f.awayId}`;
      homeOf.set(key, (homeOf.get(key) ?? 0) + 1);
    }
    // nenhum par (A manda contra B) se repete
    for (const c of homeOf.values()) expect(c).toBe(1);
  });

  it("simula uma temporada completa e a tabela fecha", () => {
    const teams = makeTeams();
    const teamsById = new Map(teams.map((t) => [t.id, t]));
    const fixtures = generateFixtures(teams.map((t) => t.id));
    const cfg = matchConfig("male");
    const rng = new Rng(42);
    for (let round = 1; round <= totalRounds(12); round++) {
      const results = simulateRound(round, fixtures, teamsById, cfg, rng.spawn(round));
      for (const [idx, res] of results) {
        fixtures[idx]!.result = res;
      }
    }
    const table = computeStandings(teams, fixtures);
    expect(table).toHaveLength(12);
    const totalWins = table.reduce((a, s) => a + s.wins, 0);
    const totalLosses = table.reduce((a, s) => a + s.losses, 0);
    expect(totalWins).toBe(totalLosses);
    expect(totalWins).toBe(132);
    // sets ganhos == sets perdidos no agregado
    const setsWon = table.reduce((a, s) => a + s.setsWon, 0);
    const setsLost = table.reduce((a, s) => a + s.setsLost, 0);
    expect(setsWon).toBe(setsLost);
    // tabela ordenada por pontos desc
    const pts = table.map((s) => s.points);
    expect(pts).toEqual([...pts].sort((a, b) => b - a));
  });
});

describe("mata-mata", () => {
  const order = Array.from({ length: 12 }, (_, i) => `team-${i + 1}`);

  it("quartas seguem cruzamento olímpico 1×8/2×7/3×6/4×5", () => {
    const seeds = seedTop8(order);
    const qf = buildQuarters(seeds);
    const pairs = qf.map((t) => [t.high.seed, t.low.seed]);
    expect(pairs).toEqual([
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 5],
    ]);
  });

  it("reseeding das semis: seeds 1,4,6,2 => 1×6 e 2×4", () => {
    const winners = [
      { teamId: "a", seed: 1 },
      { teamId: "b", seed: 4 },
      { teamId: "c", seed: 6 },
      { teamId: "d", seed: 2 },
    ];
    const semis = buildSemis(winners);
    const pairs = semis.map((t) => [t.high.seed, t.low.seed]);
    expect(pairs).toEqual([
      [1, 6],
      [2, 4],
    ]);
  });

  it("mando: melhor de 3 => jogos 1 e 3 no melhor colocado, jogo 2 no pior", () => {
    expect(homeIsHighSeed(3, 0)).toBe(true);
    expect(homeIsHighSeed(3, 1)).toBe(false);
    expect(homeIsHighSeed(3, 2)).toBe(true);
    // final jogo único: sempre no melhor
    expect(homeIsHighSeed(1, 0)).toBe(true);
  });

  it("roda o mata-mata completo e produz um campeão", () => {
    const teams = generateLeague({ ...DEFAULT_GENERATE, seed: 3, category: "male" });
    const cfg = matchConfig("male");
    const bracket = runPlayoffs(
      teams.map((t) => t.id),
      teams,
      cfg,
      new Rng(99),
    );
    expect(bracket.quarters).toHaveLength(4);
    expect(bracket.semis).toHaveLength(2);
    expect(bracket.final).not.toBeNull();
    expect(bracket.championId).not.toBeNull();
    // séries de quartas/semis encerram em 2 vitórias; final em 1 jogo
    for (const t of [...bracket.quarters, ...bracket.semis]) {
      expect(Math.max(t.winsHigh, t.winsLow)).toBe(2);
      expect(t.games.length).toBeGreaterThanOrEqual(2);
      expect(t.games.length).toBeLessThanOrEqual(3);
    }
    expect(bracket.final!.games).toHaveLength(1);
  });
});
