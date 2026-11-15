/**
 * RFC4122-shaped v4 id from Math.random. Hermes (React Native) has no global
 * `crypto`, so crypto.randomUUID() throws there. These ids only need to be
 * unique per device for local rows and idempotent sync keys, not secret.
 */
export function newId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
