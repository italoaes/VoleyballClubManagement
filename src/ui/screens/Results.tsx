import { useState } from "react";
import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import {
  playedRounds,
  resultsForRound,
  upcomingRounds,
  fixturesForRound,
  teamById,
} from "@domain/selectors";
import type { Fixture, GameState } from "@domain/types";
import { Button, Card, ScreenHeader, TeamBadge } from "../components/ui";

/** Card de um resultado, expansível para mostrar as parciais por set. */
function ResultCard({ state, fixture }: { state: GameState; fixture: Fixture }): JSX.Element {
  const [open, setOpen] = useState(false);
  const home = teamById(state, fixture.homeId)!;
  const away = teamById(state, fixture.awayId)!;
  const r = fixture.result!;
  const isPlayerMatch =
    fixture.homeId === state.playerTeamId || fixture.awayId === state.playerTeamId;
  const mvpName = r.mvpId
    ? [...home.roster.players, ...away.roster.players].find((p) => p.id === r.mvpId)?.name ?? null
    : null;

  return (
    <Card
      onClick={() => setOpen((o) => !o)}
      style={{
        marginBottom: 6,
        cursor: "pointer",
        border: isPlayerMatch ? "1px solid var(--accent-2)" : "1px solid var(--surface-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
          <TeamBadge shortName={home.shortName} crest={home.crest} size={22} />
          <span style={{ fontWeight: r.winnerId === home.id ? 800 : 400 }}>{home.shortName}</span>
        </span>
        <strong style={{ fontSize: "1.05rem" }}>
          {r.setsHome} - {r.setsAway}
        </strong>
        <span style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>
          <span style={{ fontWeight: r.winnerId === away.id ? 800 : 400 }}>{away.shortName}</span>
          <TeamBadge shortName={away.shortName} crest={away.crest} size={22} />
        </span>
      </div>

      {open ? (
        <div style={{ marginTop: 8, borderTop: "1px solid var(--surface-2)", paddingTop: 8 }}>
          <div style={{ color: "var(--text-dim)", fontSize: "0.72rem", marginBottom: 4 }}>PARCIAIS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {r.sets.map((s, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: "0.85rem",
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: "var(--bg)",
                  border: "1px solid var(--surface-2)",
                }}
              >
                {s.pointsHome}-{s.pointsAway}
              </span>
            ))}
          </div>
          {mvpName ? (
            <div style={{ color: "var(--text-dim)", fontSize: "0.75rem", marginTop: 6 }}>
              ⭐ MVP: <span style={{ color: "var(--text)" }}>{mvpName}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/** Card de um jogo futuro (apenas o confronto). */
function FixtureCard({ state, fixture }: { state: GameState; fixture: Fixture }): JSX.Element {
  const home = teamById(state, fixture.homeId)!;
  const away = teamById(state, fixture.awayId)!;
  const isPlayerMatch =
    fixture.homeId === state.playerTeamId || fixture.awayId === state.playerTeamId;
  return (
    <Card
      style={{
        marginBottom: 6,
        border: isPlayerMatch ? "1px solid var(--accent-2)" : "1px solid var(--surface-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
          <TeamBadge shortName={home.shortName} crest={home.crest} size={22} />
          <span>{home.shortName}</span>
        </span>
        <span style={{ color: "var(--text-dim)", fontWeight: 700 }}>x</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>
          <span>{away.shortName}</span>
          <TeamBadge shortName={away.shortName} crest={away.crest} size={22} />
        </span>
      </div>
    </Card>
  );
}

export function Results(): JSX.Element {
  const state = useGameStore((s) => s.state);
  const go = useNavStore((s) => s.go);

  const [tab, setTab] = useState<"past" | "next">("past");
  const played = state ? playedRounds(state) : [];
  const upcoming = state ? upcomingRounds(state) : [];
  const [pastRound, setPastRound] = useState<number>(played[played.length - 1] ?? 1);
  const [nextRound, setNextRound] = useState<number>(upcoming[0] ?? 1);

  if (!state) return <p style={{ padding: "1rem" }}>Carregando...</p>;

  const TabButton = ({ id, label }: { id: "past" | "next"; label: string }): JSX.Element => (
    <button
      onClick={() => setTab(id)}
      style={{
        flex: 1,
        padding: "0.5rem",
        borderRadius: 8,
        border: "none",
        background: tab === id ? "var(--accent)" : "var(--surface)",
        color: tab === id ? "#08131f" : "var(--text-dim)",
        fontWeight: 800,
        cursor: "pointer",
        fontSize: "0.85rem",
      }}
    >
      {label}
    </button>
  );

  const RoundSelector = ({
    rounds,
    active,
    onPick,
  }: {
    rounds: number[];
    active: number;
    onPick: (r: number) => void;
  }): JSX.Element => (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 8 }}>
      {rounds.map((r) => (
        <button
          key={r}
          onClick={() => onPick(r)}
          style={{
            padding: "0.35rem 0.7rem",
            borderRadius: 8,
            border: r === active ? "2px solid var(--accent)" : "1px solid var(--surface-2)",
            background: r === active ? "var(--surface-2)" : "var(--bg)",
            color: "var(--text)",
            cursor: "pointer",
            fontSize: "0.8rem",
            flexShrink: 0,
          }}
        >
          R{r}
        </button>
      ))}
    </div>
  );

  const activePast = played.includes(pastRound) ? pastRound : played[played.length - 1];
  const activeNext = upcoming.includes(nextRound) ? nextRound : upcoming[0];

  return (
    <div>
      <ScreenHeader title="Resultados" subtitle="Placares e próximos jogos" />
      <div style={{ padding: "0 1rem 1rem" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <TabButton id="past" label="Jogados" />
          <TabButton id="next" label="Próximos" />
        </div>

        {tab === "past" ? (
          played.length === 0 ? (
            <p style={{ color: "var(--text-dim)" }}>Nenhuma rodada jogada ainda.</p>
          ) : (
            <>
              <RoundSelector rounds={played} active={activePast!} onPick={setPastRound} />
              {resultsForRound(state, activePast!).map((f, i) => (
                <ResultCard key={i} state={state} fixture={f} />
              ))}
              <p style={{ color: "var(--text-dim)", fontSize: "0.72rem", marginTop: 6 }}>
                Toque num jogo para ver as parciais por set.
              </p>
            </>
          )
        ) : upcoming.length === 0 ? (
          <p style={{ color: "var(--text-dim)" }}>Não há jogos futuros nesta fase.</p>
        ) : (
          <>
            <RoundSelector rounds={upcoming} active={activeNext!} onPick={setNextRound} />
            {fixturesForRound(state, activeNext!).map((f, i) => (
              <FixtureCard key={i} state={state} fixture={f} />
            ))}
          </>
        )}

        <Button variant="ghost" onClick={() => go("dashboard")} style={{ marginTop: 10 }}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
