import type {
  AssistantQueryResponse,
  AuthSessionResponse,
  ConfigureFeishuBitableTargetRequest,
  ConfigureNotionTargetRequest,
  CreateWorkspaceRequest,
  CreateWorkspaceAccessTokenRequest,
  CreateWorkspaceAccessTokenResponse,
  DraftReplyResponse,
  ExportCasesResponse,
  GetTradeCaseResponse,
  ListWorkspacesResponse,
  LoginRequest,
  GoogleAuthInitiateRequest,
  GoogleAuthInitiateResponse,
  ListCasePacksResponse,
  ListExportTargetsResponse,
  ListMailboxConnectionsResponse,
  ListTradeCasesResponse,
  ListWorkspaceAccessTokensResponse,
  MailboxConnectionRequest,
  MailboxConnectionResponse,
  MailboxRefreshResponse,
  MissingDocumentsResponse,
  RegisterRequest,
  UpdateWorkspaceCasePackRequest,
  WorkspaceCasePackResponse,
} from './contracts';

const resolveBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) {
    return configured;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:3027/api';
  }

  return `${window.location.protocol}//${window.location.hostname}:3027/api`;
};

const baseUrl = resolveBaseUrl();

const getCsrfToken = (): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie.match(/(?:^|;\s*)tradecase_csrf=([^;]+)/);
  if (!match?.[1]) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const { headers: initHeaders, ...restInit } = init ?? {};
  const headers = new Headers(initHeaders ?? {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const method = (restInit.method ?? 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set('X-TradeCase-CSRF', csrfToken);
    }
  }

  const response = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    headers,
    ...restInit,
  });

  if (!response.ok) {
    const text = await response.text();
    let parsedMessage: string | null = null;
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      parsedMessage = parsed.error || parsed.message || null;
    } catch {
      parsedMessage = null;
    }
    throw new Error(parsedMessage || text || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
};

export const apiClient = {
  register: (payload: RegisterRequest) =>
    request<AuthSessionResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: LoginRequest) =>
    request<AuthSessionResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getSession: () =>
    request<AuthSessionResponse>('/auth/session'),
  listWorkspaces: () =>
    request<ListWorkspacesResponse>('/workspaces'),
  createWorkspace: (payload: CreateWorkspaceRequest) =>
    request<ListWorkspacesResponse>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () =>
    request<{ ok: true }>('/auth/logout', {
      method: 'POST',
    }),
  initiateGoogleLogin: (payload: GoogleAuthInitiateRequest) =>
    request<GoogleAuthInitiateResponse>('/auth/google/initiate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listCasePacks: () => request<ListCasePacksResponse>('/case-packs'),
  forWorkspace: (workspaceId: string) => ({
  getCasePack: () =>
    request<WorkspaceCasePackResponse>(`/workspaces/${workspaceId}/case-pack`),
  updateCasePack: (payload: UpdateWorkspaceCasePackRequest) =>
    request<WorkspaceCasePackResponse>(`/workspaces/${workspaceId}/case-pack`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  listCases: (params?: { status?: string; q?: string; missingOnly?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.status && params.status !== 'all') {
      searchParams.set('status', params.status);
    }
    if (params?.q) {
      searchParams.set('q', params.q);
    }
    if (params?.missingOnly) {
      searchParams.set('missingOnly', 'true');
    }

    const query = searchParams.toString();
    return request<ListTradeCasesResponse>(
      `/workspaces/${workspaceId}/cases${query ? `?${query}` : ''}`,
    );
  },
  getCase: (caseId: string) =>
    request<GetTradeCaseResponse>(`/workspaces/${workspaceId}/cases/${caseId}`),
  getMissingDocuments: () =>
    request<MissingDocumentsResponse>(`/workspaces/${workspaceId}/missing-documents`),
  draftReply: (caseId: string) =>
    request<DraftReplyResponse>(`/workspaces/${workspaceId}/cases/${caseId}/draft-reply`, {
      method: 'POST',
    }),
  connectMailbox: (payload: MailboxConnectionRequest) =>
    request<MailboxConnectionResponse>(
      `/workspaces/${workspaceId}/mailbox-connections/initiate`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
  listMailboxConnections: () =>
    request<ListMailboxConnectionsResponse>(`/workspaces/${workspaceId}/mailbox-connections`),
  refreshMailboxConnection: (connectionId: string) =>
    request<MailboxRefreshResponse>(
      `/workspaces/${workspaceId}/mailbox-connections/${connectionId}/refresh`,
      {
        method: 'POST',
      },
    ),
  assistantQuery: (query: string) =>
    request<AssistantQueryResponse>(`/workspaces/${workspaceId}/assistant/query`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
  listExportTargets: () =>
    request<ListExportTargetsResponse>(`/workspaces/${workspaceId}/export-targets`),
  configureFeishuBitableTarget: (payload: ConfigureFeishuBitableTargetRequest) =>
    request<ListExportTargetsResponse>(`/workspaces/${workspaceId}/export-targets/feishu/bitable`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  configureNotionTarget: (payload: ConfigureNotionTargetRequest) =>
    request<ListExportTargetsResponse>(`/workspaces/${workspaceId}/export-targets/notion`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  exportToFeishuBitable: () =>
    request<ExportCasesResponse>(`/workspaces/${workspaceId}/exports/feishu/bitable`, {
      method: 'POST',
    }),
  exportToNotion: () =>
    request<ExportCasesResponse>(`/workspaces/${workspaceId}/exports/notion`, {
      method: 'POST',
    }),
  listAccessTokens: () =>
    request<ListWorkspaceAccessTokensResponse>(`/workspaces/${workspaceId}/access-tokens`),
  createAccessToken: (payload: CreateWorkspaceAccessTokenRequest) =>
    request<CreateWorkspaceAccessTokenResponse>(`/workspaces/${workspaceId}/access-tokens`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  revokeAccessToken: (accessTokenId: string) =>
    request<ListWorkspaceAccessTokensResponse>(
      `/workspaces/${workspaceId}/access-tokens/${accessTokenId}`,
      {
        method: 'DELETE',
      },
    ),
  }),
};
