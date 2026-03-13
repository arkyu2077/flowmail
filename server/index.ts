import './env';
import './http';
import { serve } from '@hono/node-server';
import { createTradeCaseApp } from './app';
import { localFileRepository } from './repository/local-file';

const app = createTradeCaseApp({
  repository: localFileRepository,
});

const port = Number.parseInt(process.env.PORT ?? '3027', 10);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`TradeCase API listening on http://localhost:${info.port}`);
  },
);
