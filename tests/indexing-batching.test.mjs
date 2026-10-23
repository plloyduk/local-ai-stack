import assert from 'node:assert/strict';
import { test } from 'node:test';
import { embedOpenAIDocuments } from '../src/lib/qa.mjs';
import { indexSupabaseDocuments, indexPineconeDocuments } from '../src/lib/indexing.mjs';

function fakeOpenAI(calls) {
  return { embeddings: { create: async ({ model, input }) => {
    assert.equal(model, 'text-embedding-ada-002');
    calls.push(input);
    return { data: input.map(text => ({ embedding: Array(1536).fill(Number(text.split(' ')[1])) })) };
  } } };
}

test('Supabase and Pinecone indexing send document batches to OpenAI and keep vectors aligned', async () => {
  const docs = Array.from({ length: 64 }, (_, i) => ({ pageContent: `Document\n${i}`, metadata: { fileName: `${i}.md` } }));
  const calls = [];
  const client = fakeOpenAI(calls);
  const embed = texts => embedOpenAIDocuments(client, texts);
  const database = { from: () => ({ insert: async rows => {
    assert.equal(rows.length, 64);
    assert.ok(rows.every(row => row.embedding.length === 1536));
    assert.deepEqual(rows.map(row => row.embedding[0]), Array.from({ length: 64 }, (_, i) => i));
    return { error: null };
  } }) };
  await indexSupabaseDocuments(database, docs, embed);
  assert.equal(calls.length, 1);
  const index = { upsert: async ({ records }) => {
    assert.ok(records.every(record => record.values.length === 1536));
    assert.deepEqual(records.map(record => record.values[0]), Array.from({ length: 64 }, (_, i) => i));
    assert.equal(records[0].metadata.text, 'Document\n0');
  } };
  await indexPineconeDocuments(index, docs, embed);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(input => input.length === 64 && input.every(text => !text.includes('\n'))));
});

test('OpenAI indexing preserves the previous 512-document and two-request limits', async () => {
  let active = 0;
  let maximum = 0;
  const calls = [];
  const client = { embeddings: { create: async ({ input }) => {
    calls.push(input.length);
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setImmediate(resolve));
    active -= 1;
    return { data: input.map(text => ({ embedding: [Number(text)] })) };
  } } };
  const vectors = await embedOpenAIDocuments(client, Array.from({ length: 1025 }, (_, i) => String(i)));
  assert.deepEqual(calls, [512, 512, 1]);
  assert.equal(maximum, 2);
  assert.deepEqual(vectors.map(vector => vector[0]), Array.from({ length: 1025 }, (_, i) => i));
});
