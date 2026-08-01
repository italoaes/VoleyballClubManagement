import { describe, it, expect } from "vitest";
import { Position, SCHEMA_VERSION } from "./types";
import type { GameState, Player } from "./types";

describe("domain/types (smoke)", () => {
  it("expõe as 5 posições do vôlei", () => {
    expect(Object.values(Position)).toEqual([
      "Levantador",
      "Ponteiro",
      "Central",
      "Oposto",
      "Líbero",
    ]);
  });

  it("SCHEMA_VERSION é um inteiro positivo", () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("um GameState mínimo é construível e serializável (JSON round-trip)", () => {
    const player: Player = {
      id: "p1",
      name: "Teste",
      position: Position.Setter,
      age: 25,
      attributes: { attack: 60, block: 60, serve: 60, receive: 60, setting: 60, libero: 60 },
      potential: 70,
      growthProgress: 0,
      number: 1,
      setsPlayed: 0,
      isStar: false,
      seasonMvpCount: 0,
      careerMvpCount: 0,
    };
    const state: GameState = {
      schemaVersion: SCHEMA_VERSION,
      seed: 42,
      category: "male",
      managerName: "Gestor",
      managerAvatar: "/assets/avatars/male-1.png",
      playerTeamId: "t1",
      teams: [
        {
          id: "t1",
          name: "Time Teste",
          shortName: "TT",
          city: "Cidade",
          crest: "/assets/crests/minas.png",
          roster: {
            players: [player],
            lineup: {
              setter: "p1",
              outsides: ["p1", "p1"],
              middles: ["p1", "p1"],
              opposite: "p1",
              libero: "p1",
            },
          },
          isPlayerControlled: true,
        },
      ],
      fixtures: [],
      standings: [],
      currentRound: 1,
      phase: "league",
      playoffs: null,
      season: 26,
      objective: { type: "midtable", description: "Meio da tabela", targetPosition: 6 },
      history: [],
      offers: null,
      development: { points: 0, training: null },
      reigningMvpId: null,
      seasonMvpTally: {},
      pendingPlayoffGame: null,
    };
    const roundTrip = JSON.parse(JSON.stringify(state)) as GameState;
    expect(roundTrip).toEqual(state);
  });
});
