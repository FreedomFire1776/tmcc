import type { Pool } from 'pg';
import type { OrbitObject, ObjectType, Page, PageRequest, RelationshipQuery, UUID } from '@tmcc/orbit-kernel';
import type { SearchRequest } from './search-service.js';
import { appendObjectSearchFilters, mapOrbitObjectRow, queryObjectPage } from './object-query.js';

export interface QueryPageRequest extends PageRequest {}

export interface RelatedObjectQuery extends RelationshipQuery {
  /** Only search filters are used here. The outer limit and cursor control the combined page. */
  readonly searchRequest?: SearchRequest;
}

export interface QueryService {
  findById(id: UUID): Promise<OrbitObject | null>;
  findByType(objectType: ObjectType, request?: QueryPageRequest): Promise<Page<OrbitObject>>;
  /** Source filters return targets; target-only filters return sources; unanchored queries return both endpoints. */
  findByRelationship(query: RelatedObjectQuery): Promise<Page<OrbitObject>>;
}

export class PostgresQueryService implements QueryService {
  constructor(private readonly pool: Pool) {}

  async findById(id: UUID): Promise<OrbitObject | null> {
    const result = await this.pool.query('SELECT * FROM orbit_objects WHERE id = $1', [id]);
    return result.rowCount === 0 ? null : mapOrbitObjectRow(result.rows[0]);
  }

  async findByType(objectType: ObjectType, request: QueryPageRequest = {}): Promise<Page<OrbitObject>> {
    return queryObjectPage(this.pool, ['o.object_type = $1'], [objectType], request);
  }

  async findByRelationship(query: RelatedObjectQuery): Promise<Page<OrbitObject>> {
    const values: unknown[] = [];
    const relationshipFilters: string[] = [];

    // Select the opposite endpoint for anchored queries. If both anchors are supplied,
    // constrain the same relationship and return its target (the source-query direction).
    if (query.sourceObjectId) {
      relationshipFilters.push('r.target_object_id = o.id');
    } else if (query.targetObjectId) {
      relationshipFilters.push('r.source_object_id = o.id');
    } else {
      relationshipFilters.push('(r.source_object_id = o.id OR r.target_object_id = o.id)');
    }

    if (query.sourceObjectId) {
      values.push(query.sourceObjectId);
      relationshipFilters.push(`r.source_object_id = $${values.length}`);
    }
    if (query.targetObjectId) {
      values.push(query.targetObjectId);
      relationshipFilters.push(`r.target_object_id = $${values.length}`);
    }
    if (query.relationshipType) {
      values.push(query.relationshipType);
      relationshipFilters.push(`r.relationship_type = $${values.length}`);
    }

    // EXISTS restricts objects without multiplying rows when several relationships match.
    const filters = [`EXISTS (SELECT 1 FROM orbit_relationships r WHERE ${relationshipFilters.join(' AND ')})`];
    if (query.searchRequest) {
      appendObjectSearchFilters(query.searchRequest, filters, values);
    }
    return queryObjectPage(this.pool, filters, values, query);
  }
}
