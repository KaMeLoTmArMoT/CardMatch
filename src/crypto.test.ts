import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptApiKey, encryptApiKey } from "./crypto";

// crypto.ts addresses WebCrypto through window.crypto; in Node the same
// implementation lives on globalThis.crypto.
beforeEach(() => {
	vi.stubGlobal("window", { crypto: globalThis.crypto });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("encryptApiKey / decryptApiKey", () => {
	it("round-trips the key with the same passphrase", async () => {
		const encrypted = await encryptApiKey("sk-test-123", "hunter2");
		const decrypted = await decryptApiKey(encrypted, "hunter2");
		expect(decrypted).toBe("sk-test-123");
	});

	it("produces a bundle with salt(16), iv(12) and ciphertext", async () => {
		const bundle = JSON.parse(await encryptApiKey("key", "pw")) as {
			salt: number[];
			iv: number[];
			ciphertext: number[];
		};
		expect(bundle.salt).toHaveLength(16);
		expect(bundle.iv).toHaveLength(12);
		expect(bundle.ciphertext.length).toBeGreaterThan(0);
	});

	it("yields different ciphertexts for the same input (random salt/iv)", async () => {
		const a = await encryptApiKey("key", "pw");
		const b = await encryptApiKey("key", "pw");
		expect(a).not.toBe(b);
	});

	it("rejects a wrong passphrase", async () => {
		const encrypted = await encryptApiKey("key", "pw");
		await expect(decryptApiKey(encrypted, "wrong")).rejects.toThrow();
	});
});
