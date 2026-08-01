import { useEffect, useState } from "react";
import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import {
  listSaves,
  loadGame,
  deleteSave,
  SLOT_IDS,
  type SaveMeta,
} from "@persistence/saveStore";
import { Button, Card, ScreenHeader } from "../components/ui";

export function Menu(): JSX.Element {
  const saveNow = useGameStore((s) => s.saveNow);
  const activeSlot = useGameStore((s) => s.slot);
  const loadState = useGameStore((s) => s.loadState);
  const go = useNavStore((s) => s.go);

  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = (): void => {
    void listSaves().then(setSaves).catch(() => setSaves([]));
  };
  useEffect(refresh, []);

  const metaBySlot = new Map(saves.map((s) => [s.slot, s]));

  const onSave = async (): Promise<void> => {
    await saveNow();
    setStatus("Jogo salvo no " + activeSlot.replace("slot-", "slot "));
    refresh();
    setTimeout(() => setStatus(null), 2500);
  };

  const onLoad = async (slot: string): Promise<void> => {
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
    <div>
      <ScreenHeader title="Menu" subtitle="Ate 5 jogos salvos" />
      <div style={{ padding: "0 1rem 1rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <Button onClick={() => void onSave()}>Salvar jogo atual</Button>
        {status ? (
          <p style={{ color: "var(--success)", fontSize: "0.85rem", textAlign: "center" }}>{status}</p>
        ) : null}

        <Card>
          <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: 8 }}>SLOTS DE JOGO</p>
          {SLOT_IDS.map((slot, i) => {
            const meta = metaBySlot.get(slot);
            const isActive = slot === activeSlot;
            return (
              <div
                key={slot}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "0.5rem 0",
                  borderBottom: "1px solid var(--surface-2)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    Slot {i + 1}
                    {isActive ? " (atual)" : ""}
                  </div>
                  <div style={{ fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {meta ? meta.label : "vazio"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {meta ? (
                    <>
                      <button
                        onClick={() => void onLoad(slot)}
                        style={{
                          padding: "0.35rem 0.6rem",
                          borderRadius: 8,
                          border: "none",
                          background: "var(--accent-2)",
                          color: "#08131f",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Carregar
                      </button>
                      <button
                        onClick={() => void onDelete(slot)}
                        style={{
                          padding: "0.35rem 0.6rem",
                          borderRadius: 8,
                          border: "1px solid var(--surface-2)",
                          background: "transparent",
                          color: "var(--danger)",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Apagar
                      </button>
                    </>
                  ) : (
                    <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>—</span>
                  )}
                </div>
              </div>
            );
          })}
        </Card>

        <Button variant="ghost" onClick={() => go("title")}>
          Tela inicial
        </Button>
        <Button variant="ghost" onClick={() => go("dashboard")}>
          Voltar ao jogo
        </Button>
      </div>
    </div>
  );
}
