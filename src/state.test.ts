import { describe, expect, it } from "vitest";
import { clampInt, escapeHtml, normalizeText } from "./state";

describe("clampInt", () => {
	it("parses and passes through valid values", () => {
		expect(clampInt("15", 1, 200)).toBe(15);
	});

	it("falls back to min on garbage", () => {
		expect(clampInt("abc", 1, 200)).toBe(1);
		expect(clampInt("", 1, 200)).toBe(1);
	});

	it("clamps below min and above max", () => {
		expect(clampInt("0", 1, 200)).toBe(1);
		expect(clampInt("-5", 1, 200)).toBe(1);
		expect(clampInt("999", 1, 200)).toBe(200);
	});
});

describe("normalizeText", () => {
	it("trims and lowercases", () => {
		expect(normalizeText("  Hello World ")).toBe("hello world");
	});

	it("maps null/undefined to an empty string", () => {
		expect(normalizeText(null)).toBe("");
		expect(normalizeText(undefined)).toBe("");
	});
});

describe("escapeHtml", () => {
	it("escapes all HTML-significant characters", () => {
		expect(escapeHtml(`<img src=x onerror="alert('&')">`)).toBe(
			"&lt;img src=x onerror=&quot;alert(&#039;&amp;&#039;)&quot;&gt;",
		);
	});

	it("leaves plain text untouched", () => {
		expect(escapeHtml("plain text 123")).toBe("plain text 123");
	});
});
