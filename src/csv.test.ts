import { describe, expect, it } from "vitest";
import { toRows } from "./state";

describe("toRows", () => {
	it("returns an empty array for non-array input", () => {
		expect(toRows(null)).toEqual([]);
		expect(toRows("nope")).toEqual([]);
		expect(toRows(undefined)).toEqual([]);
	});

	it("drops rows that are not arrays", () => {
		expect(toRows(["bad", ["a", "b"], 42])).toEqual([["a", "b"]]);
	});

	it("converts every cell through String, mapping null/undefined to ''", () => {
		expect(toRows([[1, null, "x", undefined]])).toEqual([["1", "", "x", ""]]);
	});

	it("keeps an empty result when nothing survives filtering", () => {
		expect(toRows([null, "str"])).toEqual([]);
	});
});
