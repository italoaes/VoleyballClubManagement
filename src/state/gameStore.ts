/**
 * Store Zustand — cola entre as ações puras (actions.ts) e a UI.
 *
 * Mantém o GameState (fonte única de verdade) e dispara auto-save por rodada.
 * Toda a lógica de transição vive em actions.ts (puro/testável); a store só
 * invoca e guarda.
 */

import { create } from "zustand";
import type { Category, GameState, Lineup, MatchResult } from "@domain/types";
import {
  advance,
  cancelTraining,
  commitPlayerRound,
  investPD,
  newGame,
  startNextSeason,
  startTraining,
  updatePlayerLineup,
  type NewGameOptions,
} from "./actions";
import type { Fundamental } from "@domain/types";
import { seasonLabel } from "@domain/career";
import { saveGame } from "@persistence/saveStore";

const DEFAULT_SLOT = "slot-1";

interface GameStore {
  state: GameState | null;
  slot: string;

  startNewGame: (opts: NewGameOptions, slot?: string) => void;
  loadState: (state: GameState, slot?: string) => void;
  setLineup: (lineup: Lineup) => void;
  advance: () => void;
  commitRound: (playerResult: MatchResult) => void;
  nextSeason: (chosenTeamId: string) => void;
  investPD: (playerId: string, fundamental: Fundamental) => void;
  startTraining: (playerId: string, fundamental: Fundamental) => void;
  cancelTraining: () => void;
  saveNow: () => Promise<void>;

  playerTeamName: () => string;
}

function label(state: GameState): string {
  const team = state.teams.find((t) => t.id === state.playerTeamId);
  const cat = state.category === "male" ? "M" : "F";
  return `${team?.name ?? "Time"} · ${cat} · ${seasonLabel(state.season)}`;
}

function persist(slot: string, state: GameState): void {
  // fire-and-forget; erros de persistência não devem travar o jogo
  void saveGame(slot, state, label(state)).catch((err) => {
    console.error("falha ao salvar:", err);
  });
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  slot: DEFAULT_SLOT,

  startNewGame: (opts, slot = DEFAULT_SLOT) => {
    const state = newGame(opts);
    set({ state, slot });
    persist(slot, state);
  },

  loadState: (state, slot = DEFAULT_SLOT) => {
    set({ state, slot });
  },

  setLineup: (lineup) => {
    const { state } = get();
    if (!state) return;
    const next = updatePlayerLineup(state, lineup);
    set({ state: next });
    persist(get().slot, next);
  },

  advance: () => {
    const { state } = get();
    if (!state) return;
    const next = advance(state);
    set({ state: next });
    persist(get().slot, next);
  },

  commitRound: (playerResult) => {
    const { state } = get();
    if (!state) return;
    const next = commitPlayerRound(state, playerResult);
    set({ state: next });
    persist(get().slot, next);
  },

  nextSeason: (chosenTeamId) => {
    const { state } = get();
    if (!state) return;
    const next = startNextSeason(state, chosenTeamId);
    set({ state: next });
    persist(get().slot, next);
  },

  investPD: (playerId, fundamental) => {
    const { state } = get();
    if (!state) return;
    const next = investPD(state, playerId, fundamental);
    set({ state: next });
    persist(get().slot, next);
  },

  startTraining: (playerId, fundamental) => {
    const { state } = get();
    if (!state) return;
    const next = startTraining(state, playerId, fundamental);
    set({ state: next });
    persist(get().slot, next);
  },

  cancelTraining: () => {
    const { state } = get();
    if (!state) return;
    const next = cancelTraining(state);
    set({ state: next });
    persist(get().slot, next);
  },

  saveNow: async () => {
    const { state, slot } = get();
    if (!state) return;
    await saveGame(slot, state, label(state));
  },

  playerTeamName: () => {
    const { state } = get();
    if (!state) return "";
    return state.teams.find((t) => t.id === state.playerTeamId)?.name ?? "";
  },
}));

export type { Category };
