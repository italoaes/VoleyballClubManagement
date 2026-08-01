import { describe, it, expect } from "vitest";
import { newGame, updatePlayerLineup, advance, startNextSeason } from "../actions";
import type { GameState } from "@domain/types";
import { migrate, SaveVersionError } from "@persistence/migrations";
import { SCHEMA_VERSION } from "@domain/types";

function freshGame(): GameState {
  return newGame({
    seed: 42,
    category: "male",
    managerName: "Gestor",
    managerAvatar: "/assets/avatars/male-1.png",
    playerTeamIndex: 11,
  });
}

describe("actions: novo jogo", () => {
  it("cria estado inicial coerente", () => {
    const s = freshGame();
    expect(s.teams).toHaveLength(12);
    expect(s.fixtures).toHaveLength(132);
    expect(s.currentRound).toBe(1);
    expect(s.phase).toBe("league");
    expect(s.playoffs).toBeNull();
    expect(s.teams.find((t) => t.id === s.playerTeamId)?.isPlayerControlled).toBe(true);
  });

  it("é serializável (JSON round-trip idêntico)", () => {
    const s = freshGame();
    const rt = JSON.parse(JSON.stringify(s)) as GameState;
    expect(rt).toEqual(s);
  });
});

describe("actions: escalação", () => {
  it("atualiza a escalação do time do jogador", () => {
    const s = freshGame();
    const team = s.teams.find((t) => t.id === s.playerTeamId)!;
    // troca o líbero titular pelo líbero reserva
    const liberos = team.roster.players.filter((p) => p.position === "Líbero");
    const reserveLibero = liberos.find((p) => p.id !== team.roster.lineup.libero)!;
    const newLineup = { ...team.roster.lineup, libero: reserveLibero.id };
    const next = updatePlayerLineup(s, newLineup);
    const updated = next.teams.find((t) => t.id === s.playerTeamId)!;
    expect(updated.roster.lineup.libero).toBe(reserveLibero.id);
  });
});

describe("actions: avançar (liga -> mata-mata -> fim)", () => {
  it("simula a liga inteira e transiciona para o mata-mata", () => {
    let s = freshGame();
    // 22 rodadas
    for (let i = 0; i < 22; i++) {
      s = advance(s);
    }
    expect(s.phase).toBe("playoffs");
    expect(s.playoffs).not.toBeNull();
    expect(s.playoffs!.quarters).toHaveLength(4);
    // todos os fixtures jogados
    expect(s.fixtures.every((f) => f.result !== null)).toBe(true);
  });

  it("resolve o mata-mata (jogo a jogo) até coroar um campeão", () => {
    let s = freshGame();
    for (let i = 0; i < 22; i++) s = advance(s);
    expect(s.phase).toBe("playoffs");
    // avança jogo a jogo até terminar (guard contra loop infinito)
    let guard = 0;
    while (s.phase !== "finished" && guard < 100) {
      s = advance(s);
      guard++;
    }
    expect(s.phase).toBe("finished");
    expect(s.playoffs!.semis).toHaveLength(2);
    expect(s.playoffs!.final).not.toBeNull();
    expect(s.playoffs!.championId).not.toBeNull();
  });

  it("é reprodutível: mesma seed => mesmo campeão", () => {
    const run = (): string => {
      let s = newGame({
        seed: 7,
        category: "male",
        managerName: "G",
        managerAvatar: "/assets/avatars/male-1.png",
        playerTeamIndex: 0,
      });
      while (s.phase !== "finished") s = advance(s);
      return s.playoffs!.championId!;
    };
    expect(run()).toBe(run());
  });
});

describe("actions: múltiplas temporadas e carreira", () => {
  it("nova temporada renova com o mesmo time, zera liga e avança o ano", () => {
    let s = freshGame();
    while (s.phase !== "finished") s = advance(s);
    expect(s.history).toHaveLength(1);
    expect(s.offers).not.toBeNull();
    const teamsBefore = s.teams.map((t) => t.id);

    // renova com o time atual (renovação sempre disponível)
    const next = startNextSeason(s, s.playerTeamId);
    expect(next.season).toBe(27); // começou em 26
    expect(next.phase).toBe("league");
    expect(next.currentRound).toBe(1);
    expect(next.playoffs).toBeNull();
    expect(next.offers).toBeNull();
    expect(next.objective).toBeDefined();
    // mesmo elenco preservado (mesmos ids)
    expect(next.teams.map((t) => t.id)).toEqual(teamsBefore);
    // jogadores envelhecem +1 ano na virada de temporada
    expect(next.teams[0]!.roster.players[0]!.age).toBe(
      s.teams[0]!.roster.players[0]!.age + 1,
    );
    // sets jogados zerados na nova temporada
    expect(next.teams[0]!.roster.players.every((p) => p.setsPlayed === 0)).toBe(true);
    // histórico preservado
    expect(next.history).toHaveLength(1);
    // fixtures zerados (nenhum resultado)
    expect(next.fixtures.every((f) => f.result === null)).toBe(true);
  });

  it("registra título quando o jogador é campeão", () => {
    // roda várias seeds até o time do jogador (mais forte) ser campeão
    let recorded = false;
    for (let seed = 0; seed < 5 && !recorded; seed++) {
      let s = newGame({
        seed,
        category: "male",
        managerName: "G",
        managerAvatar: "/assets/avatars/male-1.png",
        playerTeamIndex: 0,
      });
      while (s.phase !== "finished") s = advance(s);
      const rec = s.history[0]!;
      expect(rec.season).toBe(26);
      expect(rec.seasonLabel).toBe("26/27");
      expect(typeof rec.championName).toBe("string");
      expect(rec.objective).toBeDefined();
      if (rec.playerWasChampion) recorded = true;
    }
    expect(recorded).toBe(true);
  });

  it("carreira preserva histórico ao trocar de time", () => {
    let s = freshGame();
    while (s.phase !== "finished") s = advance(s);
    const otherTeam = s.teams.find((t) => t.id !== s.playerTeamId)!;
    const next = startNextSeason(s, otherTeam.id);
    expect(next.playerTeamId).toBe(otherTeam.id);
    // histórico da temporada anterior (com o time antigo) permanece
    expect(next.history).toHaveLength(1);
    expect(next.history[0]!.teamId).toBe(s.playerTeamId);
  });

  it("playoffs avançam por RODADA: 1 jogo em cada confronto pendente", () => {
    let s = freshGame();
    while (s.phase === "league") s = advance(s);
    expect(s.phase).toBe("playoffs");
    // 4 confrontos nas quartas: a primeira chamada joga o jogo 1 de TODOS (4 jogos)
    const quarterGames = (st: typeof s): number =>
      (st.playoffs?.quarters ?? []).reduce((a, t) => a + t.games.length, 0);
    expect(quarterGames(s)).toBe(0);
    s = advance(s);
    expect(quarterGames(s)).toBe(4);
    // cada confronto está 1-0 ou já com um jogo; nenhum passou de 1 jogo ainda
    for (const t of s.playoffs!.quarters) {
      expect(t.games.length).toBe(1);
    }
    // segunda chamada joga o jogo 2 de todos => 8 jogos no total das quartas
    s = advance(s);
    expect(quarterGames(s)).toBe(8);
  });
});

describe("persistence: migração de save", () => {
  it("save da versão atual passa sem alteração", () => {
    const s = freshGame();
    const migrated = migrate(JSON.parse(JSON.stringify(s)) as Record<string, unknown>);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("save de versão futura é rejeitado", () => {
    const bogus = { schemaVersion: SCHEMA_VERSION + 5 } as Record<string, unknown>;
    expect(() => migrate(bogus)).toThrow(SaveVersionError);
  });

  it("migra save v1 (courtIds) para v2 (lineup estruturado)", () => {
    const v1 = {
      schemaVersion: 1,
      teams: [
        {
          id: "t1",
          roster: {
            courtIds: ["s1", "o1", "o2", "m1", "m2", "op1"],
            players: [
              { id: "s1", position: "Levantador" },
              { id: "o1", position: "Ponteiro" },
              { id: "o2", position: "Ponteiro" },
              { id: "m1", position: "Central" },
              { id: "m2", position: "Central" },
              { id: "op1", position: "Oposto" },
              { id: "l1", position: "Líbero" },
            ],
          },
        },
      ],
    } as Record<string, unknown>;
    const migrated = migrate(v1);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    const roster = migrated.teams[0]!.roster;
    expect(roster.lineup.setter).toBe("s1");
    expect(roster.lineup.libero).toBe("l1");
    expect(roster.lineup.middles).toEqual(["m1", "m2"]);
    // migra em cadeia até v4: season vira ano de início (26), objetivo/offers criados
    expect(migrated.season).toBe(26);
    expect(migrated.history).toEqual([]);
    expect(migrated.objective).toBeDefined();
    expect(migrated.offers).toBeNull();
  });
});
