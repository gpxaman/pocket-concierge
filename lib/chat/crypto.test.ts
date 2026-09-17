import { describe, expect, it } from "vitest";
import { decryptMessage, deriveSharedKey, encryptMessage, generateIdentityKeyPair, USERNAME_PATTERN } from "@/lib/chat/crypto";

describe("E2E encryption round trip", () => {
  it("lets two real keypairs derive the same shared key and decrypt each other's messages", async () => {
    const alice = await generateIdentityKeyPair();
    const bob = await generateIdentityKeyPair();

    const aliceSharedKey = await deriveSharedKey(alice.privateKeyJwk, bob.publicKeyJwk);
    const bobSharedKey = await deriveSharedKey(bob.privateKeyJwk, alice.publicKeyJwk);

    const envelope = await encryptMessage(aliceSharedKey, "hello bob, this is alice");
    const decrypted = await decryptMessage(bobSharedKey, envelope);

    expect(decrypted).toBe("hello bob, this is alice");
  });

  it("produces ciphertext that a third party's key cannot decrypt", async () => {
    const alice = await generateIdentityKeyPair();
    const bob = await generateIdentityKeyPair();
    const eve = await generateIdentityKeyPair();

    const aliceSharedKey = await deriveSharedKey(alice.privateKeyJwk, bob.publicKeyJwk);
    const eveSharedKey = await deriveSharedKey(eve.privateKeyJwk, bob.publicKeyJwk);

    const envelope = await encryptMessage(aliceSharedKey, "secret");
    await expect(decryptMessage(eveSharedKey, envelope)).rejects.toThrow();
  });

  it("round-trips a large (image-sized) payload without hitting an argument-count limit", async () => {
    const alice = await generateIdentityKeyPair();
    const bob = await generateIdentityKeyPair();
    const sharedKey = await deriveSharedKey(alice.privateKeyJwk, bob.publicKeyJwk);

    const largePayload = "x".repeat(500_000); // ~500KB, well past the 0x8000-byte chunk size
    const envelope = await encryptMessage(sharedKey, largePayload);
    const decrypted = await decryptMessage(sharedKey, envelope);

    expect(decrypted).toBe(largePayload);
  });
});

describe("USERNAME_PATTERN", () => {
  it("accepts 3-20 alphanumeric/underscore characters", () => {
    expect(USERNAME_PATTERN.test("abc")).toBe(true);
    expect(USERNAME_PATTERN.test("valid_user_123")).toBe(true);
  });

  it("rejects too short, too long, or invalid characters", () => {
    expect(USERNAME_PATTERN.test("ab")).toBe(false);
    expect(USERNAME_PATTERN.test("a".repeat(21))).toBe(false);
    expect(USERNAME_PATTERN.test("has space")).toBe(false);
    expect(USERNAME_PATTERN.test("has-dash")).toBe(false);
  });
});
