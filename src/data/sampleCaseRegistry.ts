import { sampleCases } from './sampleCases';
import { sampleSaasCases } from './sampleSaasCases';
import type { CasePackId } from '../lib/case-packs';
import type { TradeCase } from '../types';

export const getSampleCasesForPack = (casePackId: CasePackId): TradeCase[] => {
  switch (casePackId) {
    case 'saas_revenue_order':
      return sampleSaasCases;
    default:
      return sampleCases;
  }
};
