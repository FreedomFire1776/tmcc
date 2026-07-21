import type { Pool } from 'pg';
import type { Page, OrbitObject, ObjectQuery, OrbitStatus, UUID } from '@tmcc/orbit-kernel';

export interface SearchRequest {
  readonly query?: string;
  readonly objectType?: string;
  readonly status?: OrbitStatus;
  readonly ownerId?: UUID;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface SearchService {
  search(request?: SearchRequest): Promise<Page<OrbitObject>>;
}

function mapOrbitObjectRow(row: any): OrbitObject {
  return {
    id: row.id,
    objectType: row.object_type,
    title: row.title,
    status: row.status,
    ownerId: row.owner_id ?? undefined,
    classification: row.classification ?? undefined,
    tags: row.tags ?? [],
    labels: row.labels ?? {},
    version: row.version,
    metadata: row.metadata ?? {},
    extensions: row.extensions ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

interface CursorPayload {
  createdAt: string;
  id: UUID;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(`${payload.createdAt}|${payload.id}`).toString('base64');
}

function decodeCursor(cursor: string): CursorPayload {
  const decoded = Buffer.from(cursor, 'base64').toString('utf8');
  const [createdAt, id] = decoded.split('|');
  if (!createdAt || !id) {
    throw new Error('Invalid cursor');
  }
  return { createdAt, id: id as UUID };
}

export class PostgresSearchService implements SearchService {
  constructor(private readonly pool: Pool) {}

  async search(request: SearchRequest = {}) {
    const values: any[] = [];
    const filters: string[] = [];
    let sql = 'SELECT * FROM orbit_objects';

    if (request.query) {
      values.push(`%${request.query}%`);
      filters.push(`title ILIKE $${values.length}`);
    }

    if (request.objectType) {
      values.push(request.objectType);
      filters.push(`object_type = $${values.length}`);
    }

    if (request.status) {
      values.push(request.status);
      filters.push(`status = $${values.length}`);
    }

    if (request.ownerId) {
      values.push(request.ownerId);
      filters.push(`owner_id = $${values.length}`);
    }

    if (filters.length > 0) {
      sql += ` WHERE ${filters.join(' AND ')}`;
    }

    if (request.cursor) {
      const cursor = decodeCursor(request.cursor);
      const paramIdx = values.length;
      values.push(cursor.createdAt, cursor.id);
      sql += filters.length > 0
        ? ` AND (created_at < $${paramIdx + 1} OR (created_at = $${paramIdx + 1} AND id < $${paramIdx + 2}))`
        : ` WHERE (created_at < $${paramIdx + 1} OR (created_at = $${paramIdx + 1} AND id < $${paramIdx + 2}))`;
    }

    sql += ' ORDER BY created_at DESC, id DESC';
    const limit = request.limit ?? 25;
    values.push(limit + 1);
    sql += ` LIMIT $${values.length}`;

    const result = await this.pool.query(sql, values);
    const items = result.rows.slice(0, limit).map(mapOrbitObjectRow);
    const nextCursor = result.rows.length > limit ? encodeCursor({ createdAt: result.rows[limit - 1].created_at, id: result.rows[limit - 1].id }) : undefined;

    return nextCursor ? { items, nextCursor } : { items };
  }
}
