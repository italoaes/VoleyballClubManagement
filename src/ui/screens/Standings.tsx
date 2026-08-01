import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import { teamById } from "@domain/selectors";
import { Button, ScreenHeader, TeamBadge } from "../components/ui";

export function Standings(): JSX.Element {
  const state = useGameStore((s) => s.state);
  const go = useNavStore((s) => s.go);
  const viewTeam = useNavStore((s) => s.viewTeam);
  if (!state) return <p style={{ padding: "1rem" }}>Carregando…</p>;

  return (
    <div>
      <ScreenHeader title="Classificação" subtitle="Toque num time para ver o elenco" />
      <div style={{ padding: "0 0.5rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ color: "var(--text-dim)", textAlign: "right" }}>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>#</th>
              <th style={{ textAlign: "left" }}>Time</th>
              <th style={{ padding: "0.4rem" }}>Pts</th>
              <th>V</th>
              <th>D</th>
              <th>Sets</th>
            </tr>
          </thead>
          <tbody>
            {state.standings.map((s, i) => {
              const t = teamById(state, s.teamId)!;
              const isPlayer = s.teamId === state.playerTeamId;
              const qualifies = i < 8;
              return (
                <tr
                  key={s.teamId}
                  onClick={() => viewTeam(s.teamId, "standings")}
                  style={{
                    background: isPlayer ? "var(--surface-2)" : "transparent",
                    color: isPlayer ? "var(--accent)" : "var(--text)",
                    fontWeight: isPlayer ? 800 : 400,
                    borderBottom: "1px solid var(--surface)",
                    cursor: "pointer",
                  }}
                >
                  <td style={{ padding: "0.5rem 0.4rem", textAlign: "left" }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        marginRight: 6,
                        background: qualifies ? "var(--success)" : "transparent",
                      }}
                    />
                    {i + 1}
                  </td>
                  <td style={{ textAlign: "left" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <TeamBadge shortName={t.shortName} crest={t.crest} size={20} />
                      {t.shortName}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", padding: "0.5rem 0.4rem", fontWeight: 800 }}>
                    {s.points}
                  </td>
                  <td style={{ textAlign: "right" }}>{s.wins}</td>
                  <td style={{ textAlign: "right" }}>{s.losses}</td>
                  <td style={{ textAlign: "right" }}>
                    {s.setsWon}-{s.setsLost}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "1rem" }}>
        <Button onClick={() => go(state.phase === "playoffs" ? "playoffs" : "dashboard")}>
          {state.phase === "finished" ? "Ver campeão" : "Continuar"}
        </Button>
      </div>
    </div>
  );
}
