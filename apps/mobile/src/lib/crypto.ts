import 'react-native-get-random-values';
import nacl from 'tweetnacl';
import {
  decodeBase64,
  decodeUTF8,
  encodeBase64,
  encodeUTF8,
} from 'tweetnacl-util';

export type KeyPair = {
  publicKey: string;
  secretKey: string;
};

export type IdentityBundle = {
  secureId: string;
  identity: KeyPair;
  signing: KeyPair;
  recoveryPhrase: string;
};

const WORDLIST = [
  'alpha', 'bravo', 'cedar', 'delta', 'echo', 'falcon', 'gamma', 'harbor',
  'iris', 'jade', 'kite', 'lunar', 'maple', 'nova', 'orbit', 'prism',
  'quartz', 'river', 'silver', 'tide', 'umbra', 'violet', 'wave', 'xenon',
  'amber', 'bloom', 'coral', 'drift', 'ember', 'frost', 'grove', 'haze',
];

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateKeyPair(): KeyPair {
  const kp = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey),
  };
}

export function generateSigningKeyPair(): KeyPair {
  const kp = nacl.sign.keyPair();
  return {
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey),
  };
}

export function deriveSecureId(publicKey: string): string {
  const hash = nacl.hash(decodeBase64(publicKey));
  return `smm_${bytesToHex(hash.slice(0, 8))}`;
}

export function generateRecoveryPhrase(wordCount = 12): string {
  const words: string[] = [];
  const random = nacl.randomBytes(wordCount);
  for (let i = 0; i < wordCount; i += 1) {
    words.push(WORDLIST[random[i] % WORDLIST.length]);
  }
  return words.join(' ');
}

export function createIdentity(): IdentityBundle {
  const identity = generateKeyPair();
  const signing = generateSigningKeyPair();
  return {
    secureId: deriveSecureId(identity.publicKey),
    identity,
    signing,
    recoveryPhrase: generateRecoveryPhrase(),
  };
}

export function encryptMessage(
  plaintext: string,
  recipientPublicKey: string,
  senderSecretKey: string,
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const boxed = nacl.box(
    decodeUTF8(plaintext),
    nonce,
    decodeBase64(recipientPublicKey),
    decodeBase64(senderSecretKey),
  );
  if (!boxed) throw new Error('Encryption failed');
  return { ciphertext: encodeBase64(boxed), nonce: encodeBase64(nonce) };
}

export function decryptMessage(
  ciphertext: string,
  nonce: string,
  senderPublicKey: string,
  recipientSecretKey: string,
): string {
  const opened = nacl.box.open(
    decodeBase64(ciphertext),
    decodeBase64(nonce),
    decodeBase64(senderPublicKey),
    decodeBase64(recipientSecretKey),
  );
  if (!opened) throw new Error('Decryption failed');
  return encodeUTF8(opened);
}

export function signPayload(payload: string, signingSecretKey: string): string {
  const sig = nacl.sign.detached(decodeUTF8(payload), decodeBase64(signingSecretKey));
  return encodeBase64(sig);
}

export function hashPin(pin: string, salt: string): string {
  return encodeBase64(nacl.hash(decodeUTF8(`${salt}:${pin}`)));
}

export function conversationIdFor(a: string, b: string): string {
  return [a, b].sort().join(':');
}

export function loginChallengePayload(secureId: string, nonce: string): string {
  return `smm-login:${secureId}:${nonce}`;
}

export function registerProofPayload(
  secureId: string,
  identityPublicKey: string,
  signingPublicKey: string,
): string {
  return `smm-register:${secureId}:${identityPublicKey}:${signingPublicKey}`;
}
