import type { Pool } from 'pg';
import type { Page, PageRequest, OrbitObject, OrbitStatus, UUID } from '@tmcc/orbit-kernel';
import { appendObjectSearchFilters, queryObjectPage } from './object-query.js';

export interface SearchFilters {
  readonly query?: string;
  readonly objectType?: string;
  readonly status?: OrbitStatus;
  readonly ownerId?: UUID;
}

export interface SearchRequest extends SearchFilters, PageRequest {}

export interface SearchService {
  search(request?: SearchRequest): Promise<Page<OrbitObject>>;
}

export class PostgresSearchService implements SearchService {
  constructor(private readonly pool: Pool) {}

  async search(request: SearchRequest = {}): Promise<Page<OrbitObject>> {
    const values: unknown[] = [];
    const filters: string[] = [];
    appendObjectSearchFilters(request, filters, values);
    return queryObjectPage(this.pool, filters, values, request);
  }
}
