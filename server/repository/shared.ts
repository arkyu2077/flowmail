import { createHash, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

export const nowIso = (): string => new Date().toISOString();

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const slugifyWorkspaceName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workspace';

export const buildUniqueWorkspaceSlug = async (
  desiredName: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> => {
  const base = slugifyWorkspaceName(desiredName);
  if (!(await exists(base))) {
    return base;
  }

  let suffix = 2;
  while (await exists(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
};

export const hashPassword = (password: string): string => {
  const salt = randomUUID();
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (password: string, passwordHash: string): boolean => {
  const [salt, storedHash] = passwordHash.split(':');
  if (!salt || !storedHash) {
    return false;
  }

  const computedHash = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(storedHash, 'hex');
  if (storedBuffer.length !== computedHash.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, computedHash);
};

export const hashSessionToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const serializeJson = (value: unknown): string => JSON.stringify(value);

export const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};
