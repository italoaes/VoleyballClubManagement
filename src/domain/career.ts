/**
 * Camada de carreira do treinador: nomes de temporada, objetivos e propostas.
 */

import { Rng } from "@engine/rng";
import type {
  JobOffer,
  ObjectiveType,
  SeasonObjective,
  Team,
} from "./types";
import { teamStarsFromTeam } from "./strength";

/** Ano de início da primeira temporada (26 => "26/27"). */
export const FIRST_SEASON_YEAR = 26;

/** Rótulo "AA/BB" a partir do ano de início (ex.: 26 => "26/27"). */
export function seasonLabel(startYear: number): string {
  const a = ((startYear % 100) + 100) % 100;
  const b = (a + 1) % 100;
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return `${pad(a)}/${pad(b)}`;
}

/**
 * Define o objetivo da temporada conforme a força relativa do time (estrelas)
 * e o número de times. Times fortes cobram título; fracos, evitar o rebaixamento.
 */
export function objectiveForTeam(team: Team, numTeams: number): SeasonObjective {
  const stars = teamStarsFromTeam(team);
  const playoffCut = Math.min(8, numTeams);
  const mid = Math.ceil(numTeams / 2);

  let type: ObjectiveType;
  let targetPosition: number;
  let description: string;

  if (stars >= 5) {
    type = "title";
    targetPosition = 1;
    description = "Conquistar o título dos Playoffs";
  } else if (stars === 4) {
    type = "playoffs";
    targetPosition = playoffCut;
    description = `Classificar para os Playoffs (top ${playoffCut})`;
  } else if (stars === 3) {
    type = "midtable";
    targetPosition = mid;
    description = `Terminar no meio da tabela (até ${mid}º)`;
  } else {
    type = "avoid_bottom";
    targetPosition = numTeams - 2;
    description = "Evitar as duas últimas posições";
  }
  return { type, description, targetPosition };
}

/**
 * Avalia se o objetivo foi cumprido, dada a posição final na liga e se foi campeão.
 */
export function evaluateObjective(
  objective: SeasonObjective,
  leaguePosition: number,
  wasChampion: boolean,
): boolean {
  switch (objective.type) {
    case "title":
      return wasChampion;
    case "playoffs":
    case "midtable":
    case "avoid_bottom":
      return leaguePosition <= objective.targetPosition;
    default:
      return false;
  }
}

/**
 * Gera as propostas de fim de temporada. A renovação com o time atual é sempre
 * oferecida (obrigatória para continuar). Times melhores aparecem conforme o
 * DESEMPENHO do treinador (cumprir objetivo e boa colocação atraem clubes).
 */
export function generateOffers(
  currentTeam: Team,
  allTeams: Team[],
  leaguePosition: number,
  objectiveMet: boolean,
  wasChampion: boolean,
  numTeams: number,
  seed: number,
): JobOffer[] {
  const rng = new Rng(seed).spawn(555);
  const offers: JobOffer[] = [];

  // renovação (sempre presente)
  offers.push({
    teamId: currentTeam.id,
    teamName: currentTeam.name,
    crest: currentTeam.crest,
    isRenewal: true,
    objective: objectiveForTeam(currentTeam, numTeams),
    stars: teamStarsFromTeam(currentTeam),
  });

  // "pontuação de reputação" do treinador nesta temporada (0..~5)
  const currentStars = teamStarsFromTeam(currentTeam);
  let reputation = 0;
  if (wasChampion) reputation += 3;
  if (objectiveMet) reputation += 2;
  if (leaguePosition <= 4) reputation += 2;
  else if (leaguePosition <= 8) reputation += 1;
  // superar as expectativas de um time fraco vale mais
  reputation += Math.max(0, 4 - currentStars);

  // times candidatos: mais fortes que o atual, ordenados por força desc
  const ranked = [...allTeams]
    .filter((t) => t.id !== currentTeam.id)
    .map((t) => ({ team: t, stars: teamStarsFromTeam(t) }))
    .filter((x) => x.stars >= currentStars) // só propostas iguais/melhores
    .sort((a, b) => b.stars - a.stars);

  // nº de propostas externas conforme a reputação (0 a 3)
  const numOffers = Math.max(0, Math.min(3, Math.floor(reputation / 2)));

  const pool = [...ranked];
  for (let i = 0; i < numOffers && pool.length > 0; i++) {
    // escolhe entre os melhores disponíveis, com leve aleatoriedade
    const idx = rng.integers(0, Math.min(3, pool.length));
    const picked = pool.splice(idx, 1)[0]!;
    offers.push({
      teamId: picked.team.id,
      teamName: picked.team.name,
      crest: picked.team.crest,
      isRenewal: false,
      objective: objectiveForTeam(picked.team, numTeams),
      stars: picked.stars,
    });
  }

  return offers;
}
