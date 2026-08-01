import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import {
  nextPlayerFixture,
  positionOf,
  recentForm,
  teamById,
} from "@domain/selectors";
import { totalRounds } from "@domain/league";
import { seasonLabel } from "@domain/career";
import type { GameState } from "@domain/types";
import { Button, Card, FormBar, ScreenHeader, TeamBadge } from "../components/ui";
import { assetUrl } from "../asset";

function NextMatchCard({ state }: { state: GameState }): JSX.Element {
  const fx = nextPlayerFixture(state);
  if (!fx) {
    return (
      <Card>
        <p style={{ color: "var(--text-dim)" }}>Sem jogos pendentes nesta fase.</p>
      </Card>
    );
  }
  const home = teamById(state, fx.homeId)!;
  const away = teamById(state, fx.awayId)!;
  return (
    <Card>
      <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: 8 }}>
        PRÓXIMO JOGO · Rodada {fx.round}
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
          <TeamBadge shortName={home.shortName} crest={home.crest} size={48} />
          <strong style={{ fontSize: "0.8rem", textAlign: "center" }}>{home.shortName}</strong>
          <FormBar form={recentForm(state, home.id)} />
        </div>
        <span style={{ color: "var(--text-dim)", fontWeight: 800, padding: "0 0.5rem" }}>x</span>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
          <TeamBadge shortName={away.shortName} crest={away.crest} size={48} />
          <strong style={{ fontSize: "0.8rem", textAlign: "center" }}>{away.shortName}</strong>
          <FormBar form={recentForm(state, away.id)} />
        </div>
      </div>
    </Card>
  );
}

function MiniTable({ state }: { state: GameState }): JSX.Element {
  const top = state.standings.slice(0, 6);
  return (
    <Card>
      <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: 8 }}>CLASSIFICAÇÃO</p>
      {top.map((s, i) => {
        const t = teamById(state, s.teamId)!;
        const isPlayer = s.teamId === state.playerTeamId;
        return (
          <div
            key={s.teamId}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0.3rem 0",
              fontSize: "0.85rem",
              fontWeight: isPlayer ? 800 : 400,
              color: isPlayer ? "var(--accent)" : "var(--text)",
            }}
          >
            <span>
              {i + 1}. {t.shortName}
            </span>
            <span>{s.points} pts</span>
          </div>
        );
      })}
    </Card>
  );
}

function ManagerBar({ state, onOpen }: { state: GameState; onOpen: () => void }): JSX.Element {
  return (
    <div
      onClick={onOpen}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0.5rem 1rem",
        cursor: "pointer",
      }}
    >
      <img
        src={assetUrl(state.managerAvatar)}
        alt="avatar"
        width={44}
        height={44}
        style={{ borderRadius: "50%" }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700 }}>{state.managerName}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Treinador · ver perfil</div>
      </div>
      <span
        style={{
          fontSize: "0.8rem",
          fontWeight: 800,
          color: "var(--accent)",
          border: "1px solid var(--accent)",
          borderRadius: 8,
          padding: "3px 8px",
        }}
      >
        {state.development.points} PD
      </span>
    </div>
  );
}

export function Dashboard(): JSX.Element {
  const state = useGameStore((s) => s.state);
  const advance = useGameStore((s) => s.advance);
  const go = useNavStore((s) => s.go);

  if (!state) return <p style={{ padding: "1rem" }}>Carregando…</p>;

  const playerTeam = teamById(state, state.playerTeamId)!;
  const pos = positionOf(state, state.playerTeamId);
  const last = totalRounds(state.teams.length);

  const phaseLabel =
    state.phase === "league"
      ? `Temporada ${seasonLabel(state.season)} · Rodada ${state.currentRound}/${last}`
      : state.phase === "playoffs"
        ? `Temporada ${seasonLabel(state.season)} · Playoffs`
        : "Temporada encerrada";

  // mata-mata continua com avanço rápido (jogos do jogador e demais simulados)
  const advancePlayoffs = (): void => {
    advance();
    const after = useGameStore.getState().state!;
    if (after.phase === "finished") go("season-end");
    else go("playoffs");
  };

  return (
    <div>
      <ManagerBar state={state} onOpen={() => go("manager")} />
      <ScreenHeader title={playerTeam.name} subtitle={`${phaseLabel} · ${pos}º lugar`} />
      <div style={{ padding: "0 1rem 1rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <Card>
          <p style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>OBJETIVO DA TEMPORADA</p>
          <strong style={{ fontSize: "0.95rem" }}>{state.objective.description}</strong>
        </Card>

        {state.phase === "league" ? <NextMatchCard state={state} /> : null}
        <MiniTable state={state} />

        {state.phase === "league" ? (
          <Button onClick={() => go("match-preview")}>PRÓXIMA PARTIDA</Button>
        ) : state.phase === "playoffs" ? (
          <Button onClick={advancePlayoffs}>AVANÇAR PLAYOFFS</Button>
        ) : (
          <Button onClick={() => go("season-end")}>VER RESULTADO FINAL</Button>
        )}

        <Button variant="ghost" onClick={() => go("standings")}>
          Ver tabela completa
        </Button>
        <Button variant="ghost" onClick={() => go("results")}>
          Resultados das rodadas
        </Button>
        {state.playoffs ? (
          <Button variant="ghost" onClick={() => go("playoffs")}>
            Ver playoffs
          </Button>
        ) : null}
      </div>
    </div>
  );
}
