import type { AgentRow } from './exports';

const notionBaseUrl = 'https://api.notion.com/v1';

export interface NotionTargetConfig {
  apiKey: string;
  dataSourceId: string;
  notionVersion?: string;
  titleProperty?: string;
  displayName?: string | null;
}

const getEnvNotionConfig = (): NotionTargetConfig | null => {
  const apiKey = process.env.NOTION_API_KEY;
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;
  if (!apiKey || !dataSourceId) {
    return null;
  }

  return {
    apiKey,
    dataSourceId,
    notionVersion: process.env.NOTION_VERSION ?? '2025-09-03',
    titleProperty: process.env.NOTION_TITLE_PROPERTY ?? 'Name',
    displayName: null,
  };
};

export const getEnvNotionTarget = (): NotionTargetConfig | null => getEnvNotionConfig();

export const hasEnvNotionConfig = (): boolean => {
  return Boolean(getEnvNotionConfig());
};

const requestNotion = async <T>(
  path: string,
  config: NotionTargetConfig,
  init?: RequestInit,
): Promise<T> => {
  const notionVersion = config.notionVersion ?? '2025-09-03';
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error('Missing NOTION_API_KEY.');
  }

  const response = await fetch(`${notionBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Notion-Version': notionVersion,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Notion API ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
};

const richText = (content: string) => ({
  rich_text: content
    ? [
        {
          type: 'text',
          text: {
            content: content.slice(0, 1900),
          },
        },
      ]
    : [],
});

const title = (content: string) => ({
  title: [
    {
      type: 'text',
      text: {
        content: content.slice(0, 1900),
      },
    },
  ],
});

const rowToNotionProperties = (row: AgentRow, config: NotionTargetConfig) => {
  const titleProperty = config.titleProperty ?? 'Name';
  return {
    [titleProperty]: title(row.caseTitle),
    'Case ID': richText(row.caseId),
    'Case Pack': richText(row.casePack),
    Account: richText(row.account),
    Region: richText(row.region),
    Status: richText(row.status),
    'Latest Subject': richText(row.latestSubject),
    'Latest Message At': {
      date: {
        start: row.latestMessageAt,
      },
    },
    'Thread Count': {
      number: row.threadCount,
    },
    'Attachment Count': {
      number: row.attachmentCount,
    },
    'Next Action': richText(row.nextAction),
    'Missing Data': richText(row.missingData),
    'Matched Keywords': richText(row.matchedKeywords),
    'Matched Doc Types': richText(row.matchedDocTypes),
    'Qualification Rule': richText(row.qualificationRule),
    'Qualification Score': {
      number: row.qualificationScore,
    },
  };
};

export const exportRowsToNotion = async (
  rows: AgentRow[],
  config: NotionTargetConfig,
) => {
  const { dataSourceId } = config;
  if (!dataSourceId) {
    throw new Error('Missing NOTION_DATA_SOURCE_ID.');
  }

  const results = [];
  for (const row of rows) {
    const created = await requestNotion<{ id: string }>('/pages', config, {
      method: 'POST',
      body: JSON.stringify({
        parent: {
          type: 'data_source_id',
          data_source_id: dataSourceId,
        },
        properties: rowToNotionProperties(row, config),
      }),
    });
    results.push(created);
  }

  return {
    exportedCount: results.length,
    dataSourceId,
  };
};
