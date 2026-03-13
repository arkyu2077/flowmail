import { createTradeCaseApp } from '../server/app';
import { D1TradeCaseRepository, type D1DatabaseLike } from '../server/repository/d1';

type WorkerEnv = {
  DB: D1DatabaseLike;
  APP_BASE_URL?: string;
  FRONTEND_BASE_URL?: string;
  COOKIE_SECURE?: string;
  DATA_BACKEND?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  GMAIL_SYNC_QUERY?: string;
  GMAIL_SYNC_MAX_THREADS?: string;
  FEISHU_APP_ID?: string;
  FEISHU_APP_SECRET?: string;
  FEISHU_BITABLE_APP_TOKEN?: string;
  FEISHU_BITABLE_TABLE_ID?: string;
  NOTION_API_KEY?: string;
  NOTION_CLIENT_ID?: string;
  NOTION_CLIENT_SECRET?: string;
  NOTION_DATA_SOURCE_ID?: string;
  NOTION_TITLE_PROPERTY?: string;
  NOTION_VERSION?: string;
  TOKEN_ENCRYPTION_KEY?: string;
};

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
};

const applyWorkerEnv = (env: WorkerEnv) => {
  const entries = Object.entries(env).filter(
    ([, value]) => typeof value === 'string' && value.length > 0,
  ) as Array<[string, string]>;

  for (const [key, value] of entries) {
    process.env[key] = value;
  }

  process.env.DATA_BACKEND = 'd1';
};

export class WorkspaceSyncCoordinator {
  async fetch(): Promise<Response> {
    return new Response('Workspace sync coordination is not implemented yet.', {
      status: 501,
    });
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv, executionContext: ExecutionContextLike) {
    applyWorkerEnv(env);

    const requestUrl = new URL(request.url);
    const frontendBaseUrl = env.FRONTEND_BASE_URL ?? env.APP_BASE_URL ?? requestUrl.origin;
    const app = createTradeCaseApp({
      repository: new D1TradeCaseRepository(env.DB),
      frontendBaseUrl,
      secureCookies:
        env.COOKIE_SECURE === 'true' || requestUrl.protocol === 'https:',
    });

    return app.fetch(request, env as never, executionContext as never);
  },
};
