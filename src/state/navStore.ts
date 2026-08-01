/**
 * Navegação de UI — separada do GameState (que é o domínio serializável).
 * Telas do MVP.
 */

import { create } from "zustand";

export type Screen =
  | "title"
  | "new-game"
  | "dashboard"
  | "squad"
  | "match-preview"
  | "live-match"
  | "match-result"
  | "standings"
  | "playoffs"
  | "season-end"
  | "offers"
  | "results"
  | "roster"
  | "development"
  | "manager"
  | "team-view"
  | "menu";

interface NavStore {
  screen: Screen;
  /** time a exibir na tela "team-view" (elenco de outro time, read-only). */
  viewTeamId: string | null;
  /** tela para voltar ao fechar a "team-view". */
  viewReturnTo: Screen;
  go: (screen: Screen) => void;
  /** abre a visão de elenco de um time, lembrando de onde voltar. */
  viewTeam: (teamId: string, returnTo: Screen) => void;
}

export const useNavStore = create<NavStore>((set) => ({
  screen: "title",
  viewTeamId: null,
  viewReturnTo: "dashboard",
  go: (screen) => set({ screen }),
  viewTeam: (teamId, returnTo) =>
    set({ screen: "team-view", viewTeamId: teamId, viewReturnTo: returnTo }),
}));
