import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import { lastPlayerResult, teamById } from "@domain/selectors";
import { Button, Card, ScreenHeader, TeamBadge } from "../components/ui";

export function MatchResult(): JSX.Element {
  const state = useGameStore((s) => s.state);
  const go = useNavStore((s) => s.go);
  if (!state) return <p style={{ padding: "1rem" }}>Carregando…</p>;

  const fx = lastPlayerResult(state);
  if (!fx || !fx.result) {
    return (
      <div>
        <ScreenHeader title="Resultado" />
        <div style={{ padding: "1rem" }}>
          <p style={{ color: "var(--text-dim)" }}>Nenhuma partida jogada ainda.</p>
          <Button variant="ghost" onClick={() => go("dashboard")} style={{ marginTop: 12 }}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const r = fx.result;
  const home = teamById(state, r.homeId)!;
  const away = teamById(state, r.awayId)!;
  const playerWon = r.winnerId === state.playerTeamId;

  return (
    <div>
      <ScreenHeader title="Resultado" subtitle={`Rodada ${fx.round}`} />
      <div style={{ padding: "0 1rem 1rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
              <TeamBadge shortName={home.shortName} crest={home.crest} size={44} />
              <span style={{ fontSize: "0.8rem" }}>{home.shortName}</span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800 }}>
              {r.setsHome} <span style={{ color: "var(--text-dim)" }}>x</span> {r.setsAway}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
              <TeamBadge shortName={away.shortName} crest={away.crest} size={44} />
              <span style={{ fontSize: "0.8rem" }}>{away.shortName}</span>
            </div>
          </div>
        </Card>

        <Card>
          <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: 8 }}>PLACAR POR SET</p>
          {r.sets.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "0.3rem 0",
                fontSize: "0.9rem",
                borderBottom: i < r.sets.length - 1 ? "1px solid var(--surface-2)" : "none",
              }}
            >
              <span style={{ color: "var(--text-dim)" }}>
                {i === 4 ? "Tie-break" : `Set ${i + 1}`}
              </span>
              <span style={{ fontWeight: 700 }}>
                {s.pointsHome} - {s.pointsAway}
              </span>
            </div>
          ))}
        </Card>

        <Card style={{ textAlign: "center" }}>
          <strong style={{ color: playerWon ? "var(--success)" : "var(--danger)", fontSize: "1.1rem" }}>
            {playerWon ? "Vitória!" : "Derrota"}
          </strong>
          {r.wentToTiebreak ? (
            <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginTop: 4 }}>
              Decidido no tie-break
            </p>
          ) : null}
        </Card>

        <Button onClick={() => go("dashboard")}>Continuar</Button>
      </div>
    </div>
  );
}
