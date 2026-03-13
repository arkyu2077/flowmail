import { getCasePack } from '../engine/case-packs';
import { JsonStateStore } from '../state/store';
import type { PluginState, StoredCase } from '../types';

const isDeferredActive = (item: StoredCase): boolean =>
  Boolean(item.deferUntil) && new Date(item.deferUntil ?? '').getTime() > Date.now();

const visibleCases = (state: PluginState): StoredCase[] =>
  Object.values(state.cases)
    .filter((item) => {
      if (item.handledState === 'dismissed' || item.handledState === 'handled') {
        return false;
      }
      if (item.handledState === 'deferred' && isDeferredActive(item)) {
        return false;
      }
      return true;
    })
    .sort((left, right) => right.latestMessageAt.localeCompare(left.latestMessageAt));

export const readStatus = async (store: JsonStateStore) => {
  const state = await store.read();
  return {
    casePack: getCasePack(state.casePackId).name,
    lastSyncAt: state.lastSyncAt,
    lastSyncError: state.lastSyncError,
    totalCases: Object.keys(state.cases).length,
    visibleCases: visibleCases(state).length,
    trackedThreads: Object.keys(state.threads).length,
    storePath: store.getStateFilePath(),
  };
};

export const listCases = async (
  store: JsonStateStore,
  filters: {
    status?: string;
    handledState?: string;
    missingOnly?: boolean;
    limit?: number;
  } = {},
) => {
  const state = await store.read();
  let items = visibleCases(state);

  if (filters.status) {
    items = items.filter((item) => item.analysis.status === filters.status);
  }
  if (filters.handledState) {
    items = items.filter((item) => item.handledState === filters.handledState);
  }
  if (filters.missingOnly) {
    items = items.filter((item) => item.analysis.missingData.length > 0);
  }

  const limit = typeof filters.limit === 'number' && filters.limit > 0 ? filters.limit : items.length;

  return items.slice(0, limit).map((item) => ({
    id: item.id,
    title: item.title,
    account: item.account,
    status: item.analysis.status,
    statusLabel: getCasePack(item.casePackId).statusLabels[item.analysis.status],
    handledState: item.handledState,
    latestSubject: item.latestSubject,
    latestMessageAt: item.latestMessageAt,
    missingData: item.analysis.missingData,
    nextActions: item.analysis.nextActions,
  }));
};

export const getCase = async (store: JsonStateStore, caseId: string) => {
  const state = await store.read();
  const item = state.cases[caseId];
  if (!item) {
    return null;
  }
  return {
    ...item,
    statusLabel: getCasePack(item.casePackId).statusLabels[item.analysis.status],
  };
};

export const listStuckCases = async (store: JsonStateStore) => {
  const items = await listCases(store);
  return items.filter((item) =>
    item.missingData.length > 0 ||
    item.status === 'documentation_exception' ||
    item.status === 'awaiting_payment',
  );
};

export const listMissingDocuments = async (store: JsonStateStore) => {
  const items = await listCases(store, { missingOnly: true });
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    missingData: item.missingData,
    status: item.status,
  }));
};
