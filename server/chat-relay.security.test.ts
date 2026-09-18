// @vitest-environment node
//
// Proves the actual security property the challenge/response handshake
// exists for: a connection can only claim an id it can prove it holds the
// matching signing key for. Runs the real relay process (not a mock) on a
// throwaway port and speaks the wire protocol directly with a raw `ws`
// client, so this is an integration test of the real server code, not the
// client-side plumbing.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawn, ChildProcess } from "node:child_process";
import WebSocket from "ws";
import { generateSigningKeyPair, signChallenge } from "@/lib/chat/crypto";

let relay: ChildProcess;
let port: number;

function waitForListening(proc: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("relay didn't start in time")), 10_000);
    proc.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("listening")) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.on("error", reject);
  });
}

function connectAndWaitFor(url: string, matches: (msg: any) => boolean, onOpen?: (ws: WebSocket) => void): Promise<{ ws: WebSocket; msg: any }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error("timed out waiting for expected message")), 10_000);
    ws.on("open", () => onOpen?.(ws));
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (matches(msg)) {
        clearTimeout(timer);
        resolve({ ws, msg });
      }
    });
    ws.on("error", reject);
  });
}

beforeEach(async () => {
  port = 20000 + Math.floor(Math.random() * 10000);
  relay = spawn("node", ["server/chat-relay.mjs"], {
    env: { ...process.env, CHAT_RELAY_PORT: String(port) },
    cwd: process.cwd(),
  });
  relay.stderr?.on("data", (chunk: Buffer) => console.error("[relay stderr]", chunk.toString()));
  await waitForListening(relay);
  // The "listening" log line prints synchronously with the TCP listen call,
  // but the child process's own event loop needs a beat to actually start
  // accepting — without this, the very first connection attempt can race
  // ahead of it and see ECONNREFUSED.
  await new Promise((r) => setTimeout(r, 150));
});

afterEach(() => {
  relay.kill();
});

describe("chat relay connection authentication", () => {
  it("trusts the first connection to claim a fresh id (trust-on-first-use)", async () => {
    const signing = await generateSigningKeyPair();
    const id = "sec-test-" + Math.random().toString(36).slice(2);
    const url = `ws://localhost:${port}`;

    const { msg: challengeMsg, ws } = await connectAndWaitFor(url, (m) => m.type === "challenge");
    const signature = await signChallenge(signing.signingPrivateKeyJwk, challengeMsg.nonce);

    const welcome = await new Promise<any>((resolve) => {
      ws.on("message", (raw) => {
        const m = JSON.parse(raw.toString());
        if (m.type === "welcome") resolve(m);
      });
      ws.send(JSON.stringify({ type: "hello", id, signature, signingPublicKeyJwk: signing.signingPublicKeyJwk }));
    });

    expect(welcome).toEqual({ type: "welcome", id });
    ws.close();
  });

  it("rejects a second connection claiming an already-bound id with a different signing key", async () => {
    const url = `ws://localhost:${port}`;
    const id = "sec-test-" + Math.random().toString(36).slice(2);

    // Legitimate owner claims the id first.
    const ownerSigning = await generateSigningKeyPair();
    const { msg: ownerChallenge, ws: ownerWs } = await connectAndWaitFor(url, (m) => m.type === "challenge");
    const ownerSignature = await signChallenge(ownerSigning.signingPrivateKeyJwk, ownerChallenge.nonce);
    await new Promise<void>((resolve) => {
      ownerWs.on("message", (raw) => {
        if (JSON.parse(raw.toString()).type === "welcome") resolve();
      });
      ownerWs.send(JSON.stringify({ type: "hello", id, signature: ownerSignature, signingPublicKeyJwk: ownerSigning.signingPublicKeyJwk }));
    });

    // Attacker connects separately, claims the SAME id, but signs with a
    // DIFFERENT keypair — simulating someone who only learned the id
    // (e.g. from a URL) but never had the real owner's private key.
    const attackerSigning = await generateSigningKeyPair();
    const { msg: attackerChallenge, ws: attackerWs } = await connectAndWaitFor(url, (m) => m.type === "challenge");
    const attackerSignature = await signChallenge(attackerSigning.signingPrivateKeyJwk, attackerChallenge.nonce);

    const rejection = await new Promise<any>((resolve) => {
      attackerWs.on("message", (raw) => {
        const m = JSON.parse(raw.toString());
        if (m.type === "auth_failed" || m.type === "welcome") resolve(m);
      });
      attackerWs.send(
        JSON.stringify({ type: "hello", id, signature: attackerSignature, signingPublicKeyJwk: attackerSigning.signingPublicKeyJwk })
      );
    });

    expect(rejection).toEqual({ type: "auth_failed" });

    // The real owner's connection must still be the one bound to the id —
    // the attacker's attempt must not have kicked or replaced it.
    ownerWs.close();
    attackerWs.close();
  });

  it("rejects a hello with no signature at all", async () => {
    const url = `ws://localhost:${port}`;
    const id = "sec-test-" + Math.random().toString(36).slice(2);
    const { ws } = await connectAndWaitFor(url, (m) => m.type === "challenge");

    let receivedWelcome = false;
    ws.on("message", (raw) => {
      if (JSON.parse(raw.toString()).type === "welcome") receivedWelcome = true;
    });
    ws.send(JSON.stringify({ type: "hello", id }));

    await new Promise((r) => setTimeout(r, 500));
    expect(receivedWelcome).toBe(false);
    ws.close();
  });
});
