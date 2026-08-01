import { useEffect, useState } from "react";
import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import { generateLeague, DEFAULT_GENERATE } from "@domain/generator";
import { teamStars } from "@domain/selectors";
import { AVATARS, defaultAvatar } from "@domain/avatars";
import type { Category } from "@domain/types";
import { listSaves, SLOT_IDS, type SaveMeta } from "@persistence/saveStore";
import { Button, Card, ScreenHeader, StarRating, TeamBadge } from "../components/ui";

export function NewGame(): JSX.Element {
  const startNewGame = useGameStore((s) => s.startNewGame);
  const go = useNavStore((s) => s.go);

  const [category, setCategory] = useState<Category>("male");
  const [managerName, setManagerName] = useState("");
  const [avatar, setAvatar] = useState<string>(defaultAvatar("male"));
  const [teamIndex, setTeamIndex] = useState(DEFAULT_GENERATE.numTeams - 1);
  const [saves, setSaves] = useState<SaveMeta[]>([]);

  useEffect(() => {
    void listSaves().then(setSaves).catch(() => setSaves([]));
  }, []);

  // ao trocar categoria, sugere um avatar coerente (sem travar a escolha do usuário)
  const chooseCategory = (c: Category): void => {
    setCategory(c);
    setAvatar(defaultAvatar(c));
  };

  const previewTeams = generateLeague({ ...DEFAULT_GENERATE, seed: 1, category });

  // primeiro slot livre (ou o último se todos ocupados)
  const usedSlots = new Set(saves.map((s) => s.slot));
  const freeSlot = SLOT_IDS.find((s) => !usedSlots.has(s)) ?? SLOT_IDS[SLOT_IDS.length - 1]!;

  const start = (): void => {
    startNewGame(
      {
        seed: Math.floor(Math.random() * 1_000_000),
        category,
        managerName: managerName.trim() || "Treinador",
        managerAvatar: avatar,
        playerTeamIndex: teamIndex,
      },
      freeSlot,
    );
    go("dashboard");
  };

  return (
    <div>
      <ScreenHeader title="Novo jogo" subtitle="Monte sua carreira" />
      <div style={{ padding: "0 1rem 1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Card>
          <label style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>Categoria</label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Button variant={category === "male" ? "primary" : "ghost"} onClick={() => chooseCategory("male")}>
              Masculino
            </Button>
            <Button variant={category === "female" ? "primary" : "ghost"} onClick={() => chooseCategory("female")}>
              Feminino
            </Button>
          </div>
        </Card>

        <Card>
          <label style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>Seu avatar</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
            {AVATARS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAvatar(a.src)}
                style={{
                  padding: 3,
                  borderRadius: "50%",
                  border: avatar === a.src ? "3px solid var(--accent)" : "3px solid transparent",
                  background: "transparent",
                  cursor: "pointer",
                  lineHeight: 0,
                }}
              >
                <img src={a.src} alt={a.id} width={56} height={56} style={{ borderRadius: "50%" }} />
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <label style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>Nome do treinador</label>
          <input
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            placeholder="Seu nome"
            style={{
              width: "100%",
              marginTop: 8,
              padding: "0.7rem",
              borderRadius: 8,
              border: "1px solid var(--surface-2)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: "1rem",
            }}
          />
        </Card>

        <Card>
          <label style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
            Escolha seu time
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {previewTeams.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setTeamIndex(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0.5rem 0.7rem",
                  borderRadius: 8,
                  border: teamIndex === i ? "2px solid var(--accent)" : "1px solid var(--surface-2)",
                  background: teamIndex === i ? "var(--surface-2)" : "var(--bg)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                <TeamBadge shortName={t.shortName} crest={t.crest} size={32} />
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div>{t.name}</div>
                  <StarRating stars={teamStars(t, category)} size={12} />
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Button onClick={start}>Começar temporada</Button>
        <Button variant="ghost" onClick={() => go("title")}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
