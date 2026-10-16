import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { PostgresQueryService } from '../dist/query-service.js';
import { PostgresSearchService } from '../dist/search-service.js';
import { PostgresRelationshipService } from '../dist/relationship-service.js';

let database;
let pool;
let queryService;
let searchService;
let relationshipService;
let cleanup;
let relationshipSequence;

const id = (number) => `00000000-0000-4000-8000-${number.toString(16).padStart(12, '0')}`;
const sourceId = id(1000);
const ownerId = id(2000);
const timestamp = (second) => `2026-07-21T00:${Math.floor(second / 60).toString().padStart(2, '0')}:${(second % 60).toString().padStart(2, '0')}.000000Z`;
const objectIds = (page) => page.items.map((object) => object.id);

before(async () => {
  if (process.env.ORBIT_TEST_DATABASE_URL) {
    const admin = new Pool({ connectionString: process.env.ORBIT_TEST_DATABASE_URL });
    const schema = `orbit_related_test_${process.pid}_${randomBytes(6).toString('hex')}`;
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({
      connectionString: process.env.ORBIT_TEST_DATABASE_URL,
      options: `-c search_path=${schema} -c timezone=UTC`
    });
    cleanup = async () => {
      await pool.end();
      try {
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await admin.end();
      }
    };
  } else {
    database = new PGlite();
    pool = { query: (sql, values) => database.query(sql, values) };
    cleanup = () => database.close();
  }

  for (const migration of ['0002_orbit_objects.sql', '0004_orbit_relationships.sql']) {
    const sql = await readFile(new URL(`../../../infrastructure/postgres/migrations/${migration}`, import.meta.url), 'utf8');
    await pool.query(sql);
  }
  queryService = new PostgresQueryService(pool);
  searchService = new PostgresSearchService(pool);
  relationshipService = new PostgresRelationshipService(
    { relationshipRepository: {} },
    queryService,
    searchService,
    {}
  );
});

after(async () => { await cleanup?.(); });

beforeEach(async () => {
  await pool.query('TRUNCATE orbit_relationships, orbit_objects');
  relationshipSequence = 3000;
});

async function addObject(number, overrides = {}) {
  const object = {
    id: id(number),
    title: 'Matching evidence',
    objectType: 'evidence',
    status: 'active',
    ownerId,
    createdAt: timestamp(number % 600),
    ...overrides
  };
  await pool.query(
    `INSERT INTO orbit_objects (id, title, object_type, status, owner_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [object.id, object.title, object.objectType, object.status, object.ownerId, object.createdAt]
  );
  return object;
}

async function relate(source, target, type = 'supports') {
  await pool.query(
    `INSERT INTO orbit_relationships (id, source_object_id, target_object_id, relationship_type)
     VALUES ($1, $2, $3, $4)`,
    [id(relationshipSequence++), source, target, type]
  );
}

async function collectPages(getPage) {
  const items = [];
  const cursors = new Set();
  const sizes = [];
  let cursor;
  do {
    const page = await getPage(cursor);
    sizes.push(page.items.length);
    items.push(...objectIds(page));
    cursor = page.nextCursor;
    if (cursor) {
      assert.ok(page.items.length > 0, 'A next cursor must follow a nonempty matching page');
      assert.ok(!cursors.has(cursor), 'Successive pages must advance their cursor');
      cursors.add(cursor);
      assert.ok(cursors.size < 100, 'Pagination must terminate');
    }
  } while (cursor);
  assert.equal(new Set(items).size, items.length, 'Objects must not repeat within or across pages');
  return { items, sizes };
}

test('related search returns all 60 matches across the default 25-item pages', async () => {
  await addObject(1000, { title: 'Anchor', createdAt: timestamp(500) });
  for (let number = 1; number <= 60; number++) {
    await addObject(number);
    await relate(sourceId, id(number));
  }
  // Newer global matches occupy the independent search's first page.
  for (let number = 100; number < 140; number++) await addObject(number);

  const result = await collectPages((cursor) => relationshipService.getRelatedObjects({
    sourceObjectId: sourceId,
    relationshipType: 'supports',
    searchRequest: { query: 'matching' },
    ...(cursor ? { cursor } : {})
  }));
  assert.deepEqual(result.items, Array.from({ length: 60 }, (_, index) => id(60 - index)));
  assert.deepEqual(result.sizes, [25, 25, 10]);
});

test('search filters apply before the related-object page limit', async () => {
  await addObject(1000, { title: 'Anchor' });
  for (let number = 1; number <= 30; number++) {
    await addObject(number);
    await relate(sourceId, id(number));
  }
  for (let number = 100; number < 145; number++) {
    await addObject(number, { title: 'Unrelated title' });
    await relate(sourceId, id(number));
  }
  const result = await collectPages((cursor) => relationshipService.getRelatedObjects({
    sourceObjectId: sourceId, searchRequest: { query: 'MATCHING' }, limit: 10,
    ...(cursor ? { cursor } : {})
  }));
  assert.deepEqual(result.items, Array.from({ length: 30 }, (_, index) => id(30 - index)));
  assert.deepEqual(result.sizes, [10, 10, 10]);
});

test('title, type, status, owner and relationship filters intersect in one query', async () => {
  await addObject(1000);
  for (let number = 1; number <= 35; number++) {
    await addObject(number);
    await relate(sourceId, id(number));
    await relate(sourceId, id(number), 'mentions');
  }
  const excluded = [
    { title: 'Other title' }, { objectType: 'person' }, { status: 'draft' }, { ownerId: id(2001) }
  ];
  for (const [index, overrides] of excluded.entries()) {
    await addObject(100 + index, overrides);
    await relate(sourceId, id(100 + index));
  }
  await addObject(200);
  await relate(sourceId, id(200), 'mentions');
  await addObject(201); // Matches the search but has no relationship.

  const searchRequest = { query: 'eViDeNcE', objectType: 'evidence', status: 'active', ownerId };
  const result = await collectPages((cursor) => relationshipService.getRelatedObjects({
    sourceObjectId: sourceId, relationshipType: 'supports', searchRequest, limit: 12,
    ...(cursor ? { cursor } : {})
  }));
  assert.deepEqual(result.items, Array.from({ length: 35 }, (_, index) => id(35 - index)));
  assert.deepEqual(result.sizes, [12, 12, 11]);
  const global = await collectPages((cursor) => searchService.search({ ...searchRequest, limit: 12, ...(cursor ? { cursor } : {}) }));
  assert.deepEqual(result.items, global.items.filter((objectId) => ![id(1000), id(200), id(201)].includes(objectId)));
});

test('an empty search request behaves like no search request, with one outer cursor', async () => {
  await addObject(1000);
  for (let number = 1; number <= 7; number++) {
    await addObject(number);
    await relate(sourceId, id(number));
  }
  const unfiltered = await collectPages((cursor) => relationshipService.getRelatedObjects({
    sourceObjectId: sourceId, limit: 3, ...(cursor ? { cursor } : {})
  }));
  const emptySearch = await collectPages((cursor) => relationshipService.getRelatedObjects({
    sourceObjectId: sourceId, limit: 3, searchRequest: {}, ...(cursor ? { cursor } : {})
  }));
  assert.deepEqual(emptySearch, unfiltered);
  assert.deepEqual(emptySearch.items, [7, 6, 5, 4, 3, 2, 1].map(id));
});

test('nested search pagination does not override related-object pagination', async () => {
  await addObject(1000);
  for (let number = 1; number <= 4; number++) {
    await addObject(number);
    await relate(sourceId, id(number));
  }
  const result = await collectPages((cursor) => relationshipService.getRelatedObjects({
    sourceObjectId: sourceId, limit: 2,
    searchRequest: { query: 'matching', limit: 1, cursor: 'not-a-related-object-cursor' },
    ...(cursor ? { cursor } : {})
  }));
  assert.deepEqual(result.items, [4, 3, 2, 1].map(id));
  assert.deepEqual(result.sizes, [2, 2]);
});

test('related search does not issue a second independently paginated global search', async () => {
  await addObject(1);
  await addObject(2);
  await relate(id(1), id(2));
  const service = new PostgresRelationshipService(
    { relationshipRepository: {} }, queryService,
    { search: () => { throw new Error('Unexpected separate global search'); } }, {}
  );
  assert.deepEqual(objectIds(await service.getRelatedObjects({
    sourceObjectId: id(1), searchRequest: { query: 'matching' }
  })), [id(2)]);
});

test('source filters return targets and target filters return sources', async () => {
  for (const number of [1, 2, 3, 4]) await addObject(number);
  await relate(id(1), id(2));
  await relate(id(1), id(3));
  await relate(id(4), id(1));
  assert.deepEqual(objectIds(await queryService.findByRelationship({ sourceObjectId: id(1) })), [id(3), id(2)]);
  assert.deepEqual(objectIds(await queryService.findByRelationship({ targetObjectId: id(1) })), [id(4)]);
});

test('both endpoint filters constrain the same edge and return its target', async () => {
  for (const number of [1, 2, 3]) await addObject(number);
  await relate(id(1), id(2));
  await relate(id(1), id(3), 'mentions');
  assert.deepEqual(objectIds(await queryService.findByRelationship({ sourceObjectId: id(1), targetObjectId: id(2), relationshipType: 'supports' })), [id(2)]);
  assert.deepEqual(objectIds(await queryService.findByRelationship({ sourceObjectId: id(1), targetObjectId: id(3), relationshipType: 'supports' })), []);
});

test('multiple relationship types and shared endpoints cannot duplicate result objects', async () => {
  for (const number of [1, 2, 3, 4]) await addObject(number);
  for (const type of ['supports', 'mentions', 'owns']) {
    await relate(id(1), id(2), type);
    await relate(id(1), id(3), type);
  }
  await relate(id(4), id(2));
  const result = await collectPages((cursor) => queryService.findByRelationship({
    sourceObjectId: id(1), limit: 1, ...(cursor ? { cursor } : {})
  }));
  assert.deepEqual(result.items, [id(3), id(2)]);
  assert.deepEqual(result.sizes, [1, 1]);
});

test('empty relationship filters paginate both endpoints once and omit isolated objects', async () => {
  for (let number = 1; number <= 9; number++) await addObject(number);
  await relate(id(8), id(1));
  await relate(id(7), id(2));
  await relate(id(6), id(3));
  await relate(id(5), id(4));
  await relate(id(8), id(2), 'mentions');
  await relate(id(4), id(4), 'self');
  const result = await collectPages((cursor) => queryService.findByRelationship({ limit: 3, ...(cursor ? { cursor } : {}) }));
  assert.deepEqual(result.items, [8, 7, 6, 5, 4, 3, 2, 1].map(id));
  assert.deepEqual(result.sizes, [3, 3, 2]);
  const byType = await collectPages((cursor) => queryService.findByRelationship({ relationshipType: 'mentions', limit: 1, ...(cursor ? { cursor } : {}) }));
  assert.deepEqual(byType.items, [id(8), id(2)]);
});

test('self relationships return one object in either direction', async () => {
  await addObject(1);
  await relate(id(1), id(1), 'self');
  for (const query of [{}, { sourceObjectId: id(1) }, { targetObjectId: id(1) }]) {
    assert.deepEqual(objectIds(await queryService.findByRelationship(query)), [id(1)]);
  }
});

test('an unanchored cursor applies to both relationship endpoints', async () => {
  for (const number of [1, 2, 3, 4]) await addObject(number);
  await relate(id(3), id(1));
  await relate(id(4), id(2));
  const cursor = Buffer.from(`${timestamp(3)}|${id(3)}`).toString('base64');
  const page = await queryService.findByRelationship({ cursor });
  assert.deepEqual(objectIds(page), [id(2), id(1)]);
  assert.equal(page.nextCursor, undefined);
});

test('equal timestamps use descending IDs and an exact final page has no next cursor', async () => {
  await addObject(1000);
  for (const number of [1, 2, 3, 4]) {
    await addObject(number, { createdAt: timestamp(1) });
    await relate(sourceId, id(number));
  }
  const first = await queryService.findByRelationship({ sourceObjectId: sourceId, limit: 2 });
  assert.deepEqual(objectIds(first), [id(4), id(3)]);
  assert.ok(first.nextCursor);
  const last = await queryService.findByRelationship({ sourceObjectId: sourceId, limit: 2, cursor: first.nextCursor });
  assert.deepEqual(objectIds(last), [id(2), id(1)]);
  assert.equal(last.nextCursor, undefined);
});

test('related, type and global search cursors preserve database microseconds', async () => {
  await addObject(1000, { objectType: 'collection' });
  const times = ['.123456Z', '.123400Z', '.123300Z'];
  for (const [index, fraction] of times.entries()) {
    await addObject(index + 1, { createdAt: `2026-07-21T00:00:01${fraction}` });
    await relate(sourceId, id(index + 1));
  }
  for (const getPage of [
    (cursor) => queryService.findByRelationship({ sourceObjectId: sourceId, limit: 1, ...(cursor ? { cursor } : {}) }),
    (cursor) => queryService.findByType('evidence', { limit: 1, ...(cursor ? { cursor } : {}) }),
    (cursor) => searchService.search({ objectType: 'evidence', limit: 1, ...(cursor ? { cursor } : {}) })
  ]) {
    const result = await collectPages(getPage);
    assert.deepEqual(result.items, [id(1), id(2), id(3)]);
  }
});

test('empty global search filters paginate all objects consistently', async () => {
  for (let number = 1; number <= 6; number++) await addObject(number);
  const result = await collectPages((cursor) => searchService.search({ limit: 2, ...(cursor ? { cursor } : {}) }));
  assert.deepEqual(result.items, [6, 5, 4, 3, 2, 1].map(id));
  assert.deepEqual(result.sizes, [2, 2, 2]);
});

test('no matching relationships or search filters produce an empty terminal page', async () => {
  await addObject(1);
  await addObject(2);
  await relate(id(1), id(2));
  for (const query of [
    { sourceObjectId: id(9) },
    { sourceObjectId: id(1), searchRequest: { query: 'not present' } },
    { sourceObjectId: id(1), searchRequest: { status: 'archived' } }
  ]) {
    assert.deepEqual(await relationshipService.getRelatedObjects(query), { items: [] });
  }
});

test('invalid page limits and malformed cursors reject consistently', async () => {
  const queries = [
    (request) => queryService.findByRelationship(request),
    (request) => queryService.findByType('evidence', request),
    (request) => searchService.search(request)
  ];
  for (const getPage of queries) {
    for (const limit of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
      await assert.rejects(getPage({ limit }), /Page limit must be a positive safe integer/);
    }
    for (const cursor of [
      '', 'not-base64',
      Buffer.from(`not-a-timestamp|${id(1)}`).toString('base64'),
      Buffer.from(`${timestamp(1)}|not-a-uuid`).toString('base64'),
      Buffer.from(`${timestamp(1)}|${id(1)}|extra`).toString('base64')
    ]) {
      await assert.rejects(getPage({ cursor }), /Invalid cursor/);
    }
  }
});
