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

/** Salva (ou sobrescreve) o estado num slot. */
export async function saveGame(slot: string, state: GameState, label: string): Promise<void> {
  const db = await getDb();
  const record: SaveRecord = { slot, state, updatedAt: Date.now(), label };
  await db.put(STORE, record);
}

/** Carrega o estado de um slot (migrando se necessário). Retorna null se vazio. */
export async function loadGame(slot: string): Promise<GameState | null> {
  const db = await getDb();
  const record = await db.get(STORE, slot);
  if (!record) return null;
  return migrate(record.state as unknown as Record<string, unknown>);
}

/** Lista os metadados dos slots existentes (para a tela de continuar). */
export async function listSaves(): Promise<SaveMeta[]> {
  const db = await getDb();
  const all = await db.getAll(STORE);
  return all
    .map((r) => ({ slot: r.slot, label: r.label, updatedAt: r.updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Remove um slot. */
export async function deleteSave(slot: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, slot);
}
