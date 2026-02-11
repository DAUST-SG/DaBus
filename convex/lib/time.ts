export const now = () => Date.now();

export const toIso = (value: number) => new Date(value).toISOString();

export const sessionExpiryMs = () => now() + 1000 * 60 * 60 * 24 * 7;
