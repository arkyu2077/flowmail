import { JsonStateStore } from '../state/store';
import type { HandledState } from '../types';

const updateHandledState = async (
  store: JsonStateStore,
  caseId: string,
  handledState: HandledState,
  reason: string | null,
  deferUntil: string | null,
) => {
  return store.update((state) => {
    const item = state.cases[caseId];
    if (!item) {
      throw new Error(`Case not found: ${caseId}`);
    }

    item.handledState = handledState;
    item.deferUntil = deferUntil;
    item.updatedAt = new Date().toISOString();
    state.actions.unshift(
      store.createAction('case', caseId, handledState, reason, 'agent'),
    );

    const threadState = state.threads[item.thread.threadId];
    if (threadState) {
      threadState.handledState = handledState;
      threadState.deferUntil = deferUntil;
      threadState.lastSeenAt = item.updatedAt;
    }

    return state;
  });
};

export const markHandled = async (store: JsonStateStore, caseId: string, reason: string | null) => {
  await updateHandledState(store, caseId, 'handled', reason, null);
  return { ok: true, caseId, handledState: 'handled' };
};

export const dismissCase = async (store: JsonStateStore, caseId: string, reason: string | null) => {
  await updateHandledState(store, caseId, 'dismissed', reason, null);
  return { ok: true, caseId, handledState: 'dismissed' };
};

export const deferCase = async (
  store: JsonStateStore,
  caseId: string,
  deferUntil: string,
  reason: string | null,
) => {
  await updateHandledState(store, caseId, 'deferred', reason, deferUntil);
  return { ok: true, caseId, handledState: 'deferred', deferUntil };
};
