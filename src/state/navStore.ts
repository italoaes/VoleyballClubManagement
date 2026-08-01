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
  | "menu";

interface NavStore {
  screen: Screen;
  go: (screen: Screen) => void;
}

export const useNavStore = create<NavStore>((set) => ({
  screen: "title",
  go: (screen) => set({ screen }),
}));
