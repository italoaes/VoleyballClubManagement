/**
 * Contrato de tipos do domínio — modelos compartilhados (sem lógica).
 *
 * Tudo que precisa ser SERIALIZADO no save vive dentro de `GameState`.
 * O motor (engine/) NÃO conhece a entidade Player — recebe apenas forças.
 * A entidade Player e a gestão de reservas são responsabilidade do domínio.
 */

// ---------------------------------------------------------------------------
// Jogadores e posições
// ---------------------------------------------------------------------------

/** Posições fixas do vôlei. */
export enum Position {
  Setter = "Levantador",
  Outside = "Ponteiro",
  Middle = "Central",
  Opposite = "Oposto",
  Libero = "Líbero",
}

/** Atributos de um jogador (escala 1-99). */
export interface Attributes {
  attack: number;
  block: number;
  serve: number;
  receive: number;
  setting: number;
  libero: number;
}

/** Um jogador do elenco. */
export interface Player {
  id: string;
  name: string;
  position: Position;
  age: number;
  attributes: Attributes;
  /**
   * Overall potencial (teto de evolução, escala 1-99). Sempre >= overall atual.
   * Maior nos jovens; próximo do atual nos veteranos. Limita todo crescimento.
   */
  potential: number;
  /**
   * Progresso de crescimento acumulado (0-1) do canal de minutos em quadra.
   * Ao atingir 1.0, converte-se em +1 num fundamento e reinicia. Serializado.
   */
  growthProgress: number;
  /** número da camisa (exibição). */
  number: number;
  /** minutos/sets jogados na temporada (métrica de participação p/ evolução). */
  setsPlayed: number;
  /**
   * true apenas para o MVP do campeonato REINANTE (o mais recente). No máximo 1
   * jogador com isStar=true no mundo (ver GameState.reigningMvpId). Dá +2 ao time
   * em quadra e uma estrela no plantel.
   */
  isStar: boolean;
  /** nº de vezes que foi o melhor da partida NESTA temporada (zera a cada temporada). */
  seasonMvpCount: number;
  /** nº de vezes que foi o melhor da partida na CARREIRA inteira (nunca zera). */
  careerMvpCount: number;
}

/**
 * Escalação estruturada por posição (7 jogadores):
 * 1 levantador, 2 ponteiros, 2 centrais, 1 oposto, 1 líbero.
 * O líbero entra no fundo no lugar de um central (melhora recepção/defesa),
 * respeitando a regra real do vôlei — tratado na camada de escalação, não no motor.
 */
export interface Lineup {
  setter: string;
  outsides: [string, string];
  middles: [string, string];
  opposite: string;
  libero: string;
}

/**
 * Elenco de um time: titulares + reservas.
 * `lineup` é a escalação estruturada (o que a camada de domínio converte em forças).
 * O motor é cego às reservas e à estrutura; recebe apenas médias agregadas.
 */
export interface Roster {
  players: Player[];
  lineup: Lineup;
}

// ---------------------------------------------------------------------------
// Times e categoria
// ---------------------------------------------------------------------------

export type Category = "male" | "female";

export interface Team {
  id: string;
  name: string;
  shortName: string;
  city: string;
  /** caminho público do escudo do time. */
  crest: string;
  roster: Roster;
  /** true se controlado pelo jogador humano. */
  isPlayerControlled: boolean;
}

// ---------------------------------------------------------------------------
// Resultados de partida (produzidos pelo motor + domínio)
// ---------------------------------------------------------------------------

export interface SetResult {
  pointsHome: number;
  pointsAway: number;
  /** id do time vencedor do set. */
  winnerId: string;
}

export interface MatchResult {
  homeId: string;
  awayId: string;
  sets: SetResult[];
  setsHome: number;
  setsAway: number;
  winnerId: string;
  loserId: string;
  /** true se a partida foi ao 5º set (tie-break). */
  wentToTiebreak: boolean;
  totalPointsHome: number;
  totalPointsAway: number;
  /** id do jogador eleito MVP da partida (heurística); null em jogos antigos. */
  mvpId: string | null;
}

// ---------------------------------------------------------------------------
// Liga: calendário e classificação
// ---------------------------------------------------------------------------

export interface Fixture {
  round: number;
  homeId: string;
  awayId: string;
  /** preenchido após simular. */
  result: MatchResult | null;
}

export interface Standing {
  teamId: string;
  points: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  rallyPointsFor: number;
  rallyPointsAgainst: number;
}

// ---------------------------------------------------------------------------
// Mata-mata (playoffs)
// ---------------------------------------------------------------------------

export type PlayoffRound = "quarter" | "semi" | "final";

/** Semente de um time no mata-mata = posição final na liga (1 = melhor). */
export interface Seeded {
  teamId: string;
  seed: number;
}

/**
 * Um confronto do mata-mata. Séries (quartas/semis) são melhor de 3 jogos;
 * a final é jogo único (`bestOf: 1`).
 */
export interface PlayoffTie {
  id: string;
  round: PlayoffRound;
  high: Seeded; // melhor colocado (menor seed)
  low: Seeded; // pior colocado (maior seed)
  bestOf: 1 | 3;
  games: MatchResult[];
  winsHigh: number;
  winsLow: number;
  winnerId: string | null;
}

export interface PlayoffBracket {
  quarters: PlayoffTie[];
  semis: PlayoffTie[];
  final: PlayoffTie | null;
  championId: string | null;
}

// ---------------------------------------------------------------------------
// Fase do jogo e estado global serializável
// ---------------------------------------------------------------------------

export type Phase = "league" | "playoffs" | "finished";

/** Tipos de objetivo de temporada (definido pela diretoria conforme a realidade do time). */
export type ObjectiveType = "title" | "playoffs" | "midtable" | "avoid_bottom";

export interface SeasonObjective {
  type: ObjectiveType;
  description: string;
  /** posição na liga exigida (<=) quando aplicável; usado como referência. */
  targetPosition: number;
}

/** Registro histórico de uma temporada encerrada (carreira do treinador). */
export interface SeasonRecord {
  season: number; // ano de início (ex.: 26 para 26/27)
  seasonLabel: string; // ex.: "26/27"
  teamId: string; // time que o treinador dirigia
  teamName: string;
  championId: string;
  championName: string;
  playerLeaguePosition: number;
  playerWasChampion: boolean;
  objective: SeasonObjective;
  objectiveMet: boolean;
}

/** Proposta de trabalho de um time ao treinador (fim de temporada). */
export interface JobOffer {
  teamId: string;
  teamName: string;
  crest: string;
  /** true = renovação com o time atual (sempre presente). */
  isRenewal: boolean;
  /** objetivo que o time exige para a próxima temporada. */
  objective: SeasonObjective;
  /** nível do time em estrelas (para o jogador avaliar). */
  stars: number;
}

/** Fundamento treinável (chave de Attributes). */
export type Fundamental = keyof Attributes;

/**
 * Foco de treino ativo (canal lento). Leva `totalRounds` rodadas para concluir;
 * ao final, aplica um ganho no fundamento do jogador (limitado pelo potencial).
 */
export interface TrainingFocus {
  playerId: string;
  fundamental: Fundamental;
  roundsDone: number;
  totalRounds: number;
}

/** Estado de desenvolvimento do elenco do jogador (carreira). */
export interface Development {
  /** Pontos de Desenvolvimento acumulados (gastos manualmente pelo jogador). */
  points: number;
  /** foco de treino ativo (1 por vez) ou null. */
  training: TrainingFocus | null;
}

/** Contexto de um jogo de playoff do jogador aguardando ser disputado ao vivo. */
export interface PendingPlayoffGame {
  tieId: string;
  gameIndex: number;
  playerIsHome: boolean;
}

/** Schema do save; incrementado a cada mudança estrutural (migração). */
export const SCHEMA_VERSION = 8;

/**
 * Estado do jogo — FONTE ÚNICA DE VERDADE, 100% serializável.
 * Não contém funções, refs de UI, nem instâncias de classe.
 */
export interface GameState {
  schemaVersion: number;
  seed: number;
  category: Category;
  managerName: string;
  /** caminho público do avatar escolhido pelo gestor. */
  managerAvatar: string;
  playerTeamId: string;

  teams: Team[];
  fixtures: Fixture[];
  standings: Standing[];

  currentRound: number; // rodada corrente da liga (1-based)
  phase: Phase;

  playoffs: PlayoffBracket | null;

  /** ano de início da temporada corrente (ex.: 26 => "26/27"). */
  season: number;
  /** objetivo da temporada corrente (definido pela diretoria). */
  objective: SeasonObjective;
  /** histórico de temporadas encerradas (carreira do treinador, entre times). */
  history: SeasonRecord[];
  /** propostas pendentes ao fim da temporada (null durante a temporada). */
  offers: JobOffer[] | null;
  /** desenvolvimento do elenco do jogador (PD + treino ativo). */
  development: Development;

  // --- MVP (ponto 6) ---
  /** id do jogador-estrela reinante (MVP do campeonato mais recente) ou null. */
  reigningMvpId: string | null;
  /** contagem de MVPs de partida na temporada corrente (playerId -> nº). */
  seasonMvpTally: Record<string, number>;

  // --- Playoff ao vivo (ponto 5) ---
  /** jogo de playoff do jogador aguardando disputa ao vivo, ou null. */
  pendingPlayoffGame: PendingPlayoffGame | null;
}
