import type { TradeCaseRecord } from '../src/api/contracts';

export interface AgentRow {
  caseTitle: string;
  caseId: string;
  casePack: string;
  account: string;
  region: string;
  status: string;
  latestSubject: string;
  latestMessageAt: string;
  threadCount: number;
  attachmentCount: number;
  nextAction: string;
  missingData: string;
  matchedKeywords: string;
  matchedDocTypes: string;
  qualificationRule: string;
  qualificationScore: number;
}

export const flattenCasesForAgentOutputs = (
  records: TradeCaseRecord[],
  casePackName: string,
): AgentRow[] => {
  return records.map((record) => ({
    caseTitle: record.label,
    caseId: record.id,
    casePack: casePackName,
    account: record.account,
    region: record.region,
    status: record.workflowStatus,
    latestSubject: record.latestSubject,
    latestMessageAt: record.latestMessageAt,
    threadCount: record.threadCount,
    attachmentCount: record.attachmentCount,
    nextAction: record.nextAction ?? '',
    missingData: record.missingData.join(', '),
    matchedKeywords: record.qualification.matchedKeywords.join(', '),
    matchedDocTypes: record.qualification.matchedDocTypes.join(', '),
    qualificationRule: record.qualification.rule,
    qualificationScore: record.qualification.score,
  }));
};
