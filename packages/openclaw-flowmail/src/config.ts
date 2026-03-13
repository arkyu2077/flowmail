import os from 'node:os';
import path from 'node:path';
import type { FlowMailPluginApi, PluginConfig } from './types';

export const PLUGIN_ID = 'openclaw-flowmail';

const defaultStateDir = path.join(os.homedir(), '.openclaw', 'state', PLUGIN_ID);

const defaults: PluginConfig = {
  gmailAccount: '',
  gogPath: 'gog',
  listCommandTemplate:
    'gog gmail search "{{syncQuery}}" --account "{{gmailAccount}}" --max {{maxThreads}} --json',
  threadCommandTemplate:
    'gog gmail get "{{threadId}}" --account "{{gmailAccount}}" --json',
  syncQuery:
    'newer_than:30d -category:promotions -category:social -category:forums -category:updates',
  casePackId: 'external_trade_order',
  maxThreads: 25,
  pollIntervalMinutes: 10,
  autoPoll: true,
  stateDir: defaultStateDir,
};

const toBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const toString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() ? value : fallback;

const toInteger = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

export const getPluginConfig = (api: FlowMailPluginApi): PluginConfig => {
  const raw =
    api.pluginConfig ??
    api.config?.plugins?.entries?.[PLUGIN_ID]?.config ??
    {};

  const maxThreads = Math.min(Math.max(toInteger(raw.maxThreads, defaults.maxThreads), 1), 100);
  const pollIntervalMinutes = Math.min(
    Math.max(toInteger(raw.pollIntervalMinutes, defaults.pollIntervalMinutes), 1),
    1440,
  );

  return {
    gmailAccount: toString(raw.gmailAccount, defaults.gmailAccount),
    gogPath: toString(raw.gogPath, defaults.gogPath),
    listCommandTemplate: toString(raw.listCommandTemplate, defaults.listCommandTemplate),
    threadCommandTemplate: toString(raw.threadCommandTemplate, defaults.threadCommandTemplate),
    syncQuery: toString(raw.syncQuery, defaults.syncQuery),
    casePackId:
      raw.casePackId === 'saas_revenue_order' ? 'saas_revenue_order' : 'external_trade_order',
    maxThreads,
    pollIntervalMinutes,
    autoPoll: toBoolean(raw.autoPoll, defaults.autoPoll),
    stateDir: toString(raw.stateDir, defaults.stateDir),
  };
};

export const interpolateTemplate = (
  template: string,
  variables: Record<string, string | number>,
): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
    String(variables[key] ?? ''),
  );

export const hasConfiguredGmailAccount = (config: PluginConfig): boolean =>
  config.gmailAccount.trim().length > 0;

export const assertSyncConfig = (config: PluginConfig): void => {
  if (!hasConfiguredGmailAccount(config)) {
    throw new Error(
      'FlowMail requires plugins.entries.openclaw-flowmail.config.gmailAccount before sync. Set the Gmail account that gog should read, then retry.',
    );
  }
};
