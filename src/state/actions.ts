/**
 * Ações puras que transformam o GameState (fonte única de verdade).
 *
 * São funções puras (state + args -> novo state), sem I/O nem dependência de UI.
 * A store Zustand (gameStore) apenas as invoca e guarda o resultado.
 */

import { Rng } from "@engine/rng";
import { matchConfig } from "@domain/matchAdapter";
import { generateLeague, DEFAULT_GENERATE, regenerateAsYouth } from "@domain/generator";
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
  applyPlayoffGameResult,
  buildFinal,
  buildQuarters,
  buildSemis,
  homeIsHighSeed,
  playOneGame,
  seedTop8,
  tieHasTeam,
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
  boostChampionMvp,
  bumpFundamental,
  canInvest,
  declineVeteran,
  growFromMinutes,
  growPotential,
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
  PlayoffTie,
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
    const beatSuperiorTeam =
      playerWon && !!opponent && teamStarsFromTeam(playerTeam) < teamStarsFromTeam(opponent);
    // virada: perdeu algum dos 2 primeiros sets e ainda venceu a partida
    const lostEarlySet = playerResult.sets
      .slice(0, 2)
      .some((s) => s.winnerId !== state.playerTeamId);
    const wasComeback = playerWon && lostEarlySet;
    points += pdFromMatch({
      playerWon,
      setsFor,
      setsAgainst,
      beatSuperiorTeam,
      wasComeback,
      wonAway: playerWon && !isHome,
    });
  }

  const teams = state.teams.map((t) =>
    t.id === state.playerTeamId
      ? { ...t, roster: { ...t.roster, players } }
      : t,
  );
  return { teams, development: { points, training } };
}

/** Acumula os MVPs de uma lista de resultados no tally (playerId -> nº). */
function tallyMvps(
  base: Record<string, number>,
  results: (MatchResult | null | undefined)[],
): Record<string, number> {
  const tally = { ...base };
  for (const r of results) {
    if (r && r.mvpId) {
      tally[r.mvpId] = (tally[r.mvpId] ?? 0) + 1;
    }
  }
  return tally;
}

/** Incrementa o contador de carreira `matchMvpCount` dos jogadores eleitos MVP. */
function incrementMvpCounts(
  teams: Team[],
  results: (MatchResult | null | undefined)[],
): Team[] {
  const counts = new Map<string, number>();
  for (const r of results) {
    if (r && r.mvpId) counts.set(r.mvpId, (counts.get(r.mvpId) ?? 0) + 1);
  }
  if (counts.size === 0) return teams;
  return teams.map((t) => ({
    ...t,
    roster: {
      ...t.roster,
      players: t.roster.players.map((p) => {
        const inc = counts.get(p.id);
        return inc
          ? {
              ...p,
              seasonMvpCount: (p.seasonMvpCount ?? 0) + inc,
              careerMvpCount: (p.careerMvpCount ?? 0) + inc,
            }
          : p;
      }),
    },
  }));
}

/**
 * Define o jogador-estrela reinante (invariante: no máximo 1 isStar no mundo, e
 * reigningMvpId bate com ele ou null). TODAS as transições de estrela passam aqui.
 */
export function setReigningMvp(state: GameState, playerId: string | null): GameState {
  const teams = state.teams.map((t) => ({
    ...t,
    roster: {
      ...t.roster,
      players: t.roster.players.map((p) => {
        const shouldStar = playerId !== null && p.id === playerId;
        return p.isStar === shouldStar ? p : { ...p, isStar: shouldStar };
      }),
    },
  }));
  return { ...state, teams, reigningMvpId: playerId };
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
    reigningMvpId: null,
    seasonMvpTally: {},
    pendingPlayoffGame: null,
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
  const dev = applyRoundDevelopment(state, playerResult);
  const development = dev.development;

  // acumula MVPs de TODOS os jogos da rodada (tally + contador de carreira)
  const roundResults = fixtures
    .filter((f) => f.round === state.currentRound)
    .map((f) => f.result);
  const seasonMvpTally = tallyMvps(state.seasonMvpTally, roundResults);
  const teams = incrementMvpCounts(dev.teams, roundResults);

  const standings = computeStandings(teams, fixtures);
  const last = totalRounds(teams.length);
  const nextRound = state.currentRound + 1;

  if (state.currentRound >= last) {
    // fim da liga -> monta e prepara o mata-mata
    const order = standings.map((s) => s.teamId);
    const playoffs = initPlayoffs(order);
    return { ...state, teams, development, seasonMvpTally, fixtures, standings, currentRound: last, phase: "playoffs", playoffs };
  }

  return { ...state, teams, development, seasonMvpTally, fixtures, standings, currentRound: nextRound };
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

  const dev = applyRoundDevelopment(state, playerResult);
  const development = dev.development;

  const roundResults = fixtures
    .filter((f) => f.round === state.currentRound)
    .map((f) => f.result);
  const seasonMvpTally = tallyMvps(state.seasonMvpTally, roundResults);
  const teams = incrementMvpCounts(dev.teams, roundResults);

  const standings = computeStandings(teams, fixtures);
  const last = totalRounds(teams.length);

  if (state.currentRound >= last) {
    const order = standings.map((s) => s.teamId);
    const playoffs = initPlayoffs(order);
    return { ...state, teams, development, seasonMvpTally, fixtures, standings, currentRound: last, phase: "playoffs", playoffs };
  }
  return { ...state, teams, development, seasonMvpTally, fixtures, standings, currentRound: state.currentRound + 1 };
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
 * Avança o mata-mata por RODADA de jogos: a cada chamada, joga UM jogo em CADA
 * confronto ainda não decidido da fase corrente ao mesmo tempo (jogos 1 de todos,
 * depois jogos 2 de todos, depois os jogos 3 de desempate). Só passa de fase
 * (quartas -> semis -> final) quando todos os confrontos da fase terminam.
 */
export function advancePlayoffStage(state: GameState): GameState {
  if (state.phase !== "playoffs" || !state.playoffs) return state;
  // se há um jogo do jogador aguardando, não avança (a UI precisa resolvê-lo antes)
  if (state.pendingPlayoffGame) return state;

  const cfg = matchConfig(state.category);
  const byId = teamsById(state.teams);
  const bracket = state.playoffs;
  const newResults: MatchResult[] = [];
  const playerId = state.playerTeamId;

  // Detecta um tie pendente do jogador na fase. Se houver, pausa (pendingPlayoffGame).
  const pauseIfPlayerTie = (ties: PlayoffTie[]): GameState | null => {
    const tie = ties.find((t) => t.winnerId === null && tieHasTeam(t, playerId));
    if (!tie) return null;
    const gameIndex = tie.games.length;
    const highHosts = homeIsHighSeed(tie.bestOf, gameIndex);
    const playerIsHigh = tie.high.teamId === playerId;
    const playerIsHome = playerIsHigh ? highHosts : !highHosts;
    return {
      ...state,
      pendingPlayoffGame: { tieId: tie.id, gameIndex, playerIsHome },
    };
  };

  // Joga um jogo em cada tie pendente do conjunto, PULANDO o tie do jogador.
  const playRoundOfTies = (ties: PlayoffTie[], salt: number): PlayoffTie[] =>
    ties.map((tie, i) => {
      if (tie.winnerId || tieHasTeam(tie, playerId)) return tie; // decidido ou é do jogador
      const rng = new Rng(state.seed).spawn(salt + i * 100 + tie.games.length);
      const played = playOneGame(tie, byId, cfg, rng);
      const last = played.games[played.games.length - 1];
      if (last && played.games.length > tie.games.length) newResults.push(last);
      return played;
    });

  const withTally = (next: GameState): GameState => ({
    ...next,
    seasonMvpTally: tallyMvps(next.seasonMvpTally, newResults),
    teams: incrementMvpCounts(next.teams, newResults),
  });

  // === QUARTAS ===
  if (bracket.quarters.some((t) => t.winnerId === null)) {
    const paused = pauseIfPlayerTie(bracket.quarters);
    if (paused) return paused;
    const quarters = playRoundOfTies(bracket.quarters, 20000);
    const semis = quarters.every((t) => t.winnerId)
      ? buildSemis(quarters.map(tieWinnerSeeded))
      : bracket.semis;
    return withTally({ ...state, playoffs: { ...bracket, quarters, semis } });
  }

  // === SEMIS ===
  if (bracket.semis.length > 0 && bracket.semis.some((t) => t.winnerId === null)) {
    const paused = pauseIfPlayerTie(bracket.semis);
    if (paused) return paused;
    const semis = playRoundOfTies(bracket.semis, 30000);
    const final = semis.every((t) => t.winnerId)
      ? buildFinal(semis.map(tieWinnerSeeded))
      : bracket.final;
    return withTally({ ...state, playoffs: { ...bracket, semis, final } });
  }

  // === FINAL (jogo único) ===
  if (bracket.final && bracket.final.winnerId === null) {
    const paused = pauseIfPlayerTie([bracket.final]);
    if (paused) return paused;
    const rng = new Rng(state.seed).spawn(40000);
    const final = playOneGame(bracket.final, byId, cfg, rng);
    const last = final.games[final.games.length - 1];
    if (last) newResults.push(last);
    const tallied = withTally(state);
    if (final.winnerId) {
      return finishSeason(tallied, { ...bracket, final, championId: final.winnerId });
    }
    return withTally({ ...state, playoffs: { ...bracket, final } });
  }

  return state;
}

/**
 * Aplica o resultado (ao vivo ou simulado) do jogo de playoff do jogador ao tie
 * pendente, atualiza o bracket, contabiliza o MVP, limpa `pendingPlayoffGame` e
 * então continua o avanço dos demais jogos da rodada (auto-simulados).
 */
export function commitPlayoffGame(state: GameState, result: MatchResult): GameState {
  if (state.phase !== "playoffs" || !state.playoffs || !state.pendingPlayoffGame) return state;
  const bracket = state.playoffs;
  const { tieId } = state.pendingPlayoffGame;

  const applyToList = (ties: PlayoffTie[]): PlayoffTie[] =>
    ties.map((t) => (t.id === tieId ? applyPlayoffGameResult(t, result) : t));

  let next = state;
  const seasonMvpTally = tallyMvps(state.seasonMvpTally, [result]);
  const teams = incrementMvpCounts(state.teams, [result]);

  // localiza a fase do tie e reconstrói o bracket se a fase encerrar
  if (bracket.quarters.some((t) => t.id === tieId)) {
    const quarters = applyToList(bracket.quarters);
    const semis = quarters.every((t) => t.winnerId)
      ? buildSemis(quarters.map(tieWinnerSeeded))
      : bracket.semis;
    next = { ...state, teams, playoffs: { ...bracket, quarters, semis }, seasonMvpTally, pendingPlayoffGame: null };
  } else if (bracket.semis.some((t) => t.id === tieId)) {
    const semis = applyToList(bracket.semis);
    const final = semis.every((t) => t.winnerId)
      ? buildFinal(semis.map(tieWinnerSeeded))
      : bracket.final;
    next = { ...state, teams, playoffs: { ...bracket, semis, final }, seasonMvpTally, pendingPlayoffGame: null };
  } else if (bracket.final && bracket.final.id === tieId) {
    const final = applyPlayoffGameResult(bracket.final, result);
    const tallied: GameState = { ...state, teams, seasonMvpTally, pendingPlayoffGame: null };
    if (final.winnerId) {
      return finishSeason(tallied, { ...bracket, final, championId: final.winnerId });
    }
    next = { ...tallied, playoffs: { ...bracket, final } };
  } else {
    // tie não encontrado: apenas limpa o pendente
    return { ...state, pendingPlayoffGame: null };
  }

  // continua o avanço para resolver os demais jogos da rodada (sem o jogador)
  return advancePlayoffStage(next);
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

  // === MVP do campeonato: elege o mais frequente no tally, aplica boost e estrela ===
  let stateWithMvp: GameState = {
    ...state,
    phase: "finished",
    playoffs: bracket,
    history: [...state.history, record],
    offers,
    development,
  };
  const mvpId = electChampionMvp(state.seasonMvpTally);
  if (mvpId) {
    // aplica o boost permanente ao jogador, onde quer que ele esteja
    const teams = stateWithMvp.teams.map((t) => ({
      ...t,
      roster: {
        ...t.roster,
        players: t.roster.players.map((p) => (p.id === mvpId ? boostChampionMvp(p) : p)),
      },
    }));
    stateWithMvp = setReigningMvp({ ...stateWithMvp, teams }, mvpId);
  }

  return stateWithMvp;
}

/** Elege o MVP do campeonato = maior contagem no tally (desempate estável por id). */
function electChampionMvp(tally: Record<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of Object.entries(tally)) {
    if (count > bestCount || (count === bestCount && best !== null && id < best)) {
      best = id;
      bestCount = count;
    }
  }
  return best;
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
  const growRng = new Rng(nextSeasonSeed).spawn(778);
  const teams = state.teams.map((t) => {
    const players = t.roster.players.map((p) => {
      const aged: Player = { ...p, age: p.age + 1, setsPlayed: 0, seasonMvpCount: 0 };
      // jovens ganham margem de potencial; veteranos declinam
      const grown = growPotential(aged, growRng);
      return declineVeteran(grown, declineRng);
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
    seasonMvpTally: {},
    pendingPlayoffGame: null,
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

/** Idade mínima para poder aposentar/reciclar um veterano. */
export const RETIRE_MIN_AGE = 34;

/**
 * "Aposentar" um veterano do elenco do jogador: reescreve-o como um jovem da base
 * (ponto 2), preservando id/posição/número (não quebra a escalação). Só permitido
 * para jogadores com idade >= RETIRE_MIN_AGE do time do jogador.
 */
export function recyclePlayer(state: GameState, playerId: string): GameState {
  const team = state.teams.find((t) => t.id === state.playerTeamId);
  if (!team) return state;
  const player = team.roster.players.find((p) => p.id === playerId);
  if (!player || player.age < RETIRE_MIN_AGE) return state;

  // nomes já em uso (todos os times) para evitar duplicatas
  const usedNames = new Set<string>();
  for (const t of state.teams) {
    for (const p of t.roster.players) usedNames.add(p.name);
  }

  const rng = new Rng(state.seed).spawn(60000 + hashId(playerId));
  const renewed = regenerateAsYouth(player, rng, usedNames, state.category);

  const players = team.roster.players.map((p) => (p.id === playerId ? renewed : p));
  const teams = state.teams.map((t) =>
    t.id === team.id ? { ...t, roster: { ...t.roster, players } } : t,
  );

  // se o jogador estava em treino, cancela (o treino perdeu sentido)
  const training =
    state.development.training?.playerId === playerId ? null : state.development.training;

  let next: GameState = {
    ...state,
    teams,
    development: { ...state.development, training },
  };

  // se era o astro reinante, perde a estrela (mantém invariante)
  if (state.reigningMvpId === playerId) {
    next = setReigningMvp(next, null);
  }

  return next;
}

/** Hash estável de um id de jogador para derivar um sub-stream de RNG. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 100000;
}
