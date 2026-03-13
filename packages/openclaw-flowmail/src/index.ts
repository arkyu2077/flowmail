import { assertSyncConfig, getPluginConfig, hasConfiguredGmailAccount, PLUGIN_ID } from './config';
import { dismissCase, markHandled, deferCase } from './services/actions';
import { listCases, getCase, listMissingDocuments, listStuckCases, readStatus } from './services/query';
import { syncMailbox } from './services/sync';
import { JsonStateStore } from './state/store';
import type { FlowMailPluginApi, PluginConfig } from './types';

const toolResult = (payload: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify(payload, null, 2),
    },
  ],
  details: payload,
});

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});

const emptySchema = objectSchema({});

const stringSchema = (description: string) => ({
  type: 'string',
  description,
});

const integerSchema = (description: string) => ({
  type: 'integer',
  description,
});

class FlowMailPlugin {
  private intervalHandle: NodeJS.Timeout | null = null;
  private syncInFlight: Promise<unknown> | null = null;

  constructor(private readonly api: FlowMailPluginApi) {}

  private getConfig(): PluginConfig {
    return getPluginConfig(this.api);
  }

  private getStore(config?: PluginConfig): JsonStateStore {
    const resolved = config ?? this.getConfig();
    return new JsonStateStore(resolved.stateDir, resolved.casePackId);
  }

  private stringifyForLog(payload: unknown): string {
    if (payload === undefined) {
      return '';
    }
    if (typeof payload === 'string') {
      return payload;
    }
    try {
      return JSON.stringify(payload);
    } catch {
      return String(payload);
    }
  }

  private logInfo(message: string, payload?: unknown): void {
    const suffix = this.stringifyForLog(payload);
    const fullMessage = suffix ? `${message} ${suffix}` : message;
    this.api.logger?.info?.(fullMessage);
    this.api.log?.info?.(message, payload);
  }

  private logWarn(message: string, payload?: unknown): void {
    const suffix = this.stringifyForLog(payload);
    const fullMessage = suffix ? `${message} ${suffix}` : message;
    this.api.logger?.warn?.(fullMessage);
    this.api.log?.warn?.(message, payload);
  }

  private logError(message: string, payload?: unknown): void {
    const suffix = this.stringifyForLog(payload);
    const fullMessage = suffix ? `${message} ${suffix}` : message;
    this.api.logger?.error?.(fullMessage);
    this.api.log?.error?.(message, payload);
  }

  private async runSync(): Promise<unknown> {
    if (this.syncInFlight) {
      return this.syncInFlight;
    }

    const config = this.getConfig();
    assertSyncConfig(config);
    const store = this.getStore(config);
    this.syncInFlight = syncMailbox(this.api, config, store)
      .then((report) => {
        this.logInfo('[flowmail] sync complete', report);
        return report;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logError('[flowmail] sync failed', message);
        throw error;
      })
      .finally(() => {
        this.syncInFlight = null;
      });

    return this.syncInFlight;
  }

  private startPoller(): void {
    const config = this.getConfig();
    if (!config.autoPoll) {
      return;
    }
    if (!hasConfiguredGmailAccount(config)) {
      this.logWarn(
        '[flowmail] auto-poll skipped because gmailAccount is not configured',
      );
      return;
    }

    const intervalMs = Math.max(config.pollIntervalMinutes, 1) * 60_000;
    this.intervalHandle = setInterval(() => {
      void this.runSync();
    }, intervalMs);

    void this.runSync();
  }

  register(): void {
    this.startPoller();

    this.api.registerTool?.({
      name: 'flowmail_status',
      label: 'FlowMail status',
      description: 'Show the current FlowMail status, case counts, and last sync result.',
      optional: true,
      parameters: emptySchema,
      execute: async () => {
        const store = this.getStore();
        const config = this.getConfig();
        return toolResult({
          ...(await readStatus(store)),
          gmailAccount: config.gmailAccount || null,
          syncReady: hasConfiguredGmailAccount(config),
          configWarning: hasConfiguredGmailAccount(config)
            ? null
            : 'Set plugins.entries.openclaw-flowmail.config.gmailAccount before running sync.',
        });
      },
    });

    this.api.registerTool?.({
      name: 'flowmail_sync',
      label: 'FlowMail sync',
      description: 'Run an immediate mailbox sync through gog and update the persistent case store.',
      optional: true,
      parameters: emptySchema,
      execute: async () => toolResult(await this.runSync()),
    });

    this.api.registerTool?.({
      name: 'flowmail_list_cases',
      label: 'FlowMail list cases',
      description: 'List visible business email cases from the persistent store.',
      optional: true,
      parameters: objectSchema(
        {
          status: stringSchema('Optional workflow status filter.'),
          handledState: stringSchema('Optional handled-state filter.'),
          missingOnly: {
            type: 'boolean',
            description: 'Only include cases with missing data.',
          },
          limit: integerSchema('Maximum number of cases to return.'),
        },
      ),
      execute: async (_callId, params) => {
        const store = this.getStore();
        return toolResult(
          await listCases(store, {
            status: typeof params.status === 'string' ? params.status : undefined,
            handledState: typeof params.handledState === 'string' ? params.handledState : undefined,
            missingOnly: params.missingOnly === true,
            limit: typeof params.limit === 'number' ? params.limit : undefined,
          }),
        );
      },
    });

    this.api.registerTool?.({
      name: 'flowmail_get_case',
      label: 'FlowMail get case',
      description: 'Return one business email case with qualification, analysis, and thread detail.',
      optional: true,
      parameters: objectSchema(
        {
          caseId: stringSchema('Case identifier.'),
        },
        ['caseId'],
      ),
      execute: async (_callId, params) => {
        const store = this.getStore();
        const item = await getCase(store, String(params.caseId));
        if (!item) {
          throw new Error(`Case not found: ${String(params.caseId)}`);
        }
        return toolResult(item);
      },
    });

    this.api.registerTool?.({
      name: 'flowmail_list_stuck_cases',
      label: 'FlowMail list stuck cases',
      description: 'List cases that look blocked or require immediate attention.',
      optional: true,
      parameters: emptySchema,
      execute: async () => {
        const store = this.getStore();
        return toolResult(await listStuckCases(store));
      },
    });

    this.api.registerTool?.({
      name: 'flowmail_list_missing_documents',
      label: 'FlowMail list missing documents',
      description: 'List cases that are missing documents or structured fields.',
      optional: true,
      parameters: emptySchema,
      execute: async () => {
        const store = this.getStore();
        return toolResult(await listMissingDocuments(store));
      },
    });

    this.api.registerTool?.({
      name: 'flowmail_mark_handled',
      label: 'FlowMail mark handled',
      description: 'Mark a case as handled in persistent state so it no longer resurfaces.',
      optional: true,
      parameters: objectSchema(
        {
          caseId: stringSchema('Case identifier.'),
          reason: stringSchema('Optional note for the handled action.'),
        },
        ['caseId'],
      ),
      execute: async (_callId, params) => {
        const store = this.getStore();
        return toolResult(
          await markHandled(
            store,
            String(params.caseId),
            typeof params.reason === 'string' ? params.reason : null,
          ),
        );
      },
    });

    this.api.registerTool?.({
      name: 'flowmail_defer_case',
      label: 'FlowMail defer case',
      description: 'Defer a case until a future time while preserving it in persistent state.',
      optional: true,
      parameters: objectSchema(
        {
          caseId: stringSchema('Case identifier.'),
          deferUntil: stringSchema('ISO timestamp when the case should resurface.'),
          reason: stringSchema('Optional note for the defer action.'),
        },
        ['caseId', 'deferUntil'],
      ),
      execute: async (_callId, params) => {
        const store = this.getStore();
        return toolResult(
          await deferCase(
            store,
            String(params.caseId),
            String(params.deferUntil),
            typeof params.reason === 'string' ? params.reason : null,
          ),
        );
      },
    });

    this.api.registerTool?.({
      name: 'flowmail_dismiss_case',
      label: 'FlowMail dismiss case',
      description: 'Dismiss a case permanently from active triage.',
      optional: true,
      parameters: objectSchema(
        {
          caseId: stringSchema('Case identifier.'),
          reason: stringSchema('Optional note for the dismissal.'),
        },
        ['caseId'],
      ),
      execute: async (_callId, params) => {
        const store = this.getStore();
        return toolResult(
          await dismissCase(
            store,
            String(params.caseId),
            typeof params.reason === 'string' ? params.reason : null,
          ),
        );
      },
    });

    this.api.registerTool?.({
      name: 'flowmail_draft_reply',
      label: 'FlowMail draft reply',
      description: 'Return the current reply draft for a business email case.',
      optional: true,
      parameters: objectSchema(
        {
          caseId: stringSchema('Case identifier.'),
        },
        ['caseId'],
      ),
      execute: async (_callId, params) => {
        const store = this.getStore();
        const item = await getCase(store, String(params.caseId));
        if (!item) {
          throw new Error(`Case not found: ${String(params.caseId)}`);
        }
        return toolResult({
          caseId: item.id,
          draftReply: item.analysis.draftReply,
          status: item.analysis.status,
        });
      },
    });
  }
}

export default {
  id: PLUGIN_ID,
  name: 'FlowMail',
  register(api: FlowMailPluginApi) {
    const plugin = new FlowMailPlugin(api);
    plugin.register();
  },
};
