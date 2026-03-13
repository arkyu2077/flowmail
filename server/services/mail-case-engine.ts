import { getSampleCasesForPack } from '../../src/data/sampleCaseRegistry';
import {
  activeCasePackId,
  getCasePackById,
  type CasePackId,
} from '../../src/lib/case-packs';
import { analyzeCase } from '../../src/lib/analysis';
import { analyzeCaseQualification } from '../../src/lib/qualification';
import type { TradeCase, WorkflowStatus } from '../../src/types';
import type {
  AssistantQueryResponse,
  DraftReplyResponse,
  GetTradeCaseResponse,
  ListTradeCasesResponse,
  MissingDocumentsResponse,
  TradeCaseRecord,
} from '../../src/api/contracts';
import type { TradeCaseRepository } from '../repository';

export interface ListWorkspaceCasesOptions {
  status?: string;
  query?: string;
  missingOnly?: boolean;
  limit?: number;
}

export interface SummarizeCaseResponse {
  workspaceId: string;
  caseId: string;
  summary: string;
  workflowStatus: WorkflowStatus;
  nextActions: ReturnType<typeof analyzeCase>['nextActions'];
}

const getLatestMessageAt = (tradeCase: TradeCase): string =>
  [...tradeCase.messages].sort((left, right) => right.sentAt.localeCompare(left.sentAt))[0]
    ?.sentAt ?? new Date().toISOString();

const buildStatusSummary = (
  records: TradeCaseRecord[],
): Record<WorkflowStatus, number> =>
  records.reduce<Record<WorkflowStatus, number>>((summary, record) => {
    summary[record.workflowStatus] = (summary[record.workflowStatus] ?? 0) + 1;
    return summary;
  }, {} as Record<WorkflowStatus, number>);

const filterTradeCaseRecords = (
  records: TradeCaseRecord[],
  status?: string,
  query?: string,
  missingOnly?: boolean,
): TradeCaseRecord[] => {
  const normalizedQuery = query?.trim().toLowerCase();

  return records.filter((record) => {
    if (status && record.workflowStatus !== status) {
      return false;
    }
    if (missingOnly && record.missingData.length === 0) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }

    const haystack = `${record.label} ${record.account} ${record.latestSubject}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
};

const normalizeQuery = (query: string): string => query.trim().toLowerCase();

export class MailCaseEngineService {
  constructor(private readonly repository: TradeCaseRepository) {}

  async getWorkspaceCasePackId(workspaceId: string): Promise<CasePackId> {
    const workspace = await this.repository.getWorkspaceMeta(workspaceId);
    return workspace?.selectedCasePackId ?? activeCasePackId;
  }

  buildTradeCaseRecord(tradeCase: TradeCase, casePackId: CasePackId): TradeCaseRecord {
    const analysis = analyzeCase(tradeCase, casePackId);
    const qualification = analyzeCaseQualification(tradeCase, casePackId);
    const latestMessageAt = getLatestMessageAt(tradeCase);
    const latestMessage =
      [...tradeCase.messages].sort((left, right) => right.sentAt.localeCompare(left.sentAt))[0] ??
      tradeCase.messages[0];

    return {
      id: tradeCase.id,
      label: tradeCase.label,
      account: tradeCase.account,
      region: tradeCase.region,
      latestSubject: latestMessage?.subject ?? tradeCase.label,
      latestMessageAt,
      workflowStatus: analysis.status,
      missingData: analysis.missingData,
      nextAction: analysis.nextActions[0]?.label ?? null,
      threadCount: tradeCase.messages.length,
      attachmentCount: tradeCase.attachments.length,
      qualification,
    };
  }

  async getVisibleWorkspaceCases(workspaceId: string): Promise<TradeCase[]> {
    const casePackId = await this.getWorkspaceCasePackId(workspaceId);
    const storedCases = await this.repository.getWorkspaceCases(workspaceId);
    const mailboxConnections = await this.repository.listMailboxConnections(workspaceId);
    const hasConnectedMailbox = mailboxConnections.some(
      (connection) => connection.status === 'connected',
    );
    const sourceCases =
      storedCases.length > 0
        ? storedCases
        : hasConnectedMailbox
          ? []
          : getSampleCasesForPack(casePackId);

    return sourceCases.filter((tradeCase) =>
      analyzeCaseQualification(tradeCase, casePackId).qualified,
    );
  }

  async listWorkspaceCaseRecords(workspaceId: string): Promise<{
    casePackId: CasePackId;
    tradeCases: TradeCase[];
    records: TradeCaseRecord[];
  }> {
    const casePackId = await this.getWorkspaceCasePackId(workspaceId);
    const tradeCases = await this.getVisibleWorkspaceCases(workspaceId);
    const records = tradeCases.map((tradeCase) =>
      this.buildTradeCaseRecord(tradeCase, casePackId),
    );

    return {
      casePackId,
      tradeCases,
      records,
    };
  }

  async listCases(
    workspaceId: string,
    options: ListWorkspaceCasesOptions = {},
  ): Promise<ListTradeCasesResponse> {
    const { records } = await this.listWorkspaceCaseRecords(workspaceId);
    const items = filterTradeCaseRecords(
      records,
      options.status,
      options.query,
      options.missingOnly,
    ).slice(0, Number.isNaN(options.limit ?? 50) ? 50 : (options.limit ?? 50));

    return {
      workspaceId,
      summary: {
        totalCases: records.length,
        byStatus: buildStatusSummary(records),
        casesWithMissingData: records.filter((record) => record.missingData.length > 0).length,
        stuckCases: records.filter(
          (record) =>
            record.workflowStatus === 'documentation_exception' ||
            record.missingData.length > 0,
        ).length,
      },
      items,
    };
  }

  async getCase(workspaceId: string, caseId: string): Promise<GetTradeCaseResponse | null> {
    const casePackId = await this.getWorkspaceCasePackId(workspaceId);
    const tradeCase = (await this.getVisibleWorkspaceCases(workspaceId)).find(
      (item) => item.id === caseId,
    );

    if (!tradeCase) {
      return null;
    }

    return {
      workspaceId,
      tradeCase,
      analysis: analyzeCase(tradeCase, casePackId),
      qualification: analyzeCaseQualification(tradeCase, casePackId),
    };
  }

  async listStuckCases(workspaceId: string): Promise<{
    workspaceId: string;
    items: TradeCaseRecord[];
  }> {
    const { records } = await this.listWorkspaceCaseRecords(workspaceId);

    return {
      workspaceId,
      items: filterTradeCaseRecords(records, undefined, undefined, true).filter(
        (record) =>
          record.workflowStatus === 'documentation_exception' ||
          record.workflowStatus === 'awaiting_payment' ||
          record.missingData.length > 0,
      ),
    };
  }

  async listMissingDocuments(workspaceId: string): Promise<MissingDocumentsResponse> {
    const casePackId = await this.getWorkspaceCasePackId(workspaceId);
    const tradeCases = await this.getVisibleWorkspaceCases(workspaceId);
    const items = tradeCases
      .map((tradeCase) => ({
        tradeCase,
        analysis: analyzeCase(tradeCase, casePackId),
      }))
      .filter(({ analysis }) => analysis.missingData.length > 0)
      .map(({ tradeCase, analysis }) => ({
        caseId: tradeCase.id,
        label: tradeCase.label,
        missingData: analysis.missingData,
        workflowStatus: analysis.status,
      }));

    return {
      workspaceId,
      items,
    };
  }

  async summarizeCase(
    workspaceId: string,
    caseId: string,
  ): Promise<SummarizeCaseResponse | null> {
    const casePackId = await this.getWorkspaceCasePackId(workspaceId);
    const tradeCase = (await this.getVisibleWorkspaceCases(workspaceId)).find(
      (item) => item.id === caseId,
    );

    if (!tradeCase) {
      return null;
    }

    const analysis = analyzeCase(tradeCase, casePackId);
    return {
      workspaceId,
      caseId: tradeCase.id,
      summary: analysis.summary,
      workflowStatus: analysis.status,
      nextActions: analysis.nextActions,
    };
  }

  async draftReply(
    workspaceId: string,
    caseId: string,
  ): Promise<DraftReplyResponse | null> {
    const casePackId = await this.getWorkspaceCasePackId(workspaceId);
    const tradeCase = (await this.getVisibleWorkspaceCases(workspaceId)).find(
      (item) => item.id === caseId,
    );

    if (!tradeCase) {
      return null;
    }

    const analysis = analyzeCase(tradeCase, casePackId);
    return {
      workspaceId,
      caseId: tradeCase.id,
      draftReply: analysis.draftReply,
      workflowStatus: analysis.status,
    };
  }

  async answerAssistantQuery(
    workspaceId: string,
    rawQuery: string,
  ): Promise<AssistantQueryResponse> {
    const { casePackId, tradeCases, records } = await this.listWorkspaceCaseRecords(workspaceId);
    const query = normalizeQuery(rawQuery);
    const defaultResponse: AssistantQueryResponse = {
      workspaceId,
      query: rawQuery,
      answer:
        'TradeCase can answer about stuck cases, missing data, case summaries, and reply drafts. Try asking about blockers, missing fields, or a named account.',
      referencedCases: [],
      suggestedActions: [
        `Ask: Which ${getCasePackById(casePackId).name.toLowerCase()} cases are blocked?`,
        'Ask: Summarize a named account.',
        'Ask: Draft a follow-up for the top case.',
      ],
    };

    if (!query) {
      return defaultResponse;
    }

    if (query.includes('missing')) {
      const cases = filterTradeCaseRecords(records, undefined, undefined, true);
      return {
        workspaceId,
        query: rawQuery,
        answer: `I found ${cases.length} case(s) with missing data. The top blockers are ${cases
          .flatMap((record) => record.missingData)
          .slice(0, 4)
          .join(', ')}.`,
        referencedCases: cases.map((record) => ({
          id: record.id,
          label: record.label,
          workflowStatus: record.workflowStatus,
        })),
        suggestedActions: [
          'Open the case detail and request the missing document set.',
          'Send a draft follow-up only after reviewing the missing fields.',
        ],
      };
    }

    if (query.includes('stuck') || query.includes('blocked')) {
      const cases = records.filter(
        (record) =>
          record.workflowStatus === 'documentation_exception' ||
          record.workflowStatus === 'awaiting_payment' ||
          record.missingData.length > 0,
      );
      return {
        workspaceId,
        query: rawQuery,
        answer: `There are ${cases.length} stuck case(s). Most are blocked by missing documents or customer confirmation.`,
        referencedCases: cases.map((record) => ({
          id: record.id,
          label: record.label,
          workflowStatus: record.workflowStatus,
        })),
        suggestedActions: [
          'Review missing documents first.',
          'Generate a reply draft for the highest-value blocked case.',
        ],
      };
    }

    if (query.includes('draft')) {
      const target =
        records.find((record) => query.includes(record.account.toLowerCase())) ?? records[0];
      if (!target) {
        return defaultResponse;
      }

      const tradeCase = tradeCases.find((item) => item.id === target.id);
      if (!tradeCase) {
        return defaultResponse;
      }

      const analysis = analyzeCase(tradeCase, casePackId);
      return {
        workspaceId,
        query: rawQuery,
        answer: analysis.draftReply,
        referencedCases: [
          {
            id: target.id,
            label: target.label,
            workflowStatus: target.workflowStatus,
          },
        ],
        suggestedActions: analysis.nextActions.map((action) => action.label),
      };
    }

    if (query.includes('po')) {
      const cases = records.filter(
        (record) =>
          record.workflowStatus === 'quote_sent' ||
          record.workflowStatus === 'purchase_order_received',
      );
      return {
        workspaceId,
        query: rawQuery,
        answer: `I found ${cases.length} case(s) around PO progression. These are the best candidates for sales follow-up or PI confirmation.`,
        referencedCases: cases.map((record) => ({
          id: record.id,
          label: record.label,
          workflowStatus: record.workflowStatus,
        })),
        suggestedActions: [
          'Confirm whether a PO has been received.',
          'If not, send a structured quote follow-up.',
        ],
      };
    }

    const referencedCase = records.find((record) => {
      const haystack =
        `${record.id} ${record.label} ${record.account} ${record.latestSubject}`.toLowerCase();
      return haystack.includes(query);
    });
    if (referencedCase) {
      const tradeCase = tradeCases.find((item) => item.id === referencedCase.id);
      if (!tradeCase) {
        return defaultResponse;
      }

      const analysis = analyzeCase(tradeCase, casePackId);
      return {
        workspaceId,
        query: rawQuery,
        answer: analysis.summary,
        referencedCases: [
          {
            id: referencedCase.id,
            label: referencedCase.label,
            workflowStatus: referencedCase.workflowStatus,
          },
        ],
        suggestedActions: analysis.nextActions.map((action) => action.label),
      };
    }

    return defaultResponse;
  }
}
