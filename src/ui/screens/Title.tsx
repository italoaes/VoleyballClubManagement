import { useEffect, useState } from "react";
import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import { listSaves, loadGame, deleteSave, SLOT_IDS, type SaveMeta } from "@persistence/saveStore";
import { Button } from "../components/ui";
import { Logo } from "../components/Logo";

export function Title(): JSX.Element {
  const loadState = useGameStore((s) => s.loadState);
  const go = useNavStore((s) => s.go);
  const [saves, setSaves] = useState<SaveMeta[]>([]);

  const refresh = (): void => {
    void listSaves().then(setSaves).catch(() => setSaves([]));
  };
  useEffect(refresh, []);

  const metaBySlot = new Map(saves.map((s) => [s.slot, s]));
  const hasFreeSlot = SLOT_IDS.some((s) => !metaBySlot.has(s));

  const resume = async (slot: string): Promise<void> => {
    const state = await loadGame(slot);
    if (state) {
      loadState(state, slot);
      go(state.phase === "finished" ? "season-end" : "dashboard");
    }
  };

  const onDelete = async (slot: string): Promise<void> => {
    await deleteSave(slot);
    refresh();
  };

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(180deg, #0b1b2b 0%, #10283f 45%, #0b1b2b 100%)",
      }}
    >
      {/* Logo / título */}
      <div style={{ padding: "2.8rem 1rem 1.8rem" }}>
        <Logo />
      </div>

      {/* Jogos salvos */}
      <div style={{ flex: 1, padding: "0 1rem", display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>SEUS JOGOS</p>

        {saves.length === 0 ? (
          <div
            style={{
              padding: "1.2rem",
              borderRadius: 12,
              border: "1px dashed var(--surface-2)",
              textAlign: "center",
              color: "var(--text-dim)",
              fontSize: "0.9rem",
            }}
          >
            Nenhum jogo salvo ainda. Comece um novo!
          </div>
        ) : (
          saves.map((sv, i) => (
            <div
              key={sv.slot}
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 8,
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid var(--surface-2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: 44,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--surface-2)",
                  fontWeight: 800,
                  color: "var(--accent)",
                }}
              >
                {i + 1}
              </div>
              <button
                onClick={() => void resume(sv.slot)}
                style={{
                  flex: 1,
                  textAlign: "left",
                  padding: "0.8rem",
                  background: "transparent",
                  border: "none",
                  color: "var(--text)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Continuar</div>
                <div style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>{sv.label}</div>
              </button>
              <button
                onClick={() => void onDelete(sv.slot)}
                aria-label="Apagar"
                style={{
                  width: 44,
                  background: "transparent",
                  border: "none",
                  borderLeft: "1px solid var(--surface-2)",
                  color: "var(--danger)",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {/* Ação principal */}
      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 8 }}>
        <Button onClick={() => go("new-game")}>Começar novo jogo</Button>
        {!hasFreeSlot ? (
          <p style={{ color: "var(--text-dim)", fontSize: "0.75rem", textAlign: "center" }}>
            Todos os 5 slots estão ocupados — um novo jogo usará o último slot.
          </p>
        ) : null}
      </div>
    </div>
  );
}
