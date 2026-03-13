# Cloudflare Bring-Up

This folder contains the first migration assets for moving TradeCase OS from the local JSON prototype to Cloudflare.

## Files

- `d1/0001_initial.sql`: first normalized D1 schema

## Suggested resource creation order

1. Create the D1 database.
2. Create the R2 bucket.
3. Create the queues.
4. Add Worker secrets.
5. Apply the first D1 migration.
6. Wire the Worker to the new bindings.

## Example commands

Create D1:

```bash
wrangler d1 create flowmail-prod
```

Create R2:

```bash
wrangler r2 bucket create flowmail-attachments
```

Create queues:

```bash
wrangler queues create tradecase-mail-sync
wrangler queues create tradecase-case-extract
wrangler queues create tradecase-export
wrangler queues create tradecase-mail-sync-dlq
wrangler queues create tradecase-case-extract-dlq
wrangler queues create tradecase-export-dlq
```

Apply D1 schema locally:

```bash
wrangler d1 execute DB --local --file cloudflare/d1/0001_initial.sql
```

Apply D1 schema remotely:

```bash
wrangler d1 execute DB --remote --file cloudflare/d1/0001_initial.sql
```

Set Worker secrets:

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put NOTION_CLIENT_ID
wrangler secret put NOTION_CLIENT_SECRET
wrangler secret put FEISHU_APP_ID
wrangler secret put FEISHU_APP_SECRET
wrangler secret put TOKEN_ENCRYPTION_KEY
```

## Local development

Use `.dev.vars.example` as the template for `.dev.vars`.

That lets Wrangler supply local values for:

- OAuth config
- cookie settings
- token encryption key

## What is still missing

These files do not yet make the app deployable on Cloudflare by themselves.
The next implementation step is to replace the filesystem store with a D1-backed repository layer and move the Worker entrypoint onto Cloudflare runtime bindings.
