import { attachHoldConfirm } from "./confirmHold";
import { enableSetupButtons } from "./csv";
import { els } from "./els";
import {
	hydrateGame,
	refreshEmptyState,
	renderColumnsSelector,
	resetBoardUI,
	updateRoundInfo,
} from "./game";
import {
	deleteSet,
	getSetMeta,
	listSets,
	loadSet,
	renameSet,
	type SetMeta,
} from "./persist";
import { state } from "./state";

function resetToEmpty(): void {
	state.file = null;
	state.headerRow = null;
	state.dataRows = [];
	state.maxCols = 0;
	state.rawRows = [];
	state.selectedCols = [];
	state.roundIndex = 0;

	resetBoardUI();
	renderColumnsSelector();
	updateRoundInfo();
	enableSetupButtons();
	refreshEmptyState();
	renderSetsCard();
	updateClearState();
}

function updateClearState(): void {
	els.btnClear.disabled = !state.currentSetId;
}

export function clearCurrentSet(): void {
	if (!state.currentSetId) return;
	deleteSet(state.currentSetId);
	state.pendingNewSet = false;
	resetToEmpty();
}

export function openSetById(id: string): void {
	const game = loadSet(id);
	if (!game) return;
	const meta = getSetMeta(id);
	state.currentSetId = id;
	state.currentSetName = meta?.name ?? "Set";
	state.pendingNewSet = false;
	els.rowsPerRound.value = String(game.k);
	hydrateGame(game);
	els.setsDialog.open = false;
}

export function deleteSetById(id: string): void {
	deleteSet(id);
	if (state.currentSetId === id) {
		state.pendingNewSet = false;
		resetToEmpty();
		renderSetList();
	} else {
		renderSetList();
		renderSetsCard();
	}
}

export function renameSetById(id: string): void {
	const meta = getSetMeta(id);
	if (!meta) return;
	const name = window.prompt("Rename set:", meta.name);
	if (name === null || name.trim() === "") return;
	renameSet(id, name);
	renderSetList();
	renderSetsCard();
	if (state.currentSetId === id) updateClearState();
}

export function startNewSet(): void {
	state.pendingNewSet = true;
	state.currentSetName = null;
	resetToEmpty();
	els.setsDialog.open = false;
}

function formatDate(ts: number): string {
	return new Date(ts).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function renderSetsCard(): void {
	const sets = listSets();
	els.emptySetsBlock.hidden = sets.length === 0;
	els.emptySetsList.innerHTML = "";

	for (const meta of sets) {
		const chip = document.createElement("button");
		chip.type = "button";
		chip.className = "emptySetChip";
		chip.textContent = meta.name;
		chip.dataset.setId = meta.id;
		els.emptySetsList.appendChild(chip);
	}
}

export function renderSetList(): void {
	const sets = listSets();
	els.setsList.innerHTML = "";

	if (sets.length === 0) {
		els.setsList.textContent = "No saved sets yet.";
		els.setsList.classList.add("muted");
		return;
	}
	els.setsList.classList.remove("muted");

	for (const meta of sets) {
		const item = document.createElement("div");
		item.className = "setItem";

		const info = document.createElement("div");
		info.className = "setInfo";

		const name = document.createElement("div");
		name.className = "setName";
		name.textContent = meta.name;

		const metaLine = document.createElement("div");
		metaLine.className = "setMeta muted";
		metaLine.textContent = `${meta.rowCount} rows × ${meta.colCount} cols · ${formatDate(meta.updatedAt)}`;

		info.appendChild(name);
		info.appendChild(metaLine);

		const actions = document.createElement("div");
		actions.className = "setActions";

		const open = document.createElement("button");
		open.type = "button";
		open.className = "setAction primary";
		open.textContent = "Open";
		open.dataset.setId = meta.id;
		open.dataset.action = "open";

		const rename = document.createElement("button");
		rename.type = "button";
		rename.className = "setAction";
		rename.textContent = "Rename";
		rename.dataset.setId = meta.id;
		rename.dataset.action = "rename";

		const del = document.createElement("button");
		del.type = "button";
		del.className = "setAction delete";
		del.dataset.setId = meta.id;
		del.dataset.action = "delete";
		const delFill = document.createElement("span");
		delFill.className = "holdFill";
		const delLabel = document.createElement("span");
		delLabel.className = "holdLabel";
		delLabel.textContent = "Delete";
		del.appendChild(delFill);
		del.appendChild(delLabel);

		actions.appendChild(open);
		actions.appendChild(rename);
		actions.appendChild(del);

		item.appendChild(info);
		item.appendChild(actions);
		els.setsList.appendChild(item);

		if (del.dataset.action === "delete") {
			attachDeleteHold(del, meta);
		}
	}
}

function attachDeleteHold(el: HTMLElement, meta: SetMeta): void {
	const label = el.querySelector<HTMLElement>(".holdLabel");
	const fill = el.querySelector<HTMLElement>(".holdFill");

	attachHoldConfirm(el, 3000, {
		onChange: (holding, fraction) => {
			if (fill) fill.style.width = `${fraction * 100}%`;
			if (label) {
				label.textContent = holding
					? fraction >= 1
						? "Deleting…"
						: "Keep holding…"
					: "Delete";
			}
		},
		onComplete: () => {
			deleteSetById(meta.id);
			if (fill) fill.style.width = "";
		},
	});
}

export function openSetsDialog(): void {
	renderSetList();
	els.setsDialog.open = true;
}

export function handleEmptySetChipClick(id: string): void {
	openSetById(id);
}

export function handleSetsListClick(target: HTMLElement): void {
	const btn = target.closest<HTMLElement>(".setAction");
	if (!btn) return;
	const id = btn.dataset.setId;
	if (!id) return;
	const action = btn.dataset.action;
	if (action === "open") openSetById(id);
	else if (action === "rename") renameSetById(id);
}

export function initialSetsCardState(): void {
	renderSetsCard();
	updateClearState();
}
