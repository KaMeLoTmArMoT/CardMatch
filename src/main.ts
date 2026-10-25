import "@material/web/all.js";
import { styles as typescaleStyles } from "@material/web/typography/md-typescale-styles.js";

import "./styles.css";

import { attachHoldConfirm } from "./confirmHold";
import {
	closeImport,
	openImport,
	parseFullAndApply,
	parsePreview,
	setImportedFile,
} from "./csv";
import {
	addEditorColumn,
	addEditorRow,
	backFromEditor,
	commitEditor,
} from "./editor";
import { els } from "./els";
import {
	goNext,
	goPrev,
	hydrateGame,
	refreshEmptyState,
	shuffleUnsolved,
	startRound,
	updateRoundInfo,
} from "./game";
import {
	closeAiDialog,
	generateCardsWithMistral,
	handlePresetClick,
	openAiDialog,
	unlockSavedKey,
} from "./mistral";
import { loadKPref, loadLastGame, saveKPref } from "./persist";
import {
	clearCurrentSet,
	handleEmptySetChipClick,
	handleSetsListClick,
	initialSetsCardState,
	openSetsDialog,
	startNewSet,
} from "./sets";
import { state } from "./state";

if (typescaleStyles.styleSheet) {
	document.adoptedStyleSheets.push(typescaleStyles.styleSheet);
}

if (navigator.storage?.persist) {
	navigator.storage.persist().catch(() => {});
}

interface MdDialogLike extends HTMLElement {
	nextClickIsFromContent?: boolean;
}

document.querySelectorAll("md-dialog").forEach((dialog) => {
	const md = dialog as unknown as MdDialogLike;
	md.addEventListener(
		"pointerdown",
		(e) => {
			const container = md.shadowRoot?.querySelector(".container");
			md.nextClickIsFromContent = Boolean(
				container && e.composedPath().includes(container),
			);
		},
		true,
	);
});

els.btnOpenImport.addEventListener("click", (e) => {
	e.preventDefault();
	openImport();
});
els.emptyImportCard.addEventListener("click", (e) => {
	e.preventDefault();
	openImport();
});
els.emptyAiCard.addEventListener("click", (e) => {
	e.preventDefault();
	openAiDialog();
});
els.btnSets.addEventListener("click", (e) => {
	e.preventDefault();
	openSetsDialog();
});
els.btnNewSet.addEventListener("click", (e) => {
	e.preventDefault();
	startNewSet();
});
els.btnCloseSets.addEventListener("click", (e) => {
	e.preventDefault();
	els.setsDialog.open = false;
});
els.emptySetsList.addEventListener("click", (e) => {
	const target = e.target as HTMLElement;
	const chip = target.closest<HTMLElement>(".emptySetChip");
	if (chip?.dataset.setId) handleEmptySetChipClick(chip.dataset.setId);
});
els.setsList.addEventListener("click", (e) => {
	handleSetsListClick(e.target as HTMLElement);
});

const clearLabel = els.btnClear.querySelector<HTMLElement>(".clearLabel");
const clearFill = els.btnClear.querySelector<HTMLElement>(".clearFill");
attachHoldConfirm(els.btnClear, 3000, {
	onChange: (holding, fraction) => {
		if (clearFill) clearFill.style.width = `${fraction * 100}%`;
		if (clearLabel) {
			clearLabel.textContent = holding
				? fraction >= 1
					? "Clearing…"
					: "Keep holding…"
				: "🗑 Clear";
		}
	},
	onComplete: () => {
		clearCurrentSet();
		if (clearFill) clearFill.style.width = "";
		if (clearLabel) clearLabel.textContent = "🗑 Clear";
	},
});
els.btnCloseImport.addEventListener("click", (e) => {
	e.preventDefault();
	closeImport();
});

els.fileInput.addEventListener("change", () => {
	state.file = els.fileInput.files?.[0] || null;
	els.btnApplyImport.disabled = !state.file;
	parsePreview();
});
els.delimiterSelect.addEventListener("change", parsePreview);
els.hasHeader.addEventListener("change", parsePreview);
els.encodingSelect.addEventListener("change", parsePreview);

els.btnApplyImport.addEventListener("click", (e) => {
	e.preventDefault();
	parseFullAndApply();
});

els.rowsPerRound.addEventListener("input", () => {
	updateRoundInfo();
	saveKPref(state.k);
	if (state.dataRows.length > 0) startRound();
});
els.btnStart.addEventListener("click", (e) => {
	e.preventDefault();
	startRound();
});
els.btnPrev.addEventListener("click", (e) => {
	e.preventDefault();
	goPrev();
});
els.btnNext.addEventListener("click", (e) => {
	e.preventDefault();
	goNext();
});
els.btnShuffle.addEventListener("click", (e) => {
	e.preventDefault();
	shuffleUnsolved();
});

function wireDropzone(zone: HTMLElement): void {
	zone.addEventListener("click", (e) => {
		e.preventDefault();
		els.fileInput.click();
	});

	["dragenter", "dragover", "dragleave", "drop"].forEach((evtName) => {
		zone.addEventListener(evtName, (ev) => {
			ev.preventDefault();
			ev.stopPropagation();
		});
	});

	["dragenter", "dragover"].forEach((evtName) => {
		zone.addEventListener(evtName, () => zone.classList.add("over"));
	});

	["dragleave", "drop"].forEach((evtName) => {
		zone.addEventListener(evtName, () => zone.classList.remove("over"));
	});

	zone.addEventListener("drop", (ev) => {
		const file = ev.dataTransfer?.files?.[0];
		if (file) setImportedFile(file);
	});
}

wireDropzone(els.dropzone);
wireDropzone(els.emptyDropzone);

if (window.matchMedia("(max-width: 900px)").matches) {
	els.rowsPerRound.value = "5";
}

els.btnOpenAi.addEventListener("click", (e) => {
	e.preventDefault();
	openAiDialog();
});
els.btnCloseAi.addEventListener("click", (e) => {
	e.preventDefault();
	closeAiDialog();
});
els.btnUnlockKey.addEventListener("click", (e) => {
	e.preventDefault();
	unlockSavedKey();
});
els.btnGenerateAi.addEventListener("click", generateCardsWithMistral);
els.presetChips.addEventListener("click", handlePresetClick);

els.btnAddRow.addEventListener("click", (e) => {
	e.preventDefault();
	addEditorRow();
});
els.btnAddCol.addEventListener("click", (e) => {
	e.preventDefault();
	addEditorColumn();
});
els.btnStartEditor.addEventListener("click", (e) => {
	e.preventDefault();
	commitEditor();
});
els.btnBackEditor.addEventListener("click", (e) => {
	e.preventDefault();
	backFromEditor();
});
els.btnRegenerateEditor.addEventListener("click", (e) => {
	e.preventDefault();
	backFromEditor();
});

const loaded = loadLastGame();
if (loaded) {
	state.currentSetId = loaded.meta.id;
	state.currentSetName = loaded.meta.name;
	state.pendingNewSet = false;
	hydrateGame(loaded.game);
} else {
	const kPref = loadKPref();
	if (kPref) els.rowsPerRound.value = String(kPref);
	updateRoundInfo();
	refreshEmptyState();
}
initialSetsCardState();
