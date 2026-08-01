/**
 * Catálogo de avatares do gestor (retratos em public/assets/avatars).
 * 3 masculinos + 3 femininos. O usuário escolhe um na criação do jogo.
 */

import type { Category } from "./types";

export interface AvatarOption {
  id: string;
  src: string;
  gender: "male" | "female";
}

export const AVATARS: readonly AvatarOption[] = [
  { id: "male-1", src: "/assets/avatars/male-1.png", gender: "male" },
  { id: "male-2", src: "/assets/avatars/male-2.png", gender: "male" },
  { id: "male-3", src: "/assets/avatars/male-3.png", gender: "male" },
  { id: "female-1", src: "/assets/avatars/female-1.png", gender: "female" },
  { id: "female-2", src: "/assets/avatars/female-2.png", gender: "female" },
  { id: "female-3", src: "/assets/avatars/female-3.png", gender: "female" },
];

/** Avatar default sugerido para uma categoria. */
export function defaultAvatar(category: Category): string {
  const found = AVATARS.find((a) => a.gender === category);
  return found?.src ?? AVATARS[0]!.src;
}

/** Resolve o src a partir de um id (com fallback). */
export function avatarSrc(id: string): string {
  return AVATARS.find((a) => a.id === id)?.src ?? AVATARS[0]!.src;
}
