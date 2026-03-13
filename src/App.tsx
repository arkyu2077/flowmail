import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { apiClient } from './api/client';
import type {
  AssistantQueryResponse,
  AuthSessionResponse,
  ExportTargetStatus,
  GetTradeCaseResponse,
  ListCasePacksResponse,
  ListTradeCasesResponse,
  MailboxConnectionStatus,
  WorkspaceAccessTokenRecord,
} from './api/contracts';
import { getCasePackById, getCasePackStatusLabel, type CasePackId } from './lib/case-packs';
import type { WorkflowStatus } from './types';

const skillMethods = [
  'list_cases',
  'get_case',
  'list_missing_documents',
  'list_stuck_cases',
  'summarize_case',
  'draft_reply',
  'connect_mailbox',
];

type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  referencedCases?: AssistantQueryResponse['referencedCases'];
  suggestedActions?: string[];
};

const statusOptions: Array<{ value: 'all' | WorkflowStatus }> = [
  { value: 'all' },
  { value: 'quote_sent' },
  { value: 'purchase_order_received' },
  { value: 'awaiting_payment' },
  { value: 'shipment_preparation' },
  { value: 'shipment_in_progress' },
  { value: 'documentation_exception' },
];

const formatDateTime = (value: string): string =>
  new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function App() {
  const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() =>
    window.localStorage.getItem('tradecase_workspace_id'),
  );
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [authLoading, setAuthLoading] = useState(false);
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [authBootLoading, setAuthBootLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    workspaceName: '',
  });
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });
  const [casesResponse, setCasesResponse] = useState<ListTradeCasesResponse | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [selectedCase, setSelectedCase] = useState<GetTradeCaseResponse | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'all' | WorkflowStatus>('all');
  const [search, setSearch] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [casesLoading, setCasesLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(true);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [mailboxConnections, setMailboxConnections] = useState<MailboxConnectionStatus[]>([]);
  const [mailboxLoading, setMailboxLoading] = useState<'gmail' | 'outlook' | null>(null);
  const [mailboxSyncLoading, setMailboxSyncLoading] = useState(false);
  const [mailboxNotice, setMailboxNotice] = useState<string | null>(null);
  const [casePackSaving, setCasePackSaving] = useState(false);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [casePacks, setCasePacks] = useState<ListCasePacksResponse | null>(null);
  const [exportTargets, setExportTargets] = useState<ExportTargetStatus[]>([]);
  const [exportLoading, setExportLoading] = useState<'feishu' | 'notion' | null>(null);
  const [exportSetupLoading, setExportSetupLoading] = useState<'feishu_bitable' | 'notion' | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [workspaceAccessTokens, setWorkspaceAccessTokens] = useState<WorkspaceAccessTokenRecord[]>([]);
  const [accessTokenActionLoading, setAccessTokenActionLoading] = useState<string | null>(null);
  const [accessTokenNotice, setAccessTokenNotice] = useState<string | null>(null);
  const [newAccessTokenName, setNewAccessTokenName] = useState('OpenClaw skill');
  const [latestCreatedAccessToken, setLatestCreatedAccessToken] = useState<string | null>(null);
  const [feishuTargetForm, setFeishuTargetForm] = useState({
    displayName: '',
    appToken: '',
    tableId: '',
  });
  const [notionTargetForm, setNotionTargetForm] = useState({
    displayName: '',
    accessToken: '',
    dataSourceId: '',
    titleProperty: 'Name',
  });
  const [reloadToken, setReloadToken] = useState(0);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    {
      id: 'assistant-welcome',
      role: 'assistant',
      content:
        'TradeCase assistant is ready. Choose a workflow template, connect a mailbox, then ask about blockers, missing data, or draft a follow-up.',
    },
  ]);

  const deferredSearch = useDeferredValue(search);
  const activeMailboxConnection = mailboxConnections[0] ?? null;
  const hiddenThreadCount = activeMailboxConnection?.filteredOutThreadCount ?? 0;
  const runtimeApiBaseUrl =
    typeof window === 'undefined'
      ? 'http://localhost:3027/api'
      : `${window.location.protocol}//${window.location.hostname}:3027/api`;
  const feishuTarget = exportTargets.find((target) => target.id === 'feishu_bitable') ?? null;
  const notionTarget = exportTargets.find((target) => target.id === 'notion') ?? null;
  const workspaceApi = useMemo(() => {
    if (!activeWorkspaceId) {
      return null;
    }
    return apiClient.forWorkspace(activeWorkspaceId);
  }, [activeWorkspaceId]);
  const currentWorkspace =
    authSession?.workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const currentCasePack = getCasePackById(currentWorkspace?.selectedCasePackId ?? casePacks?.activeCasePackId);
  const currentAssistantPrompts = currentCasePack.assistantPrompts;
  const availableTemplates = useMemo(
    () => casePacks?.items.filter((pack) => pack.status !== 'planned') ?? [],
    [casePacks],
  );
  const configuredOutputCount = exportTargets.filter((target) => target.configured).length;
  const noticeMessages = [accessTokenNotice, mailboxNotice, exportNotice].filter(
    (message): message is string => Boolean(message),
  );

  const loadMailboxConnections = async () => {
    if (!workspaceApi) {
      setMailboxConnections([]);
      return;
    }
    const response = await workspaceApi.listMailboxConnections();
    setMailboxConnections(response.items);
  };

  const loadCasePacks = async () => {
    const response = await apiClient.listCasePacks();
    setCasePacks(response);
  };

  const loadExportTargets = async () => {
    if (!workspaceApi) {
      setExportTargets([]);
      return;
    }
    const response = await workspaceApi.listExportTargets();
    setExportTargets(response.items);
  };

  const loadAccessTokens = async () => {
    if (!workspaceApi) {
      setWorkspaceAccessTokens([]);
      return;
    }
    const response = await workspaceApi.listAccessTokens();
    setWorkspaceAccessTokens(response.items);
  };

  const hydrateSession = async (preferredWorkspaceId?: string | null) => {
    const response = await apiClient.getSession();
    const nextWorkspaceId =
      response.workspaces.find((workspace) => workspace.id === preferredWorkspaceId)?.id ??
      response.workspaces[0]?.id ??
      null;

    setAuthSession(response);
    setActiveWorkspaceId(nextWorkspaceId);
    setAuthError(null);
    if (nextWorkspaceId) {
      window.localStorage.setItem('tradecase_workspace_id', nextWorkspaceId);
    } else {
      window.localStorage.removeItem('tradecase_workspace_id');
    }
  };

  const handleAuthSuccess = async (response: AuthSessionResponse) => {
    setAuthSession(response);
    const nextWorkspaceId = response.workspaces[0]?.id ?? null;
    setActiveWorkspaceId(nextWorkspaceId);
    setCasesError(null);
    setDetailError(null);
    if (nextWorkspaceId) {
      window.localStorage.setItem('tradecase_workspace_id', nextWorkspaceId);
    }
    setAuthError(null);
  };

  useEffect(() => {
    let cancelled = false;
    setAuthBootLoading(true);
    hydrateSession(activeWorkspaceId)
      .catch(() => {
        if (cancelled) {
          return;
        }
        window.localStorage.removeItem('tradecase_workspace_id');
        setAuthSession(null);
        setActiveWorkspaceId(null);
        setAuthError(null);
      })
      .finally(() => {
        if (!cancelled) {
          setAuthBootLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!workspaceApi) {
      setCasesResponse(null);
      setSelectedCaseId('');
      setCasesError(null);
      setCasesLoading(false);
      return;
    }

    let cancelled = false;
    setCasesLoading(true);
    setCasesError(null);

    workspaceApi
      .listCases({
        status: selectedStatus,
        q: deferredSearch,
        missingOnly,
      })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setCasesResponse(response);

        const stillExists = response.items.some((item) => item.id === selectedCaseId);
        if (!stillExists) {
          setSelectedCaseId(response.items[0]?.id ?? '');
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setCasesError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCasesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deferredSearch, missingOnly, reloadToken, selectedCaseId, selectedStatus, workspaceApi]);

  useEffect(() => {
    void loadCasePacks();
  }, []);

  useEffect(() => {
    if (!workspaceApi) {
      return;
    }
    void loadMailboxConnections();
    void loadExportTargets();
    void loadAccessTokens();
  }, [workspaceApi]);

  useEffect(() => {
    if (feishuTarget?.configured) {
      setFeishuTargetForm((current) => ({
        ...current,
        displayName: feishuTarget.displayName ?? current.displayName,
      }));
    }

    if (notionTarget?.configured) {
      setNotionTargetForm((current) => ({
        ...current,
        displayName: notionTarget.displayName ?? current.displayName,
      }));
    }
  }, [feishuTarget, notionTarget]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authState = params.get('auth');
    if (authState) {
      if (authState === 'connected') {
        setAuthBootLoading(true);
        hydrateSession(activeWorkspaceId)
          .catch(() => {
            setAuthError('Google login completed, but the session could not be restored.');
          })
          .finally(() => {
            setAuthBootLoading(false);
          });
      } else if (authState === 'error') {
        setAuthError(params.get('message') ?? 'Google login failed.');
      }
    }

    const mailboxState = params.get('mailbox');
    if (!mailboxState) {
      if (authState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      return;
    }

    if (mailboxState === 'connected') {
      const syncedCases = params.get('syncedCases') ?? '0';
      const syncedThreads = params.get('syncedThreads') ?? '0';
      setMailboxNotice(`Gmail connected. Synced ${syncedCases} case(s) from ${syncedThreads} thread(s).`);
    } else if (mailboxState === 'error') {
      setMailboxNotice(`Mailbox connection failed: ${params.get('message') ?? 'Unknown error.'}`);
    }

    if (workspaceApi) {
      void loadMailboxConnections();
      startTransition(() => setReloadToken((value) => value + 1));
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }, [activeWorkspaceId, workspaceApi]);

  useEffect(() => {
    if (!selectedCaseId || !workspaceApi) {
      setSelectedCase(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);

    workspaceApi
      .getCase(selectedCaseId)
      .then((response) => {
        if (!cancelled) {
          setSelectedCase(response);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setDetailError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCaseId, workspaceApi]);

  useEffect(() => {
    setAssistantMessages((messages) => {
      if (messages.length === 0 || messages[0]?.id !== 'assistant-welcome') {
        return messages;
      }

      return [
        {
          ...messages[0],
          content: `TradeCase assistant is ready for ${currentCasePack.name}. Connect a mailbox, then ask about blockers, missing data, or draft a follow-up.`,
          suggestedActions: currentAssistantPrompts,
        },
        ...messages.slice(1),
      ];
    });
  }, [currentAssistantPrompts, currentCasePack.name]);

  const summaryCards = useMemo(() => {
    if (!casesResponse) {
      return [];
    }

    return [
      {
        label: 'Active cases',
        value: casesResponse.summary.totalCases,
      },
      {
        label: 'Cases with blockers',
        value: casesResponse.summary.casesWithMissingData,
      },
      {
        label: 'Stuck cases',
        value: casesResponse.summary.stuckCases,
      },
      {
        label: activeMailboxConnection ? 'Threads reviewed' : 'Available actions',
        value: activeMailboxConnection ? activeMailboxConnection.syncedThreadCount : skillMethods.length,
      },
    ];
  }, [activeMailboxConnection, casesResponse]);

  const connectMailbox = async (provider: 'gmail' | 'outlook') => {
    if (!workspaceApi) {
      setMailboxNotice('Select a workspace first.');
      return;
    }
    setMailboxLoading(provider);
    try {
      const response = await workspaceApi.connectMailbox({
        provider,
        returnUrl: `${window.location.origin}${window.location.pathname}`,
      });
      window.location.assign(response.oauthUrl);
    } catch (error) {
      setAssistantMessages((messages) => [
        ...messages,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content:
            error instanceof Error ? error.message : 'Unable to initialize mailbox connection.',
        },
      ]);
    } finally {
      setMailboxLoading(null);
    }
  };

  const refreshMailbox = async () => {
    if (!activeMailboxConnection || !workspaceApi) {
      return;
    }

    setMailboxSyncLoading(true);
    try {
      const response = await workspaceApi.refreshMailboxConnection(activeMailboxConnection.connectionId);
      await loadMailboxConnections();
      startTransition(() => setReloadToken((value) => value + 1));
      setMailboxNotice(
        `Mailbox sync finished. ${response.syncedCaseCount ?? 0} case(s) from ${response.syncedThreadCount ?? 0} thread(s).`,
      );
    } catch (error) {
      setMailboxNotice(
        error instanceof Error ? error.message : 'Unable to refresh the mailbox connection.',
      );
    } finally {
      setMailboxSyncLoading(false);
    }
  };

  const selectCasePack = async (casePackId: CasePackId) => {
    if (!workspaceApi || !authSession || !currentWorkspace || currentWorkspace.selectedCasePackId === casePackId) {
      return;
    }

    setCasePackSaving(true);
    try {
      const response = await workspaceApi.updateCasePack({
        casePackId,
      });
      setAuthSession((current) =>
        current
          ? {
              ...current,
              workspaces: current.workspaces.map((workspace) =>
                workspace.id === response.workspaceId
                  ? { ...workspace, selectedCasePackId: response.selectedCasePackId }
                  : workspace,
              ),
            }
          : current,
      );
      setMailboxNotice(`Template updated to ${response.selectedCasePack.name}. The board will now keep only matching cases.`);
      startTransition(() => setReloadToken((value) => value + 1));
    } catch (error) {
      setMailboxNotice(error instanceof Error ? error.message : 'Unable to update the workflow template.');
    } finally {
      setCasePackSaving(false);
    }
  };

  const runExport = async (target: 'feishu' | 'notion') => {
    if (!workspaceApi) {
      setExportNotice('Select a workspace first.');
      return;
    }
    setExportLoading(target);
    try {
      const response =
        target === 'feishu'
          ? await workspaceApi.exportToFeishuBitable()
          : await workspaceApi.exportToNotion();
      setExportNotice(response.message);
      await loadExportTargets();
    } catch (error) {
      setExportNotice(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setExportLoading(null);
    }
  };

  const saveFeishuTarget = async () => {
    if (!workspaceApi) {
      setExportNotice('Select a workspace first.');
      return;
    }
    setExportSetupLoading('feishu_bitable');
    try {
      const response = await workspaceApi.configureFeishuBitableTarget(feishuTargetForm);
      setExportTargets(response.items);
      setExportNotice('Saved the workspace Feishu target. This workspace now has its own table destination.');
      setFeishuTargetForm((current) => ({
        ...current,
        appToken: '',
        tableId: '',
      }));
    } catch (error) {
      setExportNotice(error instanceof Error ? error.message : 'Unable to save the Feishu target.');
    } finally {
      setExportSetupLoading(null);
    }
  };

  const saveNotionTarget = async () => {
    if (!workspaceApi) {
      setExportNotice('Select a workspace first.');
      return;
    }
    setExportSetupLoading('notion');
    try {
      const response = await workspaceApi.configureNotionTarget(notionTargetForm);
      setExportTargets(response.items);
      setExportNotice(
        'Saved the workspace Notion target. This workspace now has its own data-source destination.',
      );
      setNotionTargetForm((current) => ({
        ...current,
        accessToken: '',
      }));
    } catch (error) {
      setExportNotice(error instanceof Error ? error.message : 'Unable to save the Notion target.');
    } finally {
      setExportSetupLoading(null);
    }
  };

  const runAssistantQuery = async (query: string) => {
    if (!workspaceApi) {
      setAuthError('Sign in and pick a workspace first.');
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const userMessage: AssistantMessage = {
      id: `assistant-user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setAssistantMessages((messages) => [...messages, userMessage]);
    setAssistantInput('');
    setAssistantLoading(true);

    try {
      const response = await workspaceApi.assistantQuery(trimmed);
      const assistantMessage: AssistantMessage = {
        id: `assistant-response-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        referencedCases: response.referencedCases,
        suggestedActions: response.suggestedActions,
      };

      setAssistantMessages((messages) => [...messages, assistantMessage]);

      if (response.referencedCases[0]?.id) {
        startTransition(() => {
          setSelectedCaseId(response.referencedCases[0].id);
        });
      }
    } catch (error) {
      setAssistantMessages((messages) => [
        ...messages,
        {
          id: `assistant-response-${Date.now()}`,
          role: 'assistant',
          content:
            error instanceof Error ? error.message : 'Assistant query failed. Try another request.',
        },
      ]);
    } finally {
      setAssistantLoading(false);
    }
  };

  const handleWorkspaceChange = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    window.localStorage.setItem('tradecase_workspace_id', workspaceId);
    setSelectedCaseId('');
    setSelectedCase(null);
    setMailboxNotice(null);
    setExportNotice(null);
    setAccessTokenNotice(null);
    setLatestCreatedAccessToken(null);
    startTransition(() => setReloadToken((value) => value + 1));
  };

  const handleCreateAccessToken = async () => {
    if (!workspaceApi) {
      setAccessTokenNotice('Select a workspace first.');
      return;
    }

    setAccessTokenActionLoading('create');
    setAccessTokenNotice(null);
    setLatestCreatedAccessToken(null);

    try {
      const response = await workspaceApi.createAccessToken({
        name: newAccessTokenName.trim() || 'OpenClaw skill',
        scopes: ['engine'],
      });
      setWorkspaceAccessTokens((current) => [response.token, ...current]);
      setLatestCreatedAccessToken(response.plainTextToken);
      setAccessTokenNotice('Created a new workspace API token. Copy it now; the raw token is shown only once.');
    } catch (error) {
      setAccessTokenNotice(
        error instanceof Error ? error.message : 'Unable to create workspace API token.',
      );
    } finally {
      setAccessTokenActionLoading(null);
    }
  };

  const handleRevokeAccessToken = async (accessTokenId: string) => {
    if (!workspaceApi) {
      setAccessTokenNotice('Select a workspace first.');
      return;
    }

    setAccessTokenActionLoading(accessTokenId);
    setAccessTokenNotice(null);

    try {
      const response = await workspaceApi.revokeAccessToken(accessTokenId);
      setWorkspaceAccessTokens(response.items);
      setAccessTokenNotice('Revoked the workspace API token.');
    } catch (error) {
      setAccessTokenNotice(
        error instanceof Error ? error.message : 'Unable to revoke workspace API token.',
      );
    } finally {
      setAccessTokenActionLoading(null);
    }
  };

  const handleCopyAccessToken = async () => {
    if (!latestCreatedAccessToken) {
      return;
    }

    try {
      await navigator.clipboard.writeText(latestCreatedAccessToken);
      setAccessTokenNotice('Copied the workspace API token to your clipboard.');
    } catch {
      setAccessTokenNotice('Copy failed. Copy the token manually from the field below.');
    }
  };

  const handleCopySkillSnippet = async () => {
    if (!latestCreatedAccessToken || !activeWorkspaceId) {
      return;
    }

    const snippet = [
      `export TRADECASE_API_BASE_URL=${runtimeApiBaseUrl}`,
      `export TRADECASE_WORKSPACE_ID=${activeWorkspaceId}`,
      `export TRADECASE_WORKSPACE_TOKEN=${latestCreatedAccessToken}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(snippet);
      setAccessTokenNotice('Copied the OpenClaw skill env block to your clipboard.');
    } catch {
      setAccessTokenNotice('Copy failed. Copy the env block manually.');
    }
  };

  const handleRegister = async () => {
    setAuthLoading(true);
    try {
      const response = await apiClient.register(registerForm);
      await handleAuthSuccess(response);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to create account.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async () => {
    setAuthLoading(true);
    try {
      const response = await apiClient.login(loginForm);
      await handleAuthSuccess(response);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to login.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleAuthLoading(true);
    try {
      const response = await apiClient.initiateGoogleLogin({
        returnUrl: `${window.location.origin}${window.location.pathname}`,
      });
      window.location.assign(response.oauthUrl);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to start Google login.');
      setGoogleAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch {
      // Ignore local logout failures.
    }
    window.localStorage.removeItem('tradecase_workspace_id');
    setAuthSession(null);
    setActiveWorkspaceId(null);
    setMailboxConnections([]);
    setCasesResponse(null);
    setExportTargets([]);
  };

  const selectedRecord =
    casesResponse?.items.find((item) => item.id === selectedCaseId) ?? casesResponse?.items[0] ?? null;

  const handleCopyDraftReply = async () => {
    if (!selectedCase?.analysis.draftReply) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedCase.analysis.draftReply);
      setMailboxNotice('Copied the reply draft to your clipboard.');
    } catch {
      setMailboxNotice('Copy failed. Select the draft manually.');
    }
  };

  const handleAskAssistantAboutCase = () => {
    if (!selectedRecord) {
      return;
    }

    const prompt = `Summarize ${selectedRecord.account} and list the next actions.`;
    setAssistantInput(prompt);
    void runAssistantQuery(prompt);
  };

  if (authBootLoading) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <div className="eyebrow">TradeCase OS</div>
          <h1>Loading workspace session...</h1>
          <p className="hero-copy">
            Restoring your account, workspace selection, and connector state.
          </p>
        </div>
      </main>
    );
  }

  if (!authSession || !activeWorkspaceId) {
    return (
      <main className="auth-screen">
        <div className="auth-gate">
            <section className="auth-copy-block">
              <div className="eyebrow">TradeCase OS / SaaS preview</div>
              <h1>Every customer needs their own workspace, mailbox, and output targets.</h1>
              <p className="hero-copy">
                Sign in to create a TradeCase workspace. Gmail, Notion, and Feishu targets are
                then authorized inside that workspace rather than shared through a global demo env.
              </p>
              <div className="hero-pills">
                <span>Per-workspace auth</span>
                <span>Connector ownership</span>
                <span>Bot as client only</span>
              </div>
            </section>

            <section className="auth-card">
              <div className="auth-mode-switch">
                <button
                  className={authMode === 'register' ? 'mode-button active' : 'mode-button'}
                  onClick={() => setAuthMode('register')}
                  type="button"
                >
                  Create account
                </button>
                <button
                  className={authMode === 'login' ? 'mode-button active' : 'mode-button'}
                  onClick={() => setAuthMode('login')}
                  type="button"
                >
                  Sign in
                </button>
              </div>

              {authMode === 'register' ? (
                <form
                  className="auth-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleRegister();
                  }}
                >
                  <input
                    type="text"
                    value={registerForm.name}
                    onChange={(event) =>
                      setRegisterForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Your name"
                  />
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(event) =>
                      setRegisterForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="Work email"
                  />
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(event) =>
                      setRegisterForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Password (min 8 chars)"
                  />
                  <input
                    type="text"
                    value={registerForm.workspaceName}
                    onChange={(event) =>
                      setRegisterForm((current) => ({
                        ...current,
                        workspaceName: event.target.value,
                      }))
                    }
                    placeholder="First workspace name"
                  />
                  <button className="primary-button" disabled={authLoading} type="submit">
                    {authLoading ? 'Creating account...' : 'Create account and workspace'}
                  </button>
                </form>
              ) : (
                <form
                  className="auth-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleLogin();
                  }}
                >
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="Work email"
                  />
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Password"
                  />
                  <button className="primary-button" disabled={authLoading} type="submit">
                    {authLoading ? 'Signing in...' : 'Sign in'}
                  </button>
                </form>
              )}

              <div className="auth-divider">
                <span />
                <small>or</small>
                <span />
              </div>
              <button
                className="secondary-button google-login-button"
                disabled={googleAuthLoading}
                onClick={() => {
                  void handleGoogleLogin();
                }}
                type="button"
              >
                {googleAuthLoading ? 'Redirecting to Google...' : 'Continue with Google'}
              </button>

              {authError ? <div className="error-banner" role="alert">{authError}</div> : null}
            </section>
          </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <strong>TradeCase</strong>
          <span className="sidebar-caption">Mail case engine</span>
        </div>

        <div className="sidebar-workspace">
          <span className="sidebar-workspace-label">Workspace</span>
          <select value={activeWorkspaceId} onChange={(event) => handleWorkspaceChange(event.target.value)}>
            {authSession.workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sidebar-summary">
          <span className="sidebar-summary-label">Current template</span>
          <strong>{currentCasePack.name}</strong>
          <p>{currentCasePack.filterCopy}</p>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <strong>{authSession.user.name}</strong>
            <span>{authSession.user.email}</span>
          </div>
          <button className="sidebar-btn" onClick={() => void handleLogout()} type="button" style={{ width: '100%' }}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="page-header">
          <div className="page-header-inner">
            <div className="page-header-left">
              <h1>{currentCasePack.boardTitle}</h1>
            </div>
            <div className="page-header-actions">
              {summaryCards.map((item) => (
                <span key={item.label} className="stat-badge">
                  <strong>{item.value}</strong> {item.label}
                </span>
              ))}
              {currentWorkspace ? (
                <span className="stat-badge">
                  <strong>{currentWorkspace.name}</strong> workspace
                </span>
              ) : null}
            </div>
          </div>
        </header>

        <div className="main-content">
          {noticeMessages.map((message) => (
            <div key={message} className="notice-banner" aria-live="polite">
              {message}
            </div>
          ))}

          <section className="control-grid">
            <article className="control-card">
              <div className="section-heading">
                <div>
                  <strong>Template</strong>
                  <p>{currentCasePack.name}</p>
                </div>
              </div>
              <p className="section-copy">
                Choose one workflow. TradeCase will only keep emails that match this business case.
              </p>
              <div className="template-grid">
                {availableTemplates.map((pack) => (
                  <button
                    key={pack.id}
                    className={pack.id === currentCasePack.id ? 'template-button active' : 'template-button'}
                    type="button"
                    onClick={() => {
                      void selectCasePack(pack.id);
                    }}
                    disabled={casePackSaving}
                  >
                    <strong>{pack.name}</strong>
                    <span>{pack.description}</span>
                  </button>
                ))}
              </div>
            </article>

            <article className="control-card">
              <div className="section-heading">
                <div>
                  <strong>Mailbox</strong>
                  <p>{activeMailboxConnection?.emailAddress ?? 'Read-only Gmail connection'}</p>
                </div>
                <span className="status-pill">
                  {activeMailboxConnection?.status ?? 'not_connected'}
                </span>
              </div>
              <div className="mini-metrics">
                <div>
                  <strong>{activeMailboxConnection?.syncedThreadCount ?? 0}</strong>
                  <span>threads</span>
                </div>
                <div>
                  <strong>{activeMailboxConnection?.syncedCaseCount ?? casesResponse?.summary.totalCases ?? 0}</strong>
                  <span>cases</span>
                </div>
                <div>
                  <strong>{hiddenThreadCount}</strong>
                  <span>filtered out</span>
                </div>
              </div>
              <p className="section-copy">
                {activeMailboxConnection
                  ? `Last synced ${activeMailboxConnection.lastSyncedAt ? formatDateTime(activeMailboxConnection.lastSyncedAt) : 'not yet'}.`
                  : 'Connect Gmail first. Outlook can stay out of the MVP.'}
              </p>
              {currentCasePack.gmailQueryHint ? (
                <p className="muted-copy">{currentCasePack.gmailQueryHint}</p>
              ) : null}
              <div className="connect-actions">
                {!activeMailboxConnection ? (
                  <button className="primary-button" onClick={() => connectMailbox('gmail')} type="button" disabled={mailboxLoading !== null}>
                    {mailboxLoading === 'gmail' ? 'Connecting...' : 'Connect Gmail'}
                  </button>
                ) : (
                  <button className="primary-button" onClick={() => { void refreshMailbox(); }} type="button" disabled={mailboxSyncLoading}>
                    {mailboxSyncLoading ? 'Syncing...' : 'Sync mailbox'}
                  </button>
                )}
              </div>
              {activeMailboxConnection?.lastError ? <span className="error-copy">{activeMailboxConnection.lastError}</span> : null}
            </article>

            <article className="control-card">
              <div className="section-heading">
                <div>
                  <strong>OpenClaw token</strong>
                  <p>{workspaceAccessTokens.filter((token) => token.revokedAt === null).length} active token(s)</p>
                </div>
              </div>
              <p className="section-copy">
                Generate one workspace token for ClawHub. It only works on engine routes.
              </p>
              <div className="connector-form-grid">
                <input
                  type="text"
                  value={newAccessTokenName}
                  onChange={(event) => setNewAccessTokenName(event.target.value)}
                  placeholder="Token name"
                />
              </div>
              <div className="connect-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    void handleCreateAccessToken();
                  }}
                  disabled={accessTokenActionLoading !== null}
                >
                  {accessTokenActionLoading === 'create' ? 'Creating...' : 'Create token'}
                </button>
              </div>
              {latestCreatedAccessToken ? (
                <div className="draft-card">
                  <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Copy this once</strong>
                  <code style={{ display: 'block', wordBreak: 'break-all' }}>{latestCreatedAccessToken}</code>
                  <div className="connect-actions" style={{ marginTop: '0.75rem' }}>
                    <button className="secondary-button" type="button" onClick={() => { void handleCopyAccessToken(); }}>
                      Copy token
                    </button>
                    <button className="primary-button" type="button" onClick={() => { void handleCopySkillSnippet(); }}>
                      Copy env block
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="list-stack compact">
                {workspaceAccessTokens.length ? (
                  workspaceAccessTokens.map((token) => (
                    <div key={token.id} className="action-row token-row">
                      <div>
                        <strong>{token.name}</strong>
                        <small>{token.tokenPreview} · {token.revokedAt ? 'revoked' : 'active'}</small>
                      </div>
                      {!token.revokedAt ? (
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => {
                            void handleRevokeAccessToken(token.id);
                          }}
                          disabled={accessTokenActionLoading !== null}
                        >
                          {accessTokenActionLoading === token.id ? 'Revoking...' : 'Revoke'}
                        </button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <span className="muted-copy">No workspace tokens yet.</span>
                )}
              </div>
            </article>
          </section>

          <div className="filters-bar">
            <div className="mode-switch">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  className={selectedStatus === option.value ? 'mode-button active' : 'mode-button'}
                  onClick={() => startTransition(() => setSelectedStatus(option.value))}
                  type="button"
                >
                  {option.value === 'all' ? 'All' : getCasePackStatusLabel(currentCasePack.id, option.value)}
                </button>
              ))}
            </div>
            <label className="search-box">
              <input
                type="text"
                value={search}
                onChange={(event) => startTransition(() => setSearch(event.target.value))}
                placeholder="Search cases"
              />
            </label>
            <button
              className={missingOnly ? 'mode-button active' : 'mode-button'}
              onClick={() => startTransition(() => setMissingOnly((value) => !value))}
              type="button"
            >
              Missing data
            </button>
          </div>

          {casesError ? <div className="error-banner" role="alert">{casesError}</div> : null}

          <div className="case-grid">
            <div className="case-list">
              {casesLoading ? (
                <div className="empty-card">Loading cases...</div>
              ) : casesResponse?.items.length ? (
                casesResponse.items.map((item) => (
                  <button
                    key={item.id}
                    className={selectedCaseId === item.id ? 'case-card active' : 'case-card'}
                    onClick={() => startTransition(() => setSelectedCaseId(item.id))}
                    type="button"
                  >
                    <div className="signal-topline">
                      <strong>{item.account}</strong>
                      <span className={`status-pill status-${item.workflowStatus}`}>
                        {getCasePackStatusLabel(currentCasePack.id, item.workflowStatus)}
                      </span>
                    </div>
                    <small>{item.latestSubject}</small>
                    <div className="case-meta">
                      <span>{formatDateTime(item.latestMessageAt)}</span>
                      <span>{item.attachmentCount} att.</span>
                    </div>
                    {item.missingData.length ? (
                      <div className="tag-row">
                        {item.missingData.slice(0, 2).map((missing) => (
                          <span key={missing} className="tag warning">{missing}</span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                ))
              ) : (
                <div className="empty-card">
                  <strong>{currentCasePack.emptyStateTitle}</strong>
                  <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {activeMailboxConnection ? currentCasePack.filterCopy : currentCasePack.emptyStateCopy}
                  </p>
                </div>
              )}
            </div>

            <div className="detail-panel-wrap">
              {detailError ? <div className="error-banner" role="alert">{detailError}</div> : null}
              {detailLoading || !selectedCase || !selectedRecord ? (
                <div className="empty-card">Select a case to view details</div>
              ) : (
                <div className="detail-stack">
                  <div className="detail-header">
                    <div>
                      <h3>{selectedRecord.account}</h3>
                      <p>{selectedRecord.label}</p>
                    </div>
                    <span className={`status-pill status-${selectedCase.analysis.status}`}>
                      {getCasePackStatusLabel(currentCasePack.id, selectedCase.analysis.status)}
                    </span>
                  </div>

                  <p className="detail-summary">{selectedCase.analysis.summary}</p>

                  {selectedCase.analysis.missingData.length ? (
                    <div className="tag-row">
                      {selectedCase.analysis.missingData.map((item) => (
                        <span key={item} className="tag warning">{item}</span>
                      ))}
                    </div>
                  ) : null}

                  <div className="detail-section">
                    <h4>Extracted fields</h4>
                    <div className="field-list">
                      {selectedCase.analysis.extractedFields.map((field) => (
                        <div key={field.key} className="field-row">
                          <span className="field-label">{field.label}</span>
                          <span className="field-value">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedCase.analysis.nextActions.length ? (
                    <div className="detail-section">
                      <h4>Next steps</h4>
                      <div className="list-stack compact">
                        {selectedCase.analysis.nextActions.map((action) => (
                          <div key={action.label} className="action-row">
                            <span className={`priority-dot priority-${action.priority}`} />
                            <div>
                              <strong>{action.label}</strong>
                              <small>{action.reason}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {selectedCase.analysis.classifiedDocuments.length ? (
                    <div className="detail-section">
                      <h4>Documents</h4>
                      <div className="list-stack compact">
                        {selectedCase.analysis.classifiedDocuments.map((document) => (
                          <div key={document.attachmentId} className="doc-row">
                            <strong>{document.fileName}</strong>
                            <span>{document.docType} ({Math.round(document.confidence * 100)}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="detail-section">
                    <div className="section-heading section-heading-inline">
                      <div>
                        <h4>Reply draft</h4>
                      </div>
                      <div className="connect-actions">
                        <button className="secondary-button" type="button" onClick={() => { void handleCopyDraftReply(); }}>
                          Copy
                        </button>
                        <button className="secondary-button" type="button" onClick={() => { handleAskAssistantAboutCase(); }}>
                          Ask assistant
                        </button>
                      </div>
                    </div>
                    <div className="draft-card">{selectedCase.analysis.draftReply}</div>
                  </div>

                  <details className="detail-section">
                    <summary><h4 style={{ display: 'inline' }}>Thread ({selectedCase.tradeCase.messages.length})</h4></summary>
                    <div className="thread-stack">
                      {selectedCase.tradeCase.messages.map((message) => (
                        <div key={message.id} className="message-card">
                          <div className="message-head">
                            <strong>{message.subject}</strong>
                            <span>{formatDateTime(message.sentAt)}</span>
                          </div>
                          <div className="message-meta">
                            <span>{message.sender}</span>
                          </div>
                          <p>{message.body}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>

          <section className="simple-section">
            <div className="section-heading">
              <div>
                <strong>Assistant</strong>
                <p>Ask the engine about blockers, missing documents, and follow-ups.</p>
              </div>
            </div>
            <div className="tag-row assistant-chip-row">
              {currentAssistantPrompts.map((prompt) => (
                <button key={prompt} className="prompt-chip" onClick={() => runAssistantQuery(prompt)} type="button">
                  {prompt}
                </button>
              ))}
            </div>
            <div className="assistant-log">
              {assistantMessages.map((message) => (
                <article key={message.id} className={message.role === 'assistant' ? 'chat-bubble assistant' : 'chat-bubble user'}>
                  <strong>{message.role === 'assistant' ? 'TradeCase' : 'You'}</strong>
                  <p>{message.content}</p>
                  {message.referencedCases?.length ? (
                    <div className="chat-references">
                      {message.referencedCases.map((item) => (
                        <button key={item.id} className="reference-chip" onClick={() => startTransition(() => setSelectedCaseId(item.id))} type="button">
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {message.suggestedActions?.length ? (
                    <ul className="suggestion-list">
                      {message.suggestedActions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
              {assistantLoading ? <div className="empty-card">Assistant is working...</div> : null}
            </div>
            <form className="assistant-form" onSubmit={(event) => { event.preventDefault(); void runAssistantQuery(assistantInput); }}>
              <textarea value={assistantInput} onChange={(event) => setAssistantInput(event.target.value)} rows={3} placeholder="Ask about blockers, missing documents, or the next reply..." />
              <button className="primary-button" disabled={assistantLoading} type="submit">Ask</button>
            </form>
          </section>

          <details className="advanced-panel">
            <summary>Advanced outputs ({configuredOutputCount} configured)</summary>
            <div className="connector-setup-grid">
              <div className="connector-setup-card">
                <strong>Feishu Bitable</strong>
                <div className="connector-form-grid">
                  <input type="text" value={feishuTargetForm.displayName} onChange={(event) => setFeishuTargetForm((c) => ({ ...c, displayName: event.target.value }))} placeholder="Label" />
                  <input type="text" value={feishuTargetForm.appToken} onChange={(event) => setFeishuTargetForm((c) => ({ ...c, appToken: event.target.value }))} placeholder="App token" />
                  <input type="text" value={feishuTargetForm.tableId} onChange={(event) => setFeishuTargetForm((c) => ({ ...c, tableId: event.target.value }))} placeholder="Table ID" />
                </div>
                <div className="connect-actions">
                  <button className="secondary-button" type="button" onClick={() => { void saveFeishuTarget(); }} disabled={exportSetupLoading !== null}>
                    {exportSetupLoading === 'feishu_bitable' ? 'Saving...' : 'Save'}
                  </button>
                  <button className="primary-button" type="button" onClick={() => { void runExport('feishu'); }} disabled={exportLoading !== null || !feishuTarget?.configured}>
                    {exportLoading === 'feishu' ? 'Pushing...' : 'Push'}
                  </button>
                </div>
              </div>
              <div className="connector-setup-card">
                <strong>Notion</strong>
                <div className="connector-form-grid">
                  <input type="text" value={notionTargetForm.displayName} onChange={(event) => setNotionTargetForm((c) => ({ ...c, displayName: event.target.value }))} placeholder="Label" />
                  <input type="password" value={notionTargetForm.accessToken} onChange={(event) => setNotionTargetForm((c) => ({ ...c, accessToken: event.target.value }))} placeholder="Access token" />
                  <input type="text" value={notionTargetForm.dataSourceId} onChange={(event) => setNotionTargetForm((c) => ({ ...c, dataSourceId: event.target.value }))} placeholder="Data source ID" />
                  <input type="text" value={notionTargetForm.titleProperty} onChange={(event) => setNotionTargetForm((c) => ({ ...c, titleProperty: event.target.value }))} placeholder="Title property" />
                </div>
                <div className="connect-actions">
                  <button className="secondary-button" type="button" onClick={() => { void saveNotionTarget(); }} disabled={exportSetupLoading !== null}>
                    {exportSetupLoading === 'notion' ? 'Saving...' : 'Save'}
                  </button>
                  <button className="primary-button" type="button" onClick={() => { void runExport('notion'); }} disabled={exportLoading !== null || !notionTarget?.configured}>
                    {exportLoading === 'notion' ? 'Pushing...' : 'Push'}
                  </button>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

export default App;
