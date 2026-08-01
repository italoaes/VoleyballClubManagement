import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import {
  listSaves,
  loadGame,
  deleteSave,
  exportSaveToJson,
  importSaveFromJson,
  SLOT_IDS,
  type SaveMeta,
} from "@persistence/saveStore";
import { Button, Card, ScreenHeader } from "../components/ui";

const slotBtnBase: React.CSSProperties = {
  padding: "0.3rem 0.55rem",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: "0.75rem",
  fontWeight: 700,
};

function slotBtn(bg: string, color: string): React.CSSProperties {
  return { ...slotBtnBase, border: "none", background: bg, color };
}

function slotBtnGhost(color = "var(--text)"): React.CSSProperties {
  return {
    ...slotBtnBase,
    border: "1px solid var(--surface-2)",
    background: "transparent",
    color,
    fontWeight: 500,
  };
}

export function Menu(): JSX.Element {
  const saveNow = useGameStore((s) => s.saveNow);
  const activeSlot = useGameStore((s) => s.slot);
  const loadState = useGameStore((s) => s.loadState);
  const go = useNavStore((s) => s.go);

  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importSlotRef = useRef<string>("slot-1");

  const refresh = (): void => {
    void listSaves().then(setSaves).catch(() => setSaves([]));
  };
  useEffect(refresh, []);

  const metaBySlot = new Map(saves.map((s) => [s.slot, s]));

  const flash = (msg: string): void => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 2800);
  };

  const onSave = async (): Promise<void> => {
    await saveNow();
    flash("Jogo salvo no " + activeSlot.replace("slot-", "slot "));
    refresh();
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

  const onExport = async (slot: string): Promise<void> => {
    const json = await exportSaveToJson(slot);
    if (!json) {
      flash("Slot vazio, nada para exportar.");
      return;
    }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VCM26-${slot}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash("Backup exportado.");
  };

  const triggerImport = (slot: string): void => {
    importSlotRef.current = slot;
    fileInputRef.current?.click();
  };

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reimportar o mesmo arquivo depois
    if (!file) return;
    try {
      const text = await file.text();
      await importSaveFromJson(text, importSlotRef.current);
      refresh();
      flash("Save importado para o " + importSlotRef.current.replace("slot-", "slot "));
    } catch (err) {
      flash(err instanceof Error ? err.message : "Falha ao importar.");
    }
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
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {meta ? (
                    <>
                      <button
                        onClick={() => void onLoad(slot)}
                        style={slotBtn("var(--accent-2)", "#08131f")}
                      >
                        Carregar
                      </button>
                      <button onClick={() => void onExport(slot)} style={slotBtnGhost()}>
                        Exportar
                      </button>
                      <button onClick={() => triggerImport(slot)} style={slotBtnGhost()}>
                        Importar
                      </button>
                      <button
                        onClick={() => void onDelete(slot)}
                        style={slotBtnGhost("var(--danger)")}
                      >
                        Apagar
                      </button>
                    </>
                  ) : (
                    <button onClick={() => triggerImport(slot)} style={slotBtnGhost()}>
                      Importar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>

        <p style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>
          Dica: use <strong>Exportar</strong> para guardar um backup do seu progresso em
          arquivo. Se limpar os dados do navegador ou trocar de aparelho, use
          <strong> Importar</strong> para restaurar.
        </p>

        {/* input escondido para importar arquivo de save */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={(e) => void onFileChosen(e)}
        />

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
