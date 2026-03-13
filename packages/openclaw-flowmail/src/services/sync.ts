import { getThreadDetail, listMailboxThreads } from '../adapters/gog';
import { analyzeThread } from '../engine/analyze';
import { qualifyThread } from '../engine/qualify';
import type {
  FlowMailPluginApi,
  NormalizedThread,
  PluginConfig,
  StoredCase,
  StoredThreadState,
  SyncReport,
} from '../types';
import { JsonStateStore } from '../state/store';

const nowIso = () => new Date().toISOString();

const buildCaseId = (threadId: string): string => `case:${threadId}`;

const stringifyError = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }
  return String(value);
};

export const syncMailbox = async (
  api: FlowMailPluginApi,
  config: PluginConfig,
  store: JsonStateStore,
): Promise<SyncReport> => {
  const listedThreads = await listMailboxThreads(config);
  let qualifiedCaseCount = 0;
  let changedCaseCount = 0;
  let dismissedCaseCount = 0;

  const detailedThreads: NormalizedThread[] = [];
  for (const listed of listedThreads) {
    try {
      const detail = await getThreadDetail(config, listed.threadId);
      detailedThreads.push(detail ?? listed);
    } catch (error) {
      const message = `[flowmail] failed to fetch thread detail ${listed.threadId}: ${stringifyError(error)}`;
      api.logger?.warn?.(message);
      api.log?.warn?.('[flowmail] failed to fetch thread detail', listed.threadId, error);
      detailedThreads.push(listed);
    }
  }

  const syncedAt = nowIso();
  await store.update((state) => {
    state.casePackId = config.casePackId;
    state.lastSyncAt = syncedAt;
    state.lastSyncError = null;
    state.lastSyncThreadCount = detailedThreads.length;

    for (const thread of detailedThreads) {
      const qualification = qualifyThread(thread, config.casePackId);
      const existingThread = state.threads[thread.threadId];
      const threadState: StoredThreadState = {
        threadId: thread.threadId,
        fingerprint: thread.fingerprint,
        subject: thread.subject,
        latestMessageAt: thread.latestMessageAt,
        caseId: existingThread?.caseId ?? null,
        handledState: existingThread?.handledState ?? 'open',
        deferUntil: existingThread?.deferUntil ?? null,
        lastSeenAt: syncedAt,
      };

      if (!qualification.qualified) {
        store.upsertThread(state, threadState);
        continue;
      }

      qualifiedCaseCount += 1;
      const analysis = analyzeThread(thread, config.casePackId);
      const caseId = buildCaseId(thread.threadId);
      const existingCase = state.cases[caseId];
      const handledState = existingCase?.handledState ?? threadState.handledState;
      const deferUntil = existingCase?.deferUntil ?? threadState.deferUntil;

      const nextCase: StoredCase = {
        id: caseId,
        casePackId: config.casePackId,
        title: `${thread.account} / ${thread.subject}`,
        account: thread.account,
        region: thread.region,
        latestSubject: thread.subject,
        latestMessageAt: thread.latestMessageAt,
        handledState,
        deferUntil,
        qualification,
        analysis,
        thread,
        createdAt: existingCase?.createdAt ?? syncedAt,
        updatedAt: syncedAt,
      };

      const changed =
        !existingCase ||
        existingCase.thread.fingerprint !== thread.fingerprint ||
        existingCase.analysis.status !== analysis.status ||
        existingCase.handledState !== handledState;

      if (changed) {
        changedCaseCount += 1;
      }

      if (handledState === 'dismissed') {
        dismissedCaseCount += 1;
      }

      threadState.caseId = caseId;
      threadState.handledState = handledState;
      threadState.deferUntil = deferUntil;
      store.upsertThread(state, threadState);
      store.upsertCase(state, nextCase);
    }

    state.lastSyncQualifiedCount = qualifiedCaseCount;
    return state;
  }).catch(async (error: Error) => {
    await store.update((state) => ({
      ...state,
      lastSyncError: error.message,
    }));
    throw error;
  });

  return {
    mailbox: config.gmailAccount,
    syncedThreadCount: detailedThreads.length,
    changedCaseCount,
    qualifiedCaseCount,
    dismissedCaseCount,
    storePath: store.getStateFilePath(),
    lastSyncAt: syncedAt,
  };
};
