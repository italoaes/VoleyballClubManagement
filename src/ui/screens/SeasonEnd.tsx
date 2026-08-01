import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import { teamById } from "@domain/selectors";
import { seasonLabel } from "@domain/career";
import { Button, Card, ScreenHeader, TeamBadge } from "../components/ui";

export function SeasonEnd(): JSX.Element {
  const state = useGameStore((s) => s.state);
  const go = useNavStore((s) => s.go);
  if (!state) return <p style={{ padding: "1rem" }}>Carregando...</p>;

  const championId = state.playoffs?.championId ?? null;
  const champion = championId ? teamById(state, championId) : undefined;
  const playerIsChampion = championId === state.playerTeamId;
  const playerTeam = teamById(state, state.playerTeamId)!;

  const record = state.history[state.history.length - 1];
  const titles = state.history.filter((h) => h.playerWasChampion).length;

  // MVP do campeonato (jogador-estrela reinante) e o time onde ele está
  const mvpTeam = state.reigningMvpId
    ? state.teams.find((t) => t.roster.players.some((p) => p.id === state.reigningMvpId))
    : undefined;
  const mvpPlayer = mvpTeam?.roster.players.find((p) => p.id === state.reigningMvpId);
  const mvpTeamName = mvpTeam?.name ?? "";

  return (
    <div>
      <ScreenHeader title={"Fim da temporada " + seasonLabel(state.season)} />
      <div style={{ padding: "0 1rem 1rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <Card style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
          {champion ? (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <TeamBadge shortName={champion.shortName} crest={champion.crest} size={72} />
            </div>
          ) : null}
          <p style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>CAMPEAO</p>
          <h2 style={{ color: "var(--accent)", margin: "0.25rem 0" }}>{champion?.name ?? "-"}</h2>
        </Card>

        {mvpPlayer ? (
          <Card style={{ textAlign: "center" }}>
            <p style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>⭐ MVP DO CAMPEONATO</p>
            <strong style={{ fontSize: "1.05rem" }}>{mvpPlayer.name}</strong>
            <p style={{ color: "var(--text-dim)", fontSize: "0.75rem", marginTop: 4 }}>
              {mvpTeamName}
            </p>
          </Card>
        ) : null}

        {record ? (
          <Card style={{ textAlign: "center" }}>
            <p style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>OBJETIVO DA TEMPORADA</p>
            <p style={{ margin: "4px 0" }}>{record.objective.description}</p>
            <strong
              style={{
                fontSize: "1.05rem",
                color: record.objectiveMet ? "var(--success)" : "var(--danger)",
              }}
            >
              {record.objectiveMet ? "Objetivo cumprido!" : "Objetivo nao cumprido"}
            </strong>
            <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: 6 }}>
              {playerTeam.name} terminou em {record.playerLeaguePosition}o na liga
              {playerIsChampion ? " e foi campeao" : ""}.
            </p>
          </Card>
        ) : null}

        {state.history.length > 0 ? (
          <Card>
            <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: 8 }}>
              CARREIRA - {titles} titulo(s) em {state.history.length} temporada(s)
            </p>
            {state.history
              .slice()
              .reverse()
              .map((h) => (
                <div
                  key={h.season + "-" + h.teamId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.25rem 0",
                    fontSize: "0.82rem",
                    color: h.playerWasChampion ? "var(--success)" : "var(--text)",
                  }}
                >
                  <span>
                    {h.seasonLabel} - {h.teamName}
                  </span>
                  <span>
                    {h.playerWasChampion ? "Campeao" : h.playerLeaguePosition + "o"}
                    {h.objectiveMet ? " (meta ok)" : ""}
                  </span>
                </div>
              ))}
          </Card>
        ) : null}

        <Button onClick={() => go("offers")}>Ver Propostas</Button>
        <Button variant="ghost" onClick={() => go("standings")}>
          Ver classificacao final
        </Button>
      </div>
    </div>
  );
}
