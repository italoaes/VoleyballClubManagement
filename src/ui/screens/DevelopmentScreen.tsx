import { useState } from "react";
import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import { teamById } from "@domain/selectors";
import { playerOverall, pdCost, canInvest, FUNDAMENTALS } from "@domain/development";
import type { Fundamental, Player } from "@domain/types";
import { Button, Card, ScreenHeader } from "../components/ui";

const FUND_LABEL: Record<Fundamental, string> = {
  attack: "Ataque",
  block: "Bloqueio",
  serve: "Saque",
  receive: "Recepção",
  setting: "Levantamento",
  libero: "Defesa",
};

export function DevelopmentScreen(): JSX.Element {
  const state = useGameStore((s) => s.state);
  const investPD = useGameStore((s) => s.investPD);
  const startTraining = useGameStore((s) => s.startTraining);
  const cancelTraining = useGameStore((s) => s.cancelTraining);
  const go = useNavStore((s) => s.go);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!state) return <p style={{ padding: "1rem" }}>Carregando...</p>;
  const team = teamById(state, state.playerTeamId)!;
  const dev = state.development;

  const players = [...team.roster.players].sort((a, b) => playerOverall(b) - playerOverall(a));

  const trainingPlayer = dev.training
    ? team.roster.players.find((p) => p.id === dev.training!.playerId)
    : null;

  return (
    <div>
      <ScreenHeader title="Desenvolvimento" subtitle="Evolua seu elenco" />
      <div style={{ padding: "0 1rem 1rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        {/* Saldo de PD */}
        <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>Pontos de Desenvolvimento</span>
          <strong style={{ fontSize: "1.4rem", color: "var(--accent)" }}>{dev.points} PD</strong>
        </Card>

        {/* Treino ativo */}
        <Card>
          <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: 6 }}>FOCO DE TREINO</p>
          {dev.training && trainingPlayer ? (
            <div>
              <div style={{ fontWeight: 700 }}>
                {trainingPlayer.name} — {FUND_LABEL[dev.training.fundamental]}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", margin: "4px 0" }}>
                Progresso: {dev.training.roundsDone}/{dev.training.totalRounds} rodadas
              </div>
              <div style={{ height: 6, background: "var(--bg)", borderRadius: 3 }}>
                <div
                  style={{
                    height: 6,
                    width: `${(dev.training.roundsDone / dev.training.totalRounds) * 100}%`,
                    background: "var(--success)",
                    borderRadius: 3,
                  }}
                />
              </div>
              <Button variant="ghost" onClick={cancelTraining} style={{ marginTop: 8 }}>
                Cancelar treino
              </Button>
            </div>
          ) : (
            <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
              Nenhum treino ativo. Selecione um jogador abaixo para treinar (leva{" "}
              {5} rodadas) ou investir PD.
            </p>
          )}
        </Card>

        {/* Lista de jogadores */}
        <p style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>SELECIONE UM ATLETA</p>
        {players.map((p) => (
          <PlayerDevCard
            key={p.id}
            player={p}
            selected={selectedId === p.id}
            onSelect={() => setSelectedId(selectedId === p.id ? null : p.id)}
            pd={dev.points}
            hasTraining={dev.training !== null}
            onInvest={(f) => investPD(p.id, f)}
            onTrain={(f) => startTraining(p.id, f)}
          />
        ))}

        <Button variant="ghost" onClick={() => go("roster")} style={{ marginTop: 6 }}>
          Voltar ao plantel
        </Button>
      </div>
    </div>
  );
}

function PlayerDevCard({
  player,
  selected,
  onSelect,
  pd,
  hasTraining,
  onInvest,
  onTrain,
}: {
  player: Player;
  selected: boolean;
  onSelect: () => void;
  pd: number;
  hasTraining: boolean;
  onInvest: (f: Fundamental) => void;
  onTrain: (f: Fundamental) => void;
}): JSX.Element {
  const ovr = playerOverall(player);
  const atMax = ovr >= player.potential;
  return (
    <Card>
      <div
        onClick={onSelect}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{player.name}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
            {player.position} · {player.age} anos · pot {player.potential}
          </div>
        </div>
        <strong style={{ fontSize: "1.2rem", color: atMax ? "var(--text-dim)" : "var(--accent)" }}>{ovr}</strong>
      </div>

      {selected ? (
        atMax ? (
          <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginTop: 8 }}>
            Este atleta atingiu o potencial máximo.
          </p>
        ) : (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {FUNDAMENTALS.map((f) => {
              const val = player.attributes[f];
              const cost = pdCost(val);
              const investable = canInvest(player, f) && pd >= cost;
              return (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: "0.82rem" }}>
                    {FUND_LABEL[f]} <strong>{val}</strong>
                  </span>
                  <button
                    onClick={() => onInvest(f)}
                    disabled={!investable}
                    style={{
                      padding: "0.3rem 0.6rem",
                      borderRadius: 6,
                      border: "none",
                      background: investable ? "var(--accent)" : "var(--surface-2)",
                      color: investable ? "#08131f" : "var(--text-dim)",
                      fontWeight: 700,
                      fontSize: "0.75rem",
                      cursor: investable ? "pointer" : "not-allowed",
                    }}
                  >
                    +1 ({cost} PD)
                  </button>
                  <button
                    onClick={() => onTrain(f)}
                    disabled={hasTraining}
                    style={{
                      padding: "0.3rem 0.6rem",
                      borderRadius: 6,
                      border: "1px solid var(--surface-2)",
                      background: "transparent",
                      color: hasTraining ? "var(--text-dim)" : "var(--text)",
                      fontSize: "0.75rem",
                      cursor: hasTraining ? "not-allowed" : "pointer",
                    }}
                  >
                    Treinar
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : null}
    </Card>
  );
}
