/**
 * MVP da partida (ponto 6) — heurística PURA e DETERMINÍSTICA.
 *
 * Não toca no motor (que é cego). Escolhe o melhor jogador olhando os 6 escalados
 * de cada time + o resultado. Aplica-se a TODAS as partidas (liga e playoff).
 *
 * Para NÃO ficar artificial (o craque saindo MVP toda vez), cada jogador recebe
 * uma "nota de desempenho DAQUELA partida" — um fator que varia de jogo para jogo.
 * Como o jogo precisa ser reprodutível (mesmo save = mesmo resultado), esse fator
 * é DETERMINÍSTICO: deriva de um hash do id do jogador + a assinatura do resultado
 * (placar por set, pontos totais). Assim varia por partida sem usar aleatório real,
 * e um jogador mediano pode ter uma "noite inspirada" e levar o prêmio.
 */

import { Position, type MatchResult, type Player, type Team } from "./types";
import { lineupIds } from "./lineup";

/** Base por posição a partir dos atributos (o talento AINDA importa, mas não domina). */
function positionBase(p: Player): number {
  const a = p.attributes;
  switch (p.position) {
    case Position.Outside:
      return a.attack * 0.6 + a.serve * 0.2 + a.receive * 0.2;
    case Position.Opposite:
      return a.attack * 0.7 + a.serve * 0.3;
    case Position.Middle:
      return a.block * 0.6 + a.attack * 0.4;
    case Position.Setter:
      return a.setting * 0.8 + a.serve * 0.2;
    case Position.Libero:
      return a.receive * 0.6 + a.libero * 0.4;
    default:
      return (a.attack + a.block + a.serve + a.receive + a.setting + a.libero) / 6;
  }
}

/** Escalados (6 em quadra) de um time. */
function courtPlayers(team: Team): Player[] {
  const ids = new Set(lineupIds(team.roster.lineup));
  return team.roster.players.filter((p) => ids.has(p.id));
}

/** Hash determinístico 32-bit de uma string (para variar por jogador+partida). */
function hash32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** "Assinatura" única de uma partida (placares por set + pontos totais). */
function matchSignature(result: MatchResult): string {
  const sets = result.sets.map((s) => `${s.pointsHome}-${s.pointsAway}`).join("|");
  return `${sets}#${result.totalPointsHome}:${result.totalPointsAway}`;
}

/**
 * Nota de desempenho do jogador NAQUELA partida (fator ~0.75 a ~1.25).
 * Determinístico por (id do jogador + assinatura da partida). Dá a "inspiração do dia".
 */
function performanceFactor(playerId: string, signature: string): number {
  const h = hash32(playerId + "@" + signature);
  const unit = h / 0xffffffff; // 0..1
  return 0.75 + unit * 0.5; // 0.75 .. 1.25
}

/**
 * Escolhe o MVP da partida. Score = base(atributos) × desempenho_da_partida × fator_vitória.
 * O talento influencia, mas o desempenho variável faz o MVP mudar de jogo para jogo —
 * inclusive um jogador do time perdedor ou um não-craque pode brilhar. Determinístico.
 */
export function pickMatchMvp(home: Team, away: Team, result: MatchResult): string {
  const homeWon = result.winnerId === home.id;
  const signature = matchSignature(result);

  const candidates: { id: string; score: number }[] = [];
  const add = (team: Team, won: boolean): void => {
    const winFactor = won ? 1.15 : 1.0; // o vencedor tende a ter o MVP, mas não é garantia
    for (const p of courtPlayers(team)) {
      const score = positionBase(p) * performanceFactor(p.id, signature) * winFactor;
      candidates.push({ id: p.id, score });
    }
  };
  add(home, homeWon);
  add(away, !homeWon);

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id < b.id ? -1 : 1; // desempate estável
  });

  return candidates[0]!.id;
}
