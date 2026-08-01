import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import { teamById } from "@domain/selectors";
import { seasonLabel } from "@domain/career";
import { Button, Card, ScreenHeader } from "../components/ui";

export function ManagerProfile(): JSX.Element {
  const state = useGameStore((s) => s.state);
  const go = useNavStore((s) => s.go);
  if (!state) return <p style={{ padding: "1rem" }}>Carregando...</p>;

  const team = teamById(state, state.playerTeamId);
  const titles = state.history.filter((h) => h.playerWasChampion).length;
  const objectivesMet = state.history.filter((h) => h.objectiveMet).length;
  const seasons = state.history.length;
  const bestPos = state.history.reduce(
    (best, h) => Math.min(best, h.playerLeaguePosition),
    seasons > 0 ? Infinity : 0,
  );

  return (
    <div>
      <ScreenHeader title="Perfil do Treinador" />
      <div style={{ padding: "0 1rem 1rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        {/* Cabeçalho do treinador */}
        <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img
            src={state.managerAvatar}
            alt="avatar"
            width={64}
            height={64}
            style={{ borderRadius: "50%" }}
          />
          <div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{state.managerName}</div>
            <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
              {team ? team.name : "—"} · Temporada {seasonLabel(state.season)}
            </div>
          </div>
        </Card>

        {/* Resumo da carreira */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <StatBox label="Títulos" value={titles} />
          <StatBox label="Temporadas" value={seasons} />
          <StatBox label="Metas cumpridas" value={objectivesMet} />
          <StatBox label="Melhor posição" value={seasons > 0 && bestPos !== Infinity ? `${bestPos}º` : "—"} />
        </div>

        {/* Histórico de temporadas */}
        <Card>
          <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: 8 }}>HISTÓRICO</p>
          {state.history.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
              Nenhuma temporada concluída ainda.
            </p>
          ) : (
            state.history
              .slice()
              .reverse()
              .map((h) => (
                <div
                  key={h.season + "-" + h.teamId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.4rem 0",
                    borderBottom: "1px solid var(--surface-2)",
                    fontSize: "0.82rem",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{h.seasonLabel}</div>
                    <div style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>{h.teamName}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: h.playerWasChampion ? "var(--success)" : "var(--text)" }}>
                      {h.playerWasChampion ? "Campeão" : `${h.playerLeaguePosition}º na liga`}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: h.objectiveMet ? "var(--success)" : "var(--danger)" }}>
                      {h.objectiveMet ? "meta cumprida" : "meta não cumprida"}
                    </div>
                  </div>
                </div>
              ))
          )}
        </Card>

        <Button variant="ghost" onClick={() => go("dashboard")}>
          Voltar
        </Button>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number | string }): JSX.Element {
  return (
    <Card style={{ textAlign: "center" }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--accent)" }}>{value}</div>
      <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{label}</div>
    </Card>
  );
}
