/**
 * Ações puras que transformam o GameState (fonte única de verdade).
 *
 * São funções puras (state + args -> novo state), sem I/O nem dependência de UI.
 * A store Zustand (gameStore) apenas as invoca e guarda o resultado.
 */

import { Rng } from "@engine/rng";
import { matchConfig } from "@domain/matchAdapter";
import { generateLeague, DEFAULT_GENERATE } from "@domain/generator";
import {
  generateFixtures,
  playerFixtureIndex,
  simulateRound,
  totalRounds,
} from "@domain/league";
import { computeStandings } from "@domain/standings";
import { setLineup } from "@domain/lineup";
import { positionOf } from "@domain/selectors";
import {
  buildFinal,
  buildQuarters,
  buildSemis,
  playOneGame,
  seedTop8,
  tieWinnerSeeded,
} from "@domain/playoffs";
import {
  evaluateObjective,
  FIRST_SEASON_YEAR,
  generateOffers,
  objectiveForTeam,
  seasonLabel,
} from "@domain/career";
import {
  bumpFundamental,
  canInvest,
  declineVeteran,
  growFromMinutes,
  pdCost,
  pdFromMatch,
  pdObjectiveBonus,
  tickTraining,
  TRAINING_ROUNDS,
} from "@domain/development";
import { teamStarsFromTeam } from "@domain/strength";
import { lineupIds } from "@domain/lineup";
import type {
  Category,
  Development,
  Fundamental,
  GameState,
  Lineup,
  MatchResult,
  Player,
  PlayoffBracket,
  Team,
} from "@domain/types";
import { SCHEMA_VERSION } from "@domain/types";

/**
 * Aplica os canais de desenvolvimento ao time do jogador após uma rodada:
 * - minutos em quadra (quem está na escalação evolui mais);
 * - avança o treino ativo (e aplica ganho ao concluir);
 * - concede PD por marcos da partida do jogador.
 * Retorna { teams, development } atualizados.
 */
function applyRoundDevelopment(
  state: GameState,
  playerResult: MatchResult | null,
): { teams: Team[]; development: Development } {
  const playerTeam = state.teams.find((t) => t.id === state.playerTeamId);
  if (!playerTeam) return { teams: state.teams, development: state.development };

  const courtSet = new Set(lineupIds(playerTeam.roster.lineup));

  // 1) crescimento por minutos + marca setsPlayed
  let players: Player[] = playerTeam.roster.players.map((p) => {
    const played = courtSet.has(p.id);
    const grown = growFromMinutes(p, played);
    return played ? { ...grown, setsPlayed: grown.setsPlayed + 1 } : grown;
  });

  // 2) treino ativo
  let training = state.development.training;
  if (training) {
    const ticked = tickTraining(players, training);
    players = ticked.players;
    training = ticked.finished
      ? null
      : { ...training, roundsDone: training.roundsDone + 1 };
  }

  // 3) PD por marcos
  let points = state.development.points;
  if (playerResult) {
    const playerWon = playerResult.winnerId === state.playerTeamId;
    const isHome = playerResult.homeId === state.playerTeamId;
    const setsFor = isHome ? playerResult.setsHome : playerResult.setsAway;
    const setsAgainst = isHome ? playerResult.setsAway : playerResult.setsHome;
    const opponentId = isHome ? playerResult.awayId : playerResult.homeId;
    const opponent = state.teams.find((t) => t.id === opponentId);
    const underdog = opponent
      ? teamStarsFromTeam(playerTeam) < teamStarsFromTeam(opponent)
      : false;
    points += pdFromMatch({
      playerWon,
      wasSweep: playerWon && setsAgainst === 0 && setsFor === 3,
      wentToTiebreak: playerResult.wentToTiebreak,
      playerWasUnderdog: underdog,
    });
  }

  const teams = state.teams.map((t) =>
    t.id === state.playerTeamId
      ? { ...t, roster: { ...t.roster, players } }
      : t,
  );
  return { teams, development: { points, training } };
}

export interface NewGameOptions {
  seed: number;
  category: Category;
  managerName: string;
  managerAvatar: string;
  /** índice (0-based) do time que o jogador controla. */
  playerTeamIndex: number;
}

/** Cria um novo jogo: gera mundo, calendário e tabela inicial. */
export function newGame(opts: NewGameOptions): GameState {
  const teams = generateLeague({
    ...DEFAULT_GENERATE,
    seed: opts.seed,
    category: opts.category,
    playerTeamIndex: opts.playerTeamIndex,
  });
  const fixtures = generateFixtures(teams.map((t) => t.id));
  const standings = computeStandings(teams, fixtures);
  const playerTeam = teams.find((t) => t.isPlayerControlled);
  if (!playerTeam) throw new Error("newGame: nenhum time controlado pelo jogador");

  return {
    schemaVersion: SCHEMA_VERSION,
    seed: opts.seed,
    category: opts.category,
    managerName: opts.managerName,
    managerAvatar: opts.managerAvatar,
    playerTeamId: playerTeam.id,
    teams,
    fixtures,
    standings,
    currentRound: 1,
    phase: "league",
    playoffs: null,
    season: FIRST_SEASON_YEAR,
    objective: objectiveForTeam(playerTeam, teams.length),
    history: [],
    offers: null,
    development: { points: 0, training: null },
  };
}

/** Define a escalação estruturada do time do jogador. */
export function updatePlayerLineup(state: GameState, lineup: Lineup): GameState {
  const teams = state.teams.map((t) =>
    t.id === state.playerTeamId ? { ...t, roster: setLineup(t.roster, lineup) } : t,
  );
  return { ...state, teams };
}

function teamsById(teams: Team[]): Map<string, Team> {
  return new Map(teams.map((t) => [t.id, t]));
}

/**
 * Avança uma rodada da liga (simula todos os jogos da rodada corrente).
 * Ao terminar a última rodada, transiciona para o mata-mata.
 */
export function advanceLeagueRound(state: GameState): GameState {
  if (state.phase !== "league") return state;

  const cfg = matchConfig(state.category);
  const rng = new Rng(state.seed).spawn(9000 + state.currentRound);
  const fixtures = state.fixtures.map((f) => ({ ...f }));
  const byId = teamsById(state.teams);

  const results = simulateRound(state.currentRound, fixtures, byId, cfg, rng);
  for (const [idx, res] of results) {
    fixtures[idx]!.result = res;
  }

  // resultado do time do jogador nesta rodada (para PD)
  const pIdx = playerFixtureIndex(state.currentRound, fixtures, state.playerTeamId);
  const playerResult = pIdx >= 0 ? fixtures[pIdx]!.result : null;
  const { teams, development } = applyRoundDevelopment(state, playerResult);

  const standings = computeStandings(teams, fixtures);
  const last = totalRounds(teams.length);
  const nextRound = state.currentRound + 1;

  if (state.currentRound >= last) {
    // fim da liga -> monta e prepara o mata-mata
    const order = standings.map((s) => s.teamId);
    const playoffs = initPlayoffs(order);
    return { ...state, teams, development, fixtures, standings, currentRound: last, phase: "playoffs", playoffs };
  }

  return { ...state, teams, development, fixtures, standings, currentRound: nextRound };
}

/**
 * Conclui a rodada da liga usando o resultado da partida AO VIVO do jogador,
 * e auto-simula os demais jogos da rodada. Depois avança rodada/fase.
 */
export function commitPlayerRound(state: GameState, playerResult: MatchResult): GameState {
  if (state.phase !== "league") return state;

  const cfg = matchConfig(state.category);
  const rng = new Rng(state.seed).spawn(9000 + state.currentRound);
  const fixtures = state.fixtures.map((f) => ({ ...f }));
  const byId = teamsById(state.teams);

  // aplica o resultado do jogo do jogador
  const pIdx = playerFixtureIndex(state.currentRound, fixtures, state.playerTeamId);
  if (pIdx >= 0) {
    fixtures[pIdx]!.result = playerResult;
  }
  // simula os demais jogos da rodada
  const results = simulateRound(
    state.currentRound,
    fixtures,
    byId,
    cfg,
    rng,
    state.playerTeamId,
  );
  for (const [idx, res] of results) {
    fixtures[idx]!.result = res;
  }

  const { teams, development } = applyRoundDevelopment(state, playerResult);

  const standings = computeStandings(teams, fixtures);
  const last = totalRounds(teams.length);

  if (state.currentRound >= last) {
    const order = standings.map((s) => s.teamId);
    const playoffs = initPlayoffs(order);
    return { ...state, teams, development, fixtures, standings, currentRound: last, phase: "playoffs", playoffs };
  }
  return { ...state, teams, development, fixtures, standings, currentRound: state.currentRound + 1 };
}

/** Monta o bracket inicial (quartas) sem resolver ainda. */
export function initPlayoffs(standingsOrder: string[]): PlayoffBracket {
  const seeds = seedTop8(standingsOrder);
  return {
    quarters: buildQuarters(seeds),
    semis: [],
    final: null,
    championId: null,
  };
}

/**
 * Avança o mata-mata JOGO A JOGO: resolve a próxima partida pendente do bracket
 * (quartas -> semis -> final). Uma chamada = um jogo.
 */
export function advancePlayoffStage(state: GameState): GameState {
  if (state.phase !== "playoffs" || !state.playoffs) return state;

  const cfg = matchConfig(state.category);
  const byId = teamsById(state.teams);
  const bracket = state.playoffs;

  // === QUARTAS: joga um jogo do primeiro tie pendente ===
  const qIdx = bracket.quarters.findIndex((t) => t.winnerId === null);
  if (qIdx >= 0) {
    const rng = new Rng(state.seed).spawn(20000 + qIdx * 10 + bracket.quarters[qIdx]!.games.length);
    const quarters = [...bracket.quarters];
    quarters[qIdx] = playOneGame(quarters[qIdx]!, byId, cfg, rng);
    // se com isso as quartas terminaram, monta as semis
    const semis = quarters.every((t) => t.winnerId)
      ? buildSemis(quarters.map(tieWinnerSeeded))
      : bracket.semis;
    return { ...state, playoffs: { ...bracket, quarters, semis } };
  }

  // === SEMIS ===
  if (bracket.semis.length > 0) {
    const sIdx = bracket.semis.findIndex((t) => t.winnerId === null);
    if (sIdx >= 0) {
      const rng = new Rng(state.seed).spawn(30000 + sIdx * 10 + bracket.semis[sIdx]!.games.length);
      const semis = [...bracket.semis];
      semis[sIdx] = playOneGame(semis[sIdx]!, byId, cfg, rng);
      const final = semis.every((t) => t.winnerId)
        ? buildFinal(semis.map(tieWinnerSeeded))
        : bracket.final;
      return { ...state, playoffs: { ...bracket, semis, final } };
    }
  }

  // === FINAL (jogo único) ===
  if (bracket.final && bracket.final.winnerId === null) {
    const rng = new Rng(state.seed).spawn(40000);
    const final = playOneGame(bracket.final, byId, cfg, rng);
    if (final.winnerId) {
      return finishSeason(state, { ...bracket, final, championId: final.winnerId });
    }
    return { ...state, playoffs: { ...bracket, final } };
  }

  return state;
}

/** Conclui a temporada: registra histórico (com objetivo) e gera propostas. */
function finishSeason(state: GameState, bracket: PlayoffBracket): GameState {
  const byId = teamsById(state.teams);
  const championId = bracket.championId!;
  const champion = byId.get(championId);
  const leaguePos = positionOf(state, state.playerTeamId);
  const wasChampion = championId === state.playerTeamId;
  const objectiveMet = evaluateObjective(state.objective, leaguePos, wasChampion);
  const playerTeam = byId.get(state.playerTeamId)!;

  const record = {
    season: state.season,
    seasonLabel: seasonLabel(state.season),
    teamId: state.playerTeamId,
    teamName: playerTeam.name,
    championId,
    championName: champion?.name ?? "—",
    playerLeaguePosition: leaguePos,
    playerWasChampion: wasChampion,
    objective: state.objective,
    objectiveMet,
  };

  const offers = generateOffers(
    playerTeam,
    state.teams,
    leaguePos,
    objectiveMet,
    wasChampion,
    state.teams.length,
    state.seed,
  );

  // bônus de PD por cumprir objetivo / ser campeão (pote de fim de temporada)
  const bonus = pdObjectiveBonus(objectiveMet, wasChampion);
  const development: Development = {
    ...state.development,
    points: state.development.points + bonus,
  };

  return {
    ...state,
    phase: "finished",
    playoffs: bracket,
    history: [...state.history, record],
    offers,
    development,
  };
}

/**
 * Inicia a próxima temporada com o time escolhido nas propostas (renovar ou
 * trocar de clube). Atributos dos jogadores inalterados por ora. Zera liga,
 * tabela e mata-mata; avança o ano da temporada; define o novo objetivo.
 * O histórico de carreira é preservado (inclusive ao trocar de time).
 */
export function startNextSeason(state: GameState, chosenTeamId: string): GameState {
  const nextYear = state.season + 1;
  const nextSeasonSeed = state.seed + nextYear * 100003;

  // regenera o mundo para a nova temporada (mesmos times/escudos), definindo o
  // novo time controlado pelo jogador. Envelhece +1 ano, aplica declínio de
  // veteranos e zera os sets jogados na temporada.
  const declineRng = new Rng(nextSeasonSeed).spawn(777);
  const teams = state.teams.map((t) => {
    const players = t.roster.players.map((p) => {
      const aged: Player = { ...p, age: p.age + 1, setsPlayed: 0 };
      return declineVeteran(aged, declineRng);
    });
    return {
      ...t,
      isPlayerControlled: t.id === chosenTeamId,
      roster: { ...t.roster, players },
    };
  });

  const fixtures = generateFixtures(teams.map((t) => t.id));
  const standings = computeStandings(teams, fixtures);
  const playerTeam = teams.find((t) => t.id === chosenTeamId)!;

  return {
    ...state,
    seed: nextSeasonSeed,
    playerTeamId: chosenTeamId,
    teams,
    fixtures,
    standings,
    currentRound: 1,
    phase: "league",
    playoffs: null,
    season: nextYear,
    objective: objectiveForTeam(playerTeam, teams.length),
    offers: null,
  };
}

/** Avança o jogo de forma agnóstica de fase (usado pelo botão AVANÇAR). */
export function advance(state: GameState): GameState {
  if (state.phase === "league") return advanceLeagueRound(state);
  if (state.phase === "playoffs") return advancePlayoffStage(state);
  return state;
}

/**
 * Investe PD para subir +1 num fundamento de um jogador do elenco do jogador.
 * Respeita o custo (rendimentos decrescentes) e o teto de potencial.
 * Retorna o estado inalterado se não houver PD suficiente ou não for possível.
 */
export function investPD(
  state: GameState,
  playerId: string,
  fundamental: Fundamental,
): GameState {
  const team = state.teams.find((t) => t.id === state.playerTeamId);
  if (!team) return state;
  const player = team.roster.players.find((p) => p.id === playerId);
  if (!player) return state;
  if (!canInvest(player, fundamental)) return state;

  const cost = pdCost(player.attributes[fundamental]);
  if (state.development.points < cost) return state;

  const players = team.roster.players.map((p) =>
    p.id === playerId ? bumpFundamental(p, fundamental, 1) : p,
  );
  const teams = state.teams.map((t) =>
    t.id === team.id ? { ...t, roster: { ...t.roster, players } } : t,
  );
  return {
    ...state,
    teams,
    development: { ...state.development, points: state.development.points - cost },
  };
}

/**
 * Inicia um foco de treino (1 por vez) num jogador/fundamento. Leva várias
 * rodadas para concluir. Substitui um treino anterior se houver.
 */
export function startTraining(
  state: GameState,
  playerId: string,
  fundamental: Fundamental,
): GameState {
  const team = state.teams.find((t) => t.id === state.playerTeamId);
  if (!team) return state;
  const player = team.roster.players.find((p) => p.id === playerId);
  if (!player) return state;

  return {
    ...state,
    development: {
      ...state.development,
      training: { playerId, fundamental, roundsDone: 0, totalRounds: TRAINING_ROUNDS },
    },
  };
}

/** Cancela o treino ativo. */
export function cancelTraining(state: GameState): GameState {
  return { ...state, development: { ...state.development, training: null } };
}
