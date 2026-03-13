import type { AgentRow } from './exports';

const feishuBaseUrl = 'https://open.feishu.cn/open-apis';

export interface FeishuBitableTargetConfig {
  appToken: string;
  tableId: string;
  displayName?: string | null;
}

const getFeishuAppConfig = () => ({
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET,
});

const getEnvFeishuTargetConfig = (): FeishuBitableTargetConfig | null => {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_BITABLE_TABLE_ID;
  if (!appToken || !tableId) {
    return null;
  }

  return {
    appToken,
    tableId,
    displayName: null,
  };
};

export const hasFeishuAppConfig = (): boolean => {
  const { appId, appSecret } = getFeishuAppConfig();
  return Boolean(appId && appSecret);
};

export const getEnvFeishuBitableTarget = (): FeishuBitableTargetConfig | null =>
  getEnvFeishuTargetConfig();

export const hasEnvFeishuBitableConfig = (): boolean => {
  return hasFeishuAppConfig() && Boolean(getEnvFeishuTargetConfig());
};

const requestFeishu = async <T>(
  path: string,
  init?: RequestInit,
  accessToken?: string,
): Promise<T> => {
  const response = await fetch(`${feishuBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Feishu API ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
};

const getTenantAccessToken = async (): Promise<string> => {
  const { appId, appSecret } = getFeishuAppConfig();
  if (!appId || !appSecret) {
    throw new Error('Missing FEISHU_APP_ID or FEISHU_APP_SECRET.');
  }

  const response = await requestFeishu<{
    code: number;
    msg: string;
    tenant_access_token?: string;
  }>('/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  });

  if (response.code !== 0 || !response.tenant_access_token) {
    throw new Error(`Feishu token error: ${response.msg}`);
  }

  return response.tenant_access_token;
};

const mapRowToFeishuFields = (row: AgentRow) => ({
  'Case Title': row.caseTitle,
  'Case ID': row.caseId,
  'Case Pack': row.casePack,
  Account: row.account,
  Region: row.region,
  Status: row.status,
  'Latest Subject': row.latestSubject,
  'Latest Message At': row.latestMessageAt,
  'Thread Count': row.threadCount,
  'Attachment Count': row.attachmentCount,
  'Next Action': row.nextAction,
  'Missing Data': row.missingData,
  'Matched Keywords': row.matchedKeywords,
  'Matched Doc Types': row.matchedDocTypes,
  'Qualification Rule': row.qualificationRule,
  'Qualification Score': row.qualificationScore,
});

export const exportRowsToFeishuBitable = async (
  rows: AgentRow[],
  targetConfig: FeishuBitableTargetConfig,
) => {
  const { appToken, tableId } = targetConfig;
  if (!appToken || !tableId) {
    throw new Error('Missing FEISHU_BITABLE_APP_TOKEN or FEISHU_BITABLE_TABLE_ID.');
  }

  const accessToken = await getTenantAccessToken();
  const response = await requestFeishu<{
    code: number;
    msg: string;
    data?: {
      records?: Array<{ record_id: string }>;
    };
  }>(
    `/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`,
    {
      method: 'POST',
      body: JSON.stringify({
        records: rows.map((row) => ({
          fields: mapRowToFeishuFields(row),
        })),
      }),
    },
    accessToken,
  );

  if (response.code !== 0) {
    throw new Error(`Feishu Bitable export failed: ${response.msg}`);
  }

  return {
    exportedCount: response.data?.records?.length ?? rows.length,
    tableId,
    appToken,
  };
};
