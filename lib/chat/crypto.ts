// End-to-end encryption for direct messages: ECDH (P-256) key agreement +
// AES-GCM. The relay server (server/chat-relay.mjs) only ever sees the
// output of `encryptMessage` — ciphertext + iv, tagged with sender/recipient
// ids. It cannot decrypt anything; only the two devices holding the matching
// ECDH keypairs can derive the shared AES key.
//
// Demo-scope caveat: private keys are exported and persisted as JWK in
// localStorage (see useChatStore) so identity survives a reload, same as
// everything else in this app. A hardened build would keep the private key
// non-extractable and back it with the platform keystore (TRD §22.1 "secure
// secret management") instead.

const CURVE = "P-256";

export interface KeyPairJwk {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

export async function generateIdentityKeyPair(): Promise<KeyPairJwk> {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: CURVE }, true, ["deriveKey"]);
  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    crypto.subtle.exportKey("jwk", pair.publicKey),
    crypto.subtle.exportKey("jwk", pair.privateKey),
  ]);
  return { publicKeyJwk, privateKeyJwk };
}

// A separate ECDSA keypair (WebCrypto won't let one CryptoKey object do both
// ECDH and ECDSA, even on the same curve/same underlying scalar) used only
// to prove identity to the relay: connecting and claiming to be id X used to
// require no proof at all — the relay just believed whichever socket said
// so, which let anyone who learned/guessed an id hijack that live
// connection (steal their incoming queue, overwrite their username
// directory entry with a different public key, end their calls, etc). Now
// the relay challenges every connection with a nonce, and the client must
// sign it with this key to be trusted as that id — see the "challenge"/
// "hello" exchange in connectionSlice.ts's connect() and the matching
// verification in server/chat-relay.mjs.
export interface SigningKeyPairJwk {
  signingPublicKeyJwk: JsonWebKey;
  signingPrivateKeyJwk: JsonWebKey;
}

export async function generateSigningKeyPair(): Promise<SigningKeyPairJwk> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: CURVE }, true, ["sign", "verify"]);
  const [signingPublicKeyJwk, signingPrivateKeyJwk] = await Promise.all([
    crypto.subtle.exportKey("jwk", pair.publicKey),
    crypto.subtle.exportKey("jwk", pair.privateKey),
  ]);
  return { signingPublicKeyJwk, signingPrivateKeyJwk };
}

/** Signs the relay's connection challenge nonce, proving control of the identity's signing key. */
export async function signChallenge(signingPrivateKeyJwk: JsonWebKey, nonce: string): Promise<string> {
  const key = await crypto.subtle.importKey("jwk", signingPrivateKeyJwk, { name: "ECDSA", namedCurve: CURVE }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(nonce));
  return bufToBase64(sig);
}

async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: CURVE }, true, ["deriveKey"]);
}

async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: CURVE }, true, []);
}

/** Derives the shared AES-GCM key for a conversation with one contact. Same
 * result on both sides — that's the whole point of ECDH. */
export async function deriveSharedKey(ownPrivateKeyJwk: JsonWebKey, contactPublicKeyJwk: JsonWebKey): Promise<CryptoKey> {
  const [privateKey, publicKey] = await Promise.all([
    importPrivateKey(ownPrivateKeyJwk),
    importPublicKey(contactPublicKeyJwk),
  ]);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export interface Envelope {
  iv: string; // base64
  ciphertext: string; // base64
}

function bufToBase64(buf: ArrayBuffer): string {
  // Spreading the whole byte array into String.fromCharCode's arguments is
  // fine for short text messages, but an image payload (a few hundred KB)
  // blows past the JS engine's function-argument-count ceiling and throws —
  // chunk it so this works for any payload size.
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
function base64ToBuf(b64: string): ArrayBuffer {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}

export async function encryptMessage(sharedKey: CryptoKey, plaintext: string): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, encoded);
  return { iv: bufToBase64(iv.buffer), ciphertext: bufToBase64(ciphertext) };
}

export async function decryptMessage(sharedKey: CryptoKey, envelope: Envelope): Promise<string> {
  const iv = new Uint8Array(base64ToBuf(envelope.iv));
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedKey, base64ToBuf(envelope.ciphertext));
  return new TextDecoder().decode(plainBuf);
}

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
