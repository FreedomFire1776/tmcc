import type { Pool } from 'pg';
import type { OrbitObject, Page, PageRequest, UUID } from '@tmcc/orbit-kernel';
import type { SearchFilters } from './search-service.js';

export function mapOrbitObjectRow(row: any): OrbitObject {
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

// All object searches use the same predicates, including searches constrained by relationships.
export function appendObjectSearchFilters(request: SearchFilters, filters: string[], values: unknown[]): void {
  if (request.query) {
    values.push(`%${request.query}%`);
    filters.push(`o.title ILIKE $${values.length}`);
  }
  if (request.objectType) {
    values.push(request.objectType);
    filters.push(`o.object_type = $${values.length}`);
  }
  if (request.status) {
    values.push(request.status);
    filters.push(`o.status = $${values.length}`);
  }
  if (request.ownerId) {
    values.push(request.ownerId);
    filters.push(`o.owner_id = $${values.length}`);
  }
}

function decodeCursor(cursor: string): { createdAt: string; id: UUID } {
  const buffer = Buffer.from(cursor, 'base64');
  const [createdAt, id, extra] = buffer.toString('utf8').split('|');
  if (buffer.toString('base64') !== cursor || !createdAt || !id || extra !== undefined ||
      !Number.isFinite(Date.parse(createdAt)) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Invalid cursor');
  }
  return { createdAt, id: id as UUID };
}

export async function queryObjectPage(
  pool: Pool,
  filters: string[],
  values: unknown[],
  request: PageRequest
): Promise<Page<OrbitObject>> {
  const limit = request.limit ?? 25;
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(limit + 1)) {
    throw new Error('Page limit must be a positive safe integer');
  }

  if (request.cursor !== undefined) {
    const cursor = decodeCursor(request.cursor);
    values.push(cursor.createdAt, cursor.id);
    filters.push(`(o.created_at, o.id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
  }

  // Format the cursor in PostgreSQL: JS Date would discard the timestamp's microseconds.
  let sql = `SELECT o.*, to_char(o.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at
             FROM orbit_objects o`;
  if (filters.length > 0) {
    sql += ` WHERE ${filters.join(' AND ')}`;
  }
  sql += ' ORDER BY o.created_at DESC, o.id DESC';
  values.push(limit + 1);
  sql += ` LIMIT $${values.length}`;

  const result = await pool.query(sql, values);
  const items = result.rows.slice(0, limit).map(mapOrbitObjectRow);
  if (result.rows.length > limit) {
    const last = result.rows[limit - 1];
    const nextCursor = Buffer.from(`${last.cursor_created_at}|${last.id}`).toString('base64');
    return { items, nextCursor };
  }
  return { items };
}
