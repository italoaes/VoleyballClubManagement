/**
 * Migração de saves versionados.
 *
 * Cada save carrega `schemaVersion`. Quando o schema evolui, uma migração leva
 * o save da versão N para N+1. Saves de versão desconhecida (futura) são
 * rejeitados; saves antigos são migrados em cadeia.
 */

import { SCHEMA_VERSION, type GameState } from "@domain/types";

/** Assinatura de uma migração de uma versão para a próxima. */
type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Registro de migrações por versão de ORIGEM.
 * migrations[1] leva um save v1 -> v2.
 */
const migrations: Record<number, Migration> = {
  // v1 -> v2: roster ganha `lineup` estruturado (antes: `courtIds`), e o
  // GameState ganha `season`/`history`.
  1: (data) => {
    const teams = Array.isArray(data["teams"]) ? (data["teams"] as unknown[]) : [];
    for (const team of teams) {
      const t = team as Record<string, unknown>;
      const roster = t["roster"] as Record<string, unknown> | undefined;
      if (roster && !roster["lineup"]) {
        const players = Array.isArray(roster["players"])
          ? (roster["players"] as { id: string; position: string }[])
          : [];
        const firstOf = (pos: string): string =>
          players.find((p) => p.position === pos)?.id ?? players[0]?.id ?? "";
        const allOf = (pos: string): string[] =>
          players.filter((p) => p.position === pos).map((p) => p.id);
        const outsides = allOf("Ponteiro");
        const middles = allOf("Central");
        roster["lineup"] = {
          setter: firstOf("Levantador"),
          outsides: [outsides[0] ?? "", outsides[1] ?? ""],
          middles: [middles[0] ?? "", middles[1] ?? ""],
          opposite: firstOf("Oposto"),
          libero: firstOf("Líbero"),
        };
        delete roster["courtIds"];
      }
    }
    if (typeof data["season"] !== "number") data["season"] = 1;
    if (!Array.isArray(data["history"])) data["history"] = [];
    return data;
  },
  // v2 -> v3: times ganham `crest`; GameState ganha `managerAvatar`.
  2: (data) => {
    const teams = Array.isArray(data["teams"]) ? (data["teams"] as unknown[]) : [];
    for (const team of teams) {
      const t = team as Record<string, unknown>;
      if (!t["crest"]) t["crest"] = "/assets/ui/star.png";
    }
    if (typeof data["managerAvatar"] !== "string") {
      data["managerAvatar"] = "/assets/avatars/male-1.png";
    }
    return data;
  },
  // v3 -> v4: temporada vira ano (26...); adiciona objective, offers; enriquece history.
  3: (data) => {
    // season numérico antigo (1,2,3...) vira ano de início (26,27,28...)
    const oldSeason = typeof data["season"] === "number" ? (data["season"] as number) : 1;
    data["season"] = 26 + Math.max(0, oldSeason - 1);
    if (!data["objective"]) {
      data["objective"] = {
        type: "midtable",
        description: "Terminar no meio da tabela",
        targetPosition: 6,
      };
    }
    if (!("offers" in data)) data["offers"] = null;
    // enriquece registros de histórico antigos
    const history = Array.isArray(data["history"]) ? (data["history"] as unknown[]) : [];
    data["history"] = history.map((h, idx) => {
      const r = h as Record<string, unknown>;
      const yr = typeof r["season"] === "number" ? (r["season"] as number) : idx + 1;
      const startYear = yr >= 26 ? yr : 26 + (yr - 1);
      const a = ((startYear % 100) + 100) % 100;
      const b = (a + 1) % 100;
      const pad = (n: number): string => n.toString().padStart(2, "0");
      return {
        season: startYear,
        seasonLabel: r["seasonLabel"] ?? `${pad(a)}/${pad(b)}`,
        teamId: r["teamId"] ?? "",
        teamName: r["teamName"] ?? "—",
        championId: r["championId"] ?? "",
        championName: r["championName"] ?? "—",
        playerLeaguePosition: r["playerLeaguePosition"] ?? 0,
        playerWasChampion: r["playerWasChampion"] ?? false,
        objective: r["objective"] ?? {
          type: "midtable",
          description: "Meio da tabela",
          targetPosition: 6,
        },
        objectiveMet: r["objectiveMet"] ?? false,
      };
    });
    return data;
  },
  // v4 -> v5: jogadores ganham potential/growthProgress/number/setsPlayed;
  // GameState ganha `development`.
  4: (data) => {
    const overallOf = (a: Record<string, number>): number =>
      Math.round(
        ((a["attack"] ?? 0) +
          (a["block"] ?? 0) +
          (a["serve"] ?? 0) +
          (a["receive"] ?? 0) +
          (a["setting"] ?? 0) +
          (a["libero"] ?? 0)) /
          6,
      );
    const teams = Array.isArray(data["teams"]) ? (data["teams"] as unknown[]) : [];
    for (const team of teams) {
      const t = team as Record<string, unknown>;
      const roster = t["roster"] as Record<string, unknown> | undefined;
      const players = roster && Array.isArray(roster["players"]) ? (roster["players"] as unknown[]) : [];
      players.forEach((pl, idx) => {
        const p = pl as Record<string, unknown>;
        const attrs = (p["attributes"] ?? {}) as Record<string, number>;
        const ovr = overallOf(attrs);
        const age = typeof p["age"] === "number" ? (p["age"] as number) : 25;
        if (typeof p["potential"] !== "number") {
          // potencial conservador para saves antigos (jovens ganham margem)
          const bonus = age <= 21 ? 8 : age <= 27 ? 4 : age <= 30 ? 1 : 0;
          p["potential"] = Math.min(99, ovr + bonus);
        }
        if (typeof p["growthProgress"] !== "number") p["growthProgress"] = 0;
        if (typeof p["number"] !== "number") p["number"] = idx + 1;
        if (typeof p["setsPlayed"] !== "number") p["setsPlayed"] = 0;
      });
    }
    if (!data["development"]) {
      data["development"] = { points: 0, training: null };
    }
    return data;
  },
};

export class SaveVersionError extends Error {}

/** Migra um objeto de save bruto até a versão atual do schema. */
export function migrate(raw: Record<string, unknown>): GameState {
  const version = typeof raw["schemaVersion"] === "number" ? (raw["schemaVersion"] as number) : 0;

  if (version > SCHEMA_VERSION) {
    throw new SaveVersionError(
      `save de versão ${version} é mais novo que o suportado (${SCHEMA_VERSION})`,
    );
  }

  let data = raw;
  let v = version;
  while (v < SCHEMA_VERSION) {
    const step = migrations[v];
    if (!step) {
      throw new SaveVersionError(`sem migração de v${v} para v${v + 1}`);
    }
    data = step(data);
    v += 1;
    data["schemaVersion"] = v;
  }

  return data as unknown as GameState;
}
