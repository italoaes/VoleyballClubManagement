/**
 * Nomes fictícios para times e jogadores.
 *
 * Times: baseados em cidades brasileiras com tradição na Superliga, com sufixos
 * de clube fictícios (evita licenciamento de marcas reais).
 * Jogadores: combinação de primeiros nomes + sobrenomes brasileiros.
 */

import type { Rng } from "@engine/rng";
import type { Category } from "./types";

const MALE_FIRST_NAMES: readonly string[] = [
  "Bruno", "Lucas", "Gabriel", "Rafael", "Thiago", "Felipe", "Matheus", "Douglas",
  "Ricardo", "Wallace", "Maurício", "Éder", "Leandro", "Alan", "Otávio", "Renan",
  "Fernando", "Isac", "Lucão", "Cachopa", "Darlan", "Adriano", "Serginho", "Murilo",
  "Yoandy", "Vinícius", "Henrique", "Arthur", "Caio", "Pedro", "João", "Guilherme",
];

const FEMALE_FIRST_NAMES: readonly string[] = [
  "Gabriela", "Fernanda", "Natália", "Carol", "Tandara", "Sheilla", "Fabiana", "Jaqueline",
  "Camila", "Roberta", "Dani", "Thaísa", "Rosamaria", "Ana", "Bruna", "Juliana",
  "Mara", "Lorenne", "Macris", "Adenízia", "Bia", "Amanda", "Nyeme", "Milka",
  "Kisy", "Julia", "Larissa", "Mayany", "Suéllen", "Pri", "Valquíria", "Ana Cristina",
];

const LAST_NAMES: readonly string[] = [
  "Silva", "Santos", "Oliveira", "Souza", "Costa", "Pereira", "Almeida", "Rodrigues",
  "Ferreira", "Gomes", "Martins", "Araújo", "Ribeiro", "Carvalho", "Barbosa", "Rocha",
  "Nascimento", "Lima", "Moraes", "Cardoso", "Teixeira", "Fernandes", "Correia", "Dias",
  "Monteiro", "Mendes", "Freitas", "Cavalcanti", "Nunes", "Ramos", "Pinto", "Azevedo",
];

/** Escolhe um elemento de uma lista usando o RNG. */
function pick<T>(items: readonly T[], rng: Rng): T {
  const idx = rng.integers(0, items.length);
  const item = items[idx];
  if (item === undefined) {
    throw new Error("pick: índice fora do intervalo (lista vazia?)");
  }
  return item;
}

/** Gera um nome de jogador único conforme a categoria, garantindo unicidade. */
export function makePlayerName(rng: Rng, used: Set<string>, category: Category): string {
  const firstNames = category === "female" ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
  for (let attempt = 0; attempt < 50; attempt++) {
    const name = `${pick(firstNames, rng)} ${pick(LAST_NAMES, rng)}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  // fallback determinístico se esgotar combinações
  let i = 1;
  let name = `${pick(firstNames, rng)} ${pick(LAST_NAMES, rng)} ${i}`;
  while (used.has(name)) {
    i += 1;
    name = `${pick(firstNames, rng)} ${pick(LAST_NAMES, rng)} ${i}`;
  }
  used.add(name);
  return name;
}
