import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(serverDir, '..');

const parseEnvLine = (line: string): [string, string] | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  const rawValue = trimmed.slice(separatorIndex + 1).trim();
  const value = rawValue.replace(/^['"]|['"]$/g, '');

  if (!key) {
    return null;
  }

  return [key, value];
};

const loadEnvFile = (filePath: string) => {
  try {
    const content = readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }
      const [key, value] = parsed;
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore missing local env files in development.
  }
};

loadEnvFile(path.join(projectRoot, '.env.local'));
loadEnvFile(path.join(projectRoot, '.env'));

export const frontendBaseUrl = process.env.FRONTEND_BASE_URL ?? 'http://localhost:3017';
