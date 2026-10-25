interface HoldCallbacks {
	onChange?: (holding: boolean, fraction: number) => void;
	onComplete?: () => void;
	// Keyboard fallback: armed via Enter/Space, fires once until confirmed.
	onArm?: () => void;
}

export function attachHoldConfirm(
	el: HTMLElement,
	durationMs: number,
	{ onChange, onComplete, onArm }: HoldCallbacks,
): void {
	let startTime = 0;
	let raf = 0;
	let holding = false;
	let done = false;
	let armed = false;

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
		armed = false;
		startTime = performance.now();
		if (raf) cancelAnimationFrame(raf);
		raf = requestAnimationFrame(tick);
	}

	function disarm(): void {
		if (!armed) return;
		armed = false;
		onChange?.(false, 0);
	}

	el.addEventListener("pointerdown", begin);
	el.addEventListener("pointerup", cancel);
	el.addEventListener("pointercancel", cancel);
	el.addEventListener("pointerleave", cancel);

	el.addEventListener("keydown", (e) => {
		if (e.key !== "Enter" && e.key !== " ") return;
		e.preventDefault();
		if (e.repeat || holding) return;
		if (armed) {
			armed = false;
			done = true;
			onComplete?.();
		} else {
			armed = true;
			done = false;
			if (onArm) onArm();
			else onChange?.(true, 1);
		}
	});
	el.addEventListener("blur", disarm);
}
