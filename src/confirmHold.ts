interface HoldCallbacks {
	onChange?: (holding: boolean, fraction: number) => void;
	onComplete?: () => void;
}

export function attachHoldConfirm(
	el: HTMLElement,
	durationMs: number,
	{ onChange, onComplete }: HoldCallbacks,
): void {
	let startTime = 0;
	let raf = 0;
	let holding = false;
	let done = false;

	function cancel(): void {
		if (!holding) return;
		holding = false;
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
		onChange?.(false, 0);
	}

	function tick(now: number): void {
		if (!holding || done) return;
		const fraction = Math.min(1, (now - startTime) / durationMs);
		onChange?.(true, fraction);
		if (fraction >= 1) {
			done = true;
			onComplete?.();
			return;
		}
		raf = requestAnimationFrame(tick);
	}

	function begin(e: PointerEvent): void {
		if (e.button !== 0 && e.pointerType === "mouse") return;
		holding = true;
		done = false;
		startTime = performance.now();
		if (raf) cancelAnimationFrame(raf);
		raf = requestAnimationFrame(tick);
	}

	el.addEventListener("pointerdown", begin);
	el.addEventListener("pointerup", cancel);
	el.addEventListener("pointercancel", cancel);
	el.addEventListener("pointerleave", cancel);
}
