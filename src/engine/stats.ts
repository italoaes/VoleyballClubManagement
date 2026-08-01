/**
 * Utilitários estatísticos: comprimento de sequências (streaks) de pontos
 * (porte de stats.py). Não implementa momentum — apenas mede.
 */

/**
 * Dada a sequência de vencedores de cada ponto, retorna os comprimentos de
 * todas as sequências consecutivas do mesmo lado.
 */
export function streakLengths(pointWinners: readonly string[]): number[] {
  if (pointWinners.length === 0) {
    return [];
  }
  const lengths: number[] = [];
  let current = pointWinners[0];
  let count = 1;
  for (let i = 1; i < pointWinners.length; i++) {
    if (pointWinners[i] === current) {
      count += 1;
    } else {
      lengths.push(count);
      current = pointWinners[i];
      count = 1;
    }
  }
  lengths.push(count);
  return lengths;
}

export interface StreakBands {
  "1": number;
  "2": number;
  "3-4": number;
  "5+": number;
}

/** Agrega comprimentos de streak em faixas, como frações. */
export function streakDistribution(allLengths: readonly number[]): StreakBands {
  const bands: StreakBands = { "1": 0, "2": 0, "3-4": 0, "5+": 0 };
  if (allLengths.length === 0) {
    return bands;
  }
  const counts = { "1": 0, "2": 0, "3-4": 0, "5+": 0 };
  for (const len of allLengths) {
    if (len === 1) counts["1"] += 1;
    else if (len === 2) counts["2"] += 1;
    else if (len === 3 || len === 4) counts["3-4"] += 1;
    else counts["5+"] += 1;
  }
  const total = allLengths.length;
  return {
    "1": counts["1"] / total,
    "2": counts["2"] / total,
    "3-4": counts["3-4"] / total,
    "5+": counts["5+"] / total,
  };
}
