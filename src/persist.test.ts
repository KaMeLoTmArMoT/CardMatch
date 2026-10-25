import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createSet,
	deleteSet,
	getSetMeta,
	importSet,
	listSets,
	loadKPref,
	loadLastGame,
	loadSet,
	saveCurrentGame,
	saveKPref,
	serializeSet,
} from "./persist";
import { state } from "./state";
import type { Card, Group } from "./types";

function makeStore(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (k) => map.get(k) ?? null,
		key: (i) => [...map.keys()][i] ?? null,
		removeItem: (k) => map.delete(k),
		setItem: (k, v) => map.set(k, String(v)),
	};
}

function makeCard(cardId: string): Card {
	return {
		cardId,
		rowId: 0,
		colIndex: 0,
		slotIndexExpected: 0,
		text: `text ${cardId}`,
		state: "free",
		placed: null,
		duplicateOrdinal: null,
	};
}

function makeGroup(groupId: number): Group {
	return { groupId, slots: [null], state: "open", movedToBottom: false };
}

function fillState(): void {
	state.delimiter = ",";
	state.firstRowHeader = true;
	state.headerRow = ["A", "B"];
	state.dataRows = [
		["a1", "b1"],
		["a2", "b2"],
	];
	state.maxCols = 2;
	state.selectedCols = [0, 1];
	state.k = 7;
	state.roundIndex = 1;
	state.cards = new Map([
		["c1", makeCard("c1")],
		["c2", makeCard("c2")],
	]);
	state.groups = [makeGroup(0)];
}

beforeEach(() => {
	vi.stubGlobal("localStorage", makeStore());
	state.currentSetId = null;
	state.currentSetName = null;
	state.dataRows = [];
	state.cards = new Map();
	state.groups = [];
	state.k = 10;
	state.roundIndex = 0;
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("saveCurrentGame", () => {
	it("no-ops without an open set", () => {
		fillState();
		state.currentSetId = null;
		saveCurrentGame();
		expect(localStorage.getItem("card-match-sets")).toBeNull();
	});

	it("no-ops on empty data", () => {
		state.currentSetId = "set-1";
		saveCurrentGame();
		expect(localStorage.getItem("card-match-set-set-1")).toBeNull();
	});

	it("writes a snapshot, meta index and last-set id", () => {
		createSet("Set 1");
		fillState();
		saveCurrentGame();

		const id = state.currentSetId as string;
		const saved = loadSet(id);
		expect(saved).not.toBeNull();
		expect(saved?.k).toBe(7);
		expect(saved?.roundIndex).toBe(1);
		expect(saved?.dataRows).toEqual([
			["a1", "b1"],
			["a2", "b2"],
		]);
		expect(saved?.cards.map((c) => c.cardId)).toEqual(["c1", "c2"]);
		expect(saved?.groups).toHaveLength(1);

		expect(localStorage.getItem("card-match-last-set")).toBe(id);
		const meta = getSetMeta(id);
		expect(meta?.name).toBe("Set 1");
		expect(meta?.rowCount).toBe(2);
		expect(meta?.colCount).toBe(2);
	});
});

describe("migrateLegacy", () => {
	it("moves the legacy single-key save into a set named 'My first set'", () => {
		localStorage.setItem(
			"card-match-game",
			JSON.stringify({ dataRows: [["x", "y"]], maxCols: 2, k: 5 }),
		);

		const sets = listSets();
		expect(sets).toHaveLength(1);
		expect(sets[0].name).toBe("My first set");
		expect(sets[0].rowCount).toBe(1);
		expect(localStorage.getItem("card-match-game")).toBeNull();
		expect(loadSet(sets[0].id)?.dataRows).toEqual([["x", "y"]]);
	});

	it("runs only once — the legacy key is removed after migration", () => {
		localStorage.setItem(
			"card-match-game",
			JSON.stringify({ dataRows: [["x"]], maxCols: 1, k: 5 }),
		);
		listSets();
		localStorage.removeItem("card-match-set-x-does-not-exist");
		expect(listSets()).toHaveLength(1);
		expect(localStorage.getItem("card-match-game")).toBeNull();
	});
});

describe("loadLastGame", () => {
	it("prefers the last-opened set", () => {
		createSet("A");
		const aId = state.currentSetId as string;
		fillState();
		saveCurrentGame();

		createSet("B");
		localStorage.setItem("card-match-last-set", aId);

		const loaded = loadLastGame();
		expect(loaded?.meta.id).toBe(aId);
		expect(loaded?.meta.name).toBe("A");
	});

	it("returns null when there are no sets", () => {
		expect(loadLastGame()).toBeNull();
	});
});

describe("deleteSet", () => {
	it("removes the snapshot and the meta entry", () => {
		createSet("Set 1");
		fillState();
		saveCurrentGame();
		const id = state.currentSetId as string;

		deleteSet(id);
		expect(loadSet(id)).toBeNull();
		expect(getSetMeta(id)).toBeUndefined();
		expect(listSets()).toHaveLength(0);
	});
});

describe("serializeSet / importSet", () => {
	it("round-trips an export into a new set with a fresh id", () => {
		createSet("Original");
		fillState();
		saveCurrentGame();
		const originalId = state.currentSetId as string;

		const json = serializeSet(originalId);
		expect(json).not.toBeNull();

		const imported = importSet(json as string);
		expect(imported).not.toBeNull();
		expect(imported?.id).not.toBe(originalId);
		expect(imported?.name).toBe("Original");
		expect(imported?.rowCount).toBe(2);

		const reloaded = loadSet(imported?.id as string);
		expect(reloaded?.dataRows).toEqual([
			["a1", "b1"],
			["a2", "b2"],
		]);
		expect(reloaded?.k).toBe(7);
	});

	it("rejects broken or empty payloads", () => {
		expect(importSet("not json")).toBeNull();
		expect(importSet("{}")).toBeNull();
		expect(
			importSet(
				JSON.stringify({ version: 1, name: "X", game: { dataRows: [] } }),
			),
		).toBeNull();
		expect(
			importSet(
				JSON.stringify({
					version: 1,
					name: "X",
					game: { dataRows: [["a"]], k: 5 },
				}),
			),
		).toBeNull();
	});

	it("falls back to 'Imported set' when the name is blank", () => {
		const meta = importSet(
			JSON.stringify({
				version: 1,
				name: "   ",
				game: {
					dataRows: [["a", "b"]],
					maxCols: 2,
					selectedCols: [0, 1],
					k: 5,
					cards: [],
					groups: [],
				},
			}),
		);
		expect(meta?.name).toBe("Imported set");
	});
});

describe("k preference", () => {
	it("round-trips a saved value", () => {
		expect(loadKPref()).toBeNull();
		saveKPref(42);
		expect(loadKPref()).toBe(42);
	});

	it("clamps out-of-range values on load", () => {
		localStorage.setItem("card-match-k-pref", "999");
		expect(loadKPref()).toBe(200);
		localStorage.setItem("card-match-k-pref", "0");
		expect(loadKPref()).toBe(1);
		localStorage.setItem("card-match-k-pref", "abc");
		expect(loadKPref()).toBeNull();
	});
});
