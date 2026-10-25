import { state } from "./state";
import type { Card, Group } from "./types";

const LEGACY_KEY = "card-match-game";
const SETS_KEY = "card-match-sets";
const LAST_KEY = "card-match-last-set";
const K_PREF_KEY = "card-match-k-pref";

export interface PersistedGame {
	delimiter: string;
	firstRowHeader: boolean;
	headerRow: string[] | null;
	dataRows: string[][];
	maxCols: number;
	selectedCols: number[];
	k: number;
	roundIndex: number;
	cards: Card[];
	groups: Group[];
}

export interface SetMeta {
	id: string;
	name: string;
	updatedAt: number;
	rowCount: number;
	colCount: number;
}

export interface LoadedSet {
	meta: SetMeta;
	game: PersistedGame;
}

function setKey(id: string): string {
	return `card-match-set-${id}`;
}

function newId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readSets(): SetMeta[] {
	try {
		const raw = localStorage.getItem(SETS_KEY);
		if (!raw) return [];
		const arr = JSON.parse(raw) as SetMeta[];
		if (!Array.isArray(arr)) return [];
		return arr.filter((s) => s && typeof s.id === "string");
	} catch {
		return [];
	}
}

function writeSets(sets: SetMeta[]): void {
	try {
		localStorage.setItem(SETS_KEY, JSON.stringify(sets));
	} catch {
		// best-effort only
	}
}

function migrateLegacy(): void {
	try {
		const raw = localStorage.getItem(LEGACY_KEY);
		if (!raw) return;
		const game = JSON.parse(raw) as PersistedGame;
		if (!game || !Array.isArray(game.dataRows) || game.dataRows.length === 0)
			return;
		const meta: SetMeta = {
			id: newId(),
			name: "My first set",
			updatedAt: Date.now(),
			rowCount: game.dataRows.length,
			colCount: game.maxCols,
		};
		localStorage.setItem(setKey(meta.id), raw);
		const sets = readSets();
		sets.unshift(meta);
		writeSets(sets);
		localStorage.setItem(LAST_KEY, meta.id);
	} finally {
		try {
			localStorage.removeItem(LEGACY_KEY);
		} catch {
			// best-effort only
		}
	}
}

function ensureMigrated(): void {
	const migrated = localStorage.getItem(LEGACY_KEY);
	if (migrated !== null) migrateLegacy();
}

export function listSets(): SetMeta[] {
	ensureMigrated();
	return readSets().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getLastSetId(): string | null {
	ensureMigrated();
	try {
		return localStorage.getItem(LAST_KEY);
	} catch {
		return null;
	}
}

export function loadSet(id: string): PersistedGame | null {
	try {
		const raw = localStorage.getItem(setKey(id));
		if (!raw) return null;
		const p = JSON.parse(raw) as PersistedGame;
		if (!Array.isArray(p.dataRows) || p.dataRows.length === 0) return null;
		return p;
	} catch {
		return null;
	}
}

export function loadLastGame(): LoadedSet | null {
	ensureMigrated();
	const lastId = getLastSetId();
	const ids = lastId
		? [lastId, ...readSets().map((s) => s.id)]
		: readSets().map((s) => s.id);
	for (const id of ids) {
		const meta = readSets().find((s) => s.id === id);
		const game = meta ? loadSet(id) : null;
		if (meta && game) return { meta, game };
	}
	return null;
}

export function saveCurrentGame(): void {
	if (!state.currentSetId) return;
	if (!Array.isArray(state.dataRows) || state.dataRows.length === 0) return;

	const snap: PersistedGame = {
		delimiter: state.delimiter,
		firstRowHeader: state.firstRowHeader,
		headerRow: state.headerRow,
		dataRows: state.dataRows,
		maxCols: state.maxCols,
		selectedCols: state.selectedCols,
		k: state.k,
		roundIndex: state.roundIndex,
		cards: [...state.cards.values()],
		groups: state.groups,
	};

	try {
		localStorage.setItem(setKey(state.currentSetId), JSON.stringify(snap));
		localStorage.setItem(LAST_KEY, state.currentSetId);

		const sets = readSets();
		const meta = sets.find((s) => s.id === state.currentSetId);
		if (meta) {
			meta.updatedAt = Date.now();
			meta.rowCount = state.dataRows.length;
			meta.colCount = state.maxCols;
		} else {
			sets.unshift({
				id: state.currentSetId,
				name: state.currentSetName || "New set",
				updatedAt: Date.now(),
				rowCount: state.dataRows.length,
				colCount: state.maxCols,
			});
		}
		writeSets(sets);
	} catch {
		// best-effort only
	}
}

export function createSet(name: string): string {
	const id = newId();
	state.currentSetId = id;
	state.currentSetName = name || "New set";
	try {
		localStorage.setItem(LAST_KEY, id);
	} catch {
		// best-effort only
	}
	return id;
}

export function renameSet(id: string, name: string): void {
	const sets = readSets();
	const meta = sets.find((s) => s.id === id);
	if (!meta) return;
	meta.name = name.trim() || meta.name;
	writeSets(sets);
	if (state.currentSetId === id) state.currentSetName = meta.name;
}

export function deleteSet(id: string): void {
	try {
		localStorage.removeItem(setKey(id));
	} catch {
		// best-effort only
	}
	writeSets(readSets().filter((s) => s.id !== id));
	if (state.currentSetId === id) {
		state.currentSetId = null;
		state.currentSetName = null;
	}
}

export function getSetMeta(id: string): SetMeta | undefined {
	return readSets().find((s) => s.id === id);
}

// Remembers the last rows-per-round value typed by the user so it survives a
// reload before any set exists (per-set k is already stored in the snapshot).
export function loadKPref(): number | null {
	try {
		const raw = localStorage.getItem(K_PREF_KEY);
		if (!raw) return null;
		const n = Number.parseInt(raw, 10);
		if (Number.isNaN(n)) return null;
		return Math.max(1, Math.min(200, n));
	} catch {
		return null;
	}
}

export function saveKPref(k: number): void {
	try {
		localStorage.setItem(K_PREF_KEY, String(k));
	} catch {
		// best-effort only
	}
}
