import { useState } from "react";
import { useGameStore } from "@state/gameStore";
import { useMatchStore } from "@state/matchStore";
import { useNavStore } from "@state/navStore";
import { reservesForPosition, lineupIds } from "@domain/lineup";
import { Position, type Player } from "@domain/types";
import { Button, Card, ScreenHeader, TeamBadge } from "../components/ui";

const POSITION_ORDER: Position[] = [
  Position.Setter,
  Position.Outside,
  Position.Middle,
  Position.Opposite,
  Position.Libero,
];

function SubPanel({ onDone }: { onDone: () => void }): JSX.Element {
  const live = useMatchStore((s) => s.live)!;
  const subsLeft = useMatchStore((s) => s.subsLeft);
  const makeSub = useMatchStore((s) => s.makeSub);
  const roster = live.playerTeam.roster;
  const byId = new Map(roster.players.map((p) => [p.id, p]));
  const [outSel, setOutSel] = useState<string | null>(null);

  const courtIds = lineupIds(roster.lineup);
  const courtPlayers = courtIds.map((id) => byId.get(id)!).filter(Boolean);

  const doSub = (inId: string): void => {
    if (!outSel) return;
    makeSub(outSel, inId);
    setOutSel(null);
  };

  return (
    <Card style={{ marginTop: 12 }}>
      <p style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
        Substituições ({subsLeft} restantes) — troque por reservas da mesma posição
      </p>
      {subsLeft > 0 ? (
        <>
          <p style={{ fontSize: "0.8rem", marginTop: 8, marginBottom: 4 }}>Sai:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {POSITION_ORDER.flatMap((pos) =>
              courtPlayers
                .filter((p) => p.position === pos)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setOutSel(p.id)}
                    style={{
                      padding: "0.4rem 0.6rem",
                      borderRadius: 8,
                      border: outSel === p.id ? "2px solid var(--accent)" : "1px solid var(--surface-2)",
                      background: "var(--bg)",
                      color: "var(--text)",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    {p.name} · {p.position.slice(0, 3)}
                  </button>
                )),
            )}
          </div>
          {outSel ? (
            <>
              <p style={{ fontSize: "0.8rem", marginTop: 10, marginBottom: 4 }}>Entra:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {reservesForPosition(roster, byId.get(outSel)!.position).map((p: Player) => (
                  <button
                    key={p.id}
                    onClick={() => doSub(p.id)}
                    style={{
                      padding: "0.4rem 0.6rem",
                      borderRadius: 8,
                      border: "1px solid var(--accent-2)",
                      background: "var(--bg)",
                      color: "var(--text)",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    {p.name}
                  </button>
                ))}
                {reservesForPosition(roster, byId.get(outSel)!.position).length === 0 ? (
                  <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>
                    Sem reservas nesta posição
                  </span>
                ) : null}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginTop: 8 }}>
          Sem substituições restantes.
        </p>
      )}
      <Button onClick={onDone} style={{ marginTop: 12 }}>
        Continuar
      </Button>
    </Card>
  );
}

export function LiveMatch(): JSX.Element {
  const commitRound = useGameStore((s) => s.commitRound);
  const commitPlayoff = useGameStore((s) => s.commitPlayoff);
  const live = useMatchStore((s) => s.live);
  const context = useMatchStore((s) => s.context);
  const playSet = useMatchStore((s) => s.playSet);
  const result = useMatchStore((s) => s.result);
  const clear = useMatchStore((s) => s.clear);
  const go = useNavStore((s) => s.go);

  const [showSubs, setShowSubs] = useState(false);

  if (!live) {
    return (
      <div>
        <ScreenHeader title="Partida" />
        <div style={{ padding: "1rem" }}>
          <p style={{ color: "var(--text-dim)" }}>Nenhuma partida em andamento.</p>
          <Button variant="ghost" onClick={() => go("dashboard")} style={{ marginTop: 12 }}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const playerTeam = live.playerTeam;
  const opp = live.opponent;

  // melhor da partida (quando finalizada)
  let mvpName: string | null = null;
  let mvpTeamShort: string | null = null;
  if (live.finished) {
    const r = result();
    if (r?.mvpId) {
      const inPlayer = playerTeam.roster.players.find((p) => p.id === r.mvpId);
      const inOpp = opp.roster.players.find((p) => p.id === r.mvpId);
      const found = inPlayer ?? inOpp;
      if (found) {
        mvpName = found.name;
        mvpTeamShort = inPlayer ? playerTeam.shortName : opp.shortName;
      }
    }
  }

  const finish = (): void => {
    const r = result();
    if (r) {
      if (context === "playoff") {
        commitPlayoff(r);
        clear();
        go("playoffs");
      } else {
        commitRound(r);
        clear();
        go("standings");
      }
    }
  };

  return (
    <div>
      <ScreenHeader title="Partida" subtitle={`${playerTeam.name} x ${opp.name}`} />
      <div style={{ padding: "0 1rem 1rem" }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
              <TeamBadge shortName={playerTeam.shortName} crest={playerTeam.crest} size={44} />
              <span style={{ fontSize: "0.8rem" }}>{playerTeam.shortName}</span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800 }}>
              {live.setsPlayer} <span style={{ color: "var(--text-dim)" }}>x</span> {live.setsOpponent}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
              <TeamBadge shortName={opp.shortName} crest={opp.crest} size={44} />
              <span style={{ fontSize: "0.8rem" }}>{opp.shortName}</span>
            </div>
          </div>
        </Card>

        <Card style={{ marginTop: 12 }}>
          <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: 8 }}>SETS</p>
          {live.sets.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
              Nenhum set jogado ainda. Toque em “Jogar set”.
            </p>
          ) : (
            live.sets.map((s) => (
              <div
                key={s.index}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.3rem 0",
                  fontSize: "0.9rem",
                  color: s.playerWon ? "var(--success)" : "var(--danger)",
                }}
              >
                <span style={{ color: "var(--text-dim)" }}>
                  {s.isTiebreak ? "Tie-break" : `Set ${s.index + 1}`}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {s.pointsPlayer} - {s.pointsOpponent}
                </span>
              </div>
            ))
          )}
        </Card>

        {!live.finished ? (
          showSubs ? (
            <SubPanel onDone={() => setShowSubs(false)} />
          ) : (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <Button onClick={playSet}>Jogar set {live.sets.length + 1}</Button>
              {live.sets.length > 0 ? (
                <Button variant="ghost" onClick={() => setShowSubs(true)}>
                  Fazer substituições
                </Button>
              ) : null}
            </div>
          )
        ) : (
          <>
            {mvpName ? (
              <Card style={{ marginTop: 12, textAlign: "center" }}>
                <p style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>⭐ MELHOR DA PARTIDA</p>
                <strong style={{ fontSize: "1.05rem" }}>{mvpName}</strong>
                {mvpTeamShort ? (
                  <span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}> · {mvpTeamShort}</span>
                ) : null}
              </Card>
            ) : null}
            <Button onClick={finish} style={{ marginTop: 12 }}>
              {live.setsPlayer > live.setsOpponent ? "Vitória!" : "Continuar"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
