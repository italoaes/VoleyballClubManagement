/**
 * Store transitória da partida ao vivo do jogador (não persiste — é derivada).
 * Orquestra: iniciar partida → jogar sets → substituir no intervalo → finalizar.
 */

import { create } from "zustand";
import {
  createLiveMatch,
  playNextSet,
  toMatchResult,
  MAX_SUBS_PER_BREAK,
  type LiveMatchState,
} from "@domain/liveMatch";
import { substitute } from "@domain/lineup";
import type { MatchResult, Team } from "@domain/types";

interface MatchStore {
  live: LiveMatchState | null;
  /** substituições restantes no intervalo atual. */
  subsLeft: number;

  begin: (
    category: LiveMatchState["category"],
    playerTeam: Team,
    opponent: Team,
    playerIsHome: boolean,
    baseSeed: number,
  ) => void;
  playSet: () => void;
  makeSub: (outId: string, inId: string) => void;
  resetSubs: () => void;
  result: () => MatchResult | null;
  clear: () => void;
}

export const useMatchStore = create<MatchStore>((set, get) => ({
  live: null,
  subsLeft: MAX_SUBS_PER_BREAK,

  begin: (category, playerTeam, opponent, playerIsHome, baseSeed) => {
    set({
      live: createLiveMatch(category, playerTeam, opponent, playerIsHome, baseSeed),
      subsLeft: MAX_SUBS_PER_BREAK,
    });
  },

  playSet: () => {
    const { live } = get();
    if (!live) return;
    set({ live: playNextSet(live), subsLeft: MAX_SUBS_PER_BREAK });
  },

  makeSub: (outId, inId) => {
    const { live, subsLeft } = get();
    if (!live || subsLeft <= 0) return;
    const newLineup = substitute(live.playerTeam.roster, outId, inId);
    const playerTeam: Team = {
      ...live.playerTeam,
      roster: { ...live.playerTeam.roster, lineup: newLineup },
    };
    set({ live: { ...live, playerTeam }, subsLeft: subsLeft - 1 });
  },

  resetSubs: () => set({ subsLeft: MAX_SUBS_PER_BREAK }),

  result: () => {
    const { live } = get();
    if (!live || !live.finished) return null;
    return toMatchResult(live);
  },

  clear: () => set({ live: null, subsLeft: MAX_SUBS_PER_BREAK }),
}));
