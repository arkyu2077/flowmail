import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  CasePackId,
  PluginState,
  StoredActionEvent,
  StoredCase,
  StoredThreadState,
} from '../types';

const initialState = (casePackId: CasePackId): PluginState => ({
  version: 1,
  casePackId,
  lastSyncAt: null,
  lastSyncError: null,
  lastSyncThreadCount: 0,
  lastSyncQualifiedCount: 0,
  threads: {},
  cases: {},
  actions: [],
});

export class JsonStateStore {
  private readonly stateFile: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly stateDir: string, private readonly casePackId: CasePackId) {
    this.stateFile = path.join(stateDir, 'state.json');
  }

  getStateFilePath(): string {
    return this.stateFile;
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
  }

  async read(): Promise<PluginState> {
    await this.ensureDir();
    try {
      const raw = await fs.readFile(this.stateFile, 'utf8');
      const parsed = JSON.parse(raw) as PluginState;
      return {
        ...initialState(this.casePackId),
        ...parsed,
        casePackId: this.casePackId,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        const state = initialState(this.casePackId);
        await this.write(state);
        return state;
      }
      throw error;
    }
  }

  async write(state: PluginState): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }

  async update(mutator: (state: PluginState) => PluginState | Promise<PluginState>): Promise<PluginState> {
    const task = this.queue.then(async () => {
      const current = await this.read();
      const next = await mutator(current);
      await this.write(next);
      return next;
    });

    this.queue = task.catch(() => undefined);
    return task;
  }

  createAction(targetType: 'case' | 'thread', targetId: string, action: string, reason: string | null, actor: StoredActionEvent['actor']): StoredActionEvent {
    return {
      id: crypto.randomUUID(),
      targetType,
      targetId,
      action,
      reason,
      actor,
      createdAt: new Date().toISOString(),
    };
  }

  upsertThread(state: PluginState, thread: StoredThreadState): void {
    state.threads[thread.threadId] = thread;
  }

  upsertCase(state: PluginState, item: StoredCase): void {
    state.cases[item.id] = item;
  }
}
