/**
 * Persistência de saves em IndexedDB (offline-first, versionado).
 *
 * Suporta múltiplos slots e metadados leves para listagem. O GameState é
 * serializável por contrato (P3), então salvamos/carregamos direto.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { GameState } from "@domain/types";
import { migrate } from "./migrations";

const DB_NAME = "volleymanager";
const DB_VERSION = 1;
const STORE = "saves";

/** Número máximo de jogos salvos simultâneos. */
export const MAX_SLOTS = 5;
export const SLOT_IDS: readonly string[] = Array.from(
  { length: MAX_SLOTS },
  (_, i) => `slot-${i + 1}`,
);

interface SaveRecord {
  slot: string;
  state: GameState;
  updatedAt: number;
  label: string;
}

/** Prefixo das cópias de segurança em localStorage (rede extra além do IndexedDB). */
const LS_PREFIX = "vcm_save_";

/** Escreve uma cópia do save no localStorage (não bloqueia; tolera falhas/quota). */
function mirrorToLocalStorage(record: SaveRecord): void {
  try {
    localStorage.setItem(LS_PREFIX + record.slot, JSON.stringify(record));
  } catch {
    // localStorage cheio/indisponível: o IndexedDB continua sendo a fonte principal
  }
}

/** Lê a cópia de um slot do localStorage, se houver. */
function readFromLocalStorage(slot: string): SaveRecord | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + slot);
    return raw ? (JSON.parse(raw) as SaveRecord) : null;
  } catch {
    return null;
  }
}

interface VolleyDB extends DBSchema {
  saves: {
    key: string;
    value: SaveRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<VolleyDB>> | null = null;

function getDb(): Promise<IDBPDatabase<VolleyDB>> {
  if (!dbPromise) {
    dbPromise = openDB<VolleyDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "slot" });
        }
      },
    });
  }
  return dbPromise;
}

export interface SaveMeta {
  slot: string;
  label: string;
  updatedAt: number;
}

/** Salva (ou sobrescreve) o estado num slot (IndexedDB + espelho no localStorage). */
export async function saveGame(slot: string, state: GameState, label: string): Promise<void> {
  const db = await getDb();
  const record: SaveRecord = { slot, state, updatedAt: Date.now(), label };
  await db.put(STORE, record);
  mirrorToLocalStorage(record);
}

/**
 * Carrega o estado de um slot (migrando se necessário). Se o IndexedDB não tiver
 * (ex.: foi limpo), tenta recuperar do espelho no localStorage. Retorna null se vazio.
 */
export async function loadGame(slot: string): Promise<GameState | null> {
  const db = await getDb();
  let record = await db.get(STORE, slot);
  if (!record) {
    // fallback: recupera do espelho e re-hidrata o IndexedDB
    const mirror = readFromLocalStorage(slot);
    if (!mirror) return null;
    await db.put(STORE, mirror);
    record = mirror;
  }
  return migrate(record.state as unknown as Record<string, unknown>);
}

/**
 * Lista os metadados dos slots existentes (IndexedDB + espelhos do localStorage).
 * Se o IndexedDB foi limpo mas o localStorage sobreviveu, os saves ainda aparecem.
 */
export async function listSaves(): Promise<SaveMeta[]> {
  const db = await getDb();
  const all = await db.getAll(STORE);
  const bySlot = new Map<string, SaveMeta>();
  for (const r of all) {
    bySlot.set(r.slot, { slot: r.slot, label: r.label, updatedAt: r.updatedAt });
  }
  // completa com espelhos que não estejam no IndexedDB
  for (const slot of SLOT_IDS) {
    if (!bySlot.has(slot)) {
      const mirror = readFromLocalStorage(slot);
      if (mirror) {
        bySlot.set(slot, { slot: mirror.slot, label: mirror.label, updatedAt: mirror.updatedAt });
      }
    }
  }
  return [...bySlot.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Remove um slot (IndexedDB + espelho). */
export async function deleteSave(slot: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, slot);
  try {
    localStorage.removeItem(LS_PREFIX + slot);
  } catch {
    // ignora
  }
}

// ---------------------------------------------------------------------------
// Exportar / Importar save em arquivo (.json) — backup manual do usuário
// ---------------------------------------------------------------------------

/** Estrutura do arquivo de backup exportado. */
interface SaveFile {
  app: "VCM26";
  kind: "save";
  slot: string;
  label: string;
  exportedAt: number;
  state: GameState;
}

/** Serializa o save de um slot como texto JSON (para download). Null se vazio. */
export async function exportSaveToJson(slot: string): Promise<string | null> {
  const db = await getDb();
  const record = (await db.get(STORE, slot)) ?? readFromLocalStorage(slot);
  if (!record) return null;
  const file: SaveFile = {
    app: "VCM26",
    kind: "save",
    slot: record.slot,
    label: record.label,
    exportedAt: Date.now(),
    state: record.state,
  };
  return JSON.stringify(file, null, 2);
}

/**
 * Importa um save a partir do texto JSON de um arquivo exportado, gravando-o no
 * `targetSlot`. Valida o formato e migra o estado. Lança erro se inválido.
 */
export async function importSaveFromJson(text: string, targetSlot: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Arquivo inválido: não é um JSON válido.");
  }
  const file = parsed as Partial<SaveFile>;
  if (file.app !== "VCM26" || file.kind !== "save" || !file.state) {
    throw new Error("Arquivo inválido: não é um save do VCM26.");
  }
  // migra o estado para o schema atual antes de gravar
  const state = migrate(file.state as unknown as Record<string, unknown>);
  await saveGame(targetSlot, state, file.label ?? "Jogo importado");
}
