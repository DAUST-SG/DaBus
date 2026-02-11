const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedStudentDomains = ["webmail.daust.org", "daust.org"];

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const assertValidEmail = (email: string) => {
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email address");
  }
};

export const isAllowedStudentEmail = (email: string) =>
  allowedStudentDomains.some((domain) => email.endsWith(`@${domain}`));

export const assertAllowedStudentEmail = (email: string) => {
  if (!isAllowedStudentEmail(email)) {
    throw new Error("Only @webmail.daust.org or @daust.org emails are allowed");
  }
};

export const assertStrongPassword = (password: string) => {
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
};

export const normalizePhone = (phone: string) => phone.trim();

export const assertRequiredText = (value: string, label: string) => {
  if (!value.trim()) {
    throw new Error(`${label} is required`);
  }
};

export const generateSessionToken = () => {
  const a = crypto.randomUUID().replace(/-/g, "");
  const b = crypto.randomUUID().replace(/-/g, "");
  return `${a}${b}`;
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export const sha256 = async (value: string) => {
  const payload = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", payload);
  return toHex(hash);
};

export const hashPassword = async (password: string, salt: string) => {
  const payload = new TextEncoder().encode(`${salt}:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", payload);
  return toHex(hash);
};

export const createPasswordHash = async (password: string) => {
  const salt = crypto.randomUUID();
  const hash = await hashPassword(password, salt);
  return `${salt}:${hash}`;
};

export const verifyPassword = async (password: string, passwordHash: string) => {
  const [salt, expected] = passwordHash.split(":");
  if (!salt || !expected) {
    return false;
  }
  const calculated = await hashPassword(password, salt);
  return calculated === expected;
};
