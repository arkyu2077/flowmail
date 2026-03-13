import { localFileRepository } from './local-file';
import { D1TradeCaseRepository, type D1DatabaseLike } from './d1';
import type { TradeCaseRepository } from './types';

export interface RepositoryFactoryOptions {
  backend?: 'local-file' | 'd1';
  db?: D1DatabaseLike;
}

export const createRepository = (
  options: RepositoryFactoryOptions = {},
): TradeCaseRepository => {
  const backend = options.backend ?? ((process.env.DATA_BACKEND as 'local-file' | 'd1' | undefined) ?? 'local-file');
  if (backend === 'd1') {
    return new D1TradeCaseRepository(options.db);
  }
  return localFileRepository;
};

export const repository = createRepository();

export type { TradeCaseRepository } from './types';
export { D1TradeCaseRepository } from './d1';
