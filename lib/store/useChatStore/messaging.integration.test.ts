import { beforeEach, describe, expect, it } from "vitest";
import { useChatStore } from "@/lib/store/useChatStore";
import { handleIncoming } from "./internal";
import { transport } from "./transport";
import { deriveSharedKey, encryptMessage, generateIdentityKeyPair, generateSigningKeyPair } from "@/lib/chat/crypto";

// Simulates a real relay delivery landing on "my" client: a genuine ECDH
// keypair on each side, a message encrypted the way a real peer's
// attemptDeliver() would, handed to handleIncoming() — the exact function
// the connection slice's onmessage router calls for a `type: "message"`
// frame. This is the seam most likely to silently break if the useChatStore
// slice split ever stopped sharing crypto.ts's real key material correctly.
describe("useChatStore incoming message integration", () => {
  beforeEach(() => {
    useChatStore.setState({ identity: null, contacts: [], messagesByContact: {}, unreadByContact: {} });
    // getSharedKey caches by contact id (see internal.ts) — a fresh keypair
    // generated per test would otherwise silently decrypt against a stale
    // cached key from a previous test that reused the same contact id.
    transport.sharedKeyCache.clear();
  });

  it("decrypts an incoming message from a known contact and increments its unread count", async () => {
    const me = await generateIdentityKeyPair();
    const bob = await generateIdentityKeyPair();
    const meSigning = await generateSigningKeyPair();

    useChatStore.setState({
      identity: {
        id: "me-id",
        privateKeyJwk: me.privateKeyJwk,
        publicKeyJwk: me.publicKeyJwk,
        signingPublicKeyJwk: meSigning.signingPublicKeyJwk,
        signingPrivateKeyJwk: meSigning.signingPrivateKeyJwk,
        username: "me_user",
      },
    });
    const bobContact = { id: "contact-bob", username: "bob", publicKeyJwk: bob.publicKeyJwk, addedAt: Date.now() };
    useChatStore.setState({ contacts: [bobContact] });

    // What bob's own client would compute and send over the relay.
    const bobSharedKey = await deriveSharedKey(bob.privateKeyJwk, me.publicKeyJwk);
    const envelope = await encryptMessage(bobSharedKey, JSON.stringify({ text: "hey, are we still on for 6pm?" }));

    await handleIncoming(useChatStore.setState, useChatStore.getState, bobContact.id, envelope, "msg-1", Date.now());

    const messages = useChatStore.getState().messagesByContact[bobContact.id];
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ direction: "in", text: "hey, are we still on for 6pm?", status: "received" });
    expect(useChatStore.getState().unreadByContact[bobContact.id]).toBe(1);
  });

  it("accumulates unread count across multiple incoming messages", async () => {
    const me = await generateIdentityKeyPair();
    const bob = await generateIdentityKeyPair();
    const meSigning = await generateSigningKeyPair();
    useChatStore.setState({
      identity: {
        id: "me-id",
        privateKeyJwk: me.privateKeyJwk,
        publicKeyJwk: me.publicKeyJwk,
        signingPublicKeyJwk: meSigning.signingPublicKeyJwk,
        signingPrivateKeyJwk: meSigning.signingPrivateKeyJwk,
        username: "me_user",
      },
    });
    const bobContact = { id: "contact-bob", username: "bob", publicKeyJwk: bob.publicKeyJwk, addedAt: Date.now() };
    useChatStore.setState({ contacts: [bobContact] });
    const bobSharedKey = await deriveSharedKey(bob.privateKeyJwk, me.publicKeyJwk);

    for (const [i, text] of ["first", "second", "third"].entries()) {
      const envelope = await encryptMessage(bobSharedKey, JSON.stringify({ text }));
      await handleIncoming(useChatStore.setState, useChatStore.getState, bobContact.id, envelope, `msg-${i}`, Date.now());
    }

    expect(useChatStore.getState().unreadByContact[bobContact.id]).toBe(3);
    expect(useChatStore.getState().messagesByContact[bobContact.id].map((m) => m.text)).toEqual(["first", "second", "third"]);
  });

  it("silently drops a message from an unknown contact (no public key on file to decrypt it)", async () => {
    const stranger = await generateIdentityKeyPair();
    const sharedKeyStranger = await deriveSharedKey(stranger.privateKeyJwk, stranger.publicKeyJwk);
    const envelope = await encryptMessage(sharedKeyStranger, JSON.stringify({ text: "spoofed" }));

    await handleIncoming(useChatStore.setState, useChatStore.getState, "unknown-contact-id", envelope, "msg-x", Date.now());

    expect(useChatStore.getState().messagesByContact["unknown-contact-id"]).toBeUndefined();
  });
});
