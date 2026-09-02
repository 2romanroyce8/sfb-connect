const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

/**
 * Generates a short, human-typeable reference code customers include in
 * their Cash App / PayPal / Zelle payment note (e.g. "SFB-7K2Q9X"). Admins
 * match this code against the incoming payment to confirm it.
 */
export function generateReferenceCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `SFB-${code}`;
}
