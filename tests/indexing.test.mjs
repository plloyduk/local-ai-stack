import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  loadMarkdownDocuments,
  loadPineconeDocuments,
  indexSupabaseDocuments,
  indexPineconeDocuments,
} from "../src/lib/indexing.mjs";

test("both Supabase indexers include all blog files and preserve content and metadata", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "local-ai-blogs-"));
  try {
    await writeFile(path.join(directory, "one.md"), "# First\n\nFirst blog.");
    await writeFile(path.join(directory, "two.md"), "# Second\n\nSecond blog.");
    const docs = await loadMarkdownDocuments(directory);
    assert.deepEqual(docs.map((doc) => doc.metadata.fileName).sort(), ["one.md", "two.md"]);
    const client = { from: (table) => ({ insert: async (rows) => {
      assert.equal(table, "documents");
      assert.deepEqual(rows.map((row) => row.content).sort(), ["# First\n\nFirst blog.", "# Second\n\nSecond blog."]);
      assert.ok(rows.every((row) => row.embedding.length === 384 && row.metadata.fileName));
      return { error: null };
    } }) };
    await indexSupabaseDocuments(client, docs, async contents => contents.map(() => Array(384).fill(0)));
  } finally { await rm(directory, { recursive: true }); }
});

test("Pinecone indexing keeps 8191-character chunks and searchable text metadata", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "local-ai-pinecone-"));
  try {
    await writeFile(path.join(directory, "long.md"), "a".repeat(8192));
    const docs = await loadPineconeDocuments(directory);
    assert.deepEqual(docs.map((doc) => doc.pageContent.length), [8191, 1]);
    const index = { upsert: async ({ records }) => {
      assert.equal(records.length, 2);
      assert.ok(records.every((record) => record.id && record.values.length === 1536));
      assert.deepEqual(records.map((record) => record.metadata.chunkIndex), [0, 1]);
      assert.equal(records[0].metadata.text.length, 8191);
      assert.equal(records[1].metadata.fileName, "long.md");
    } };
    await indexPineconeDocuments(index, docs, async contents => contents.map(() => Array(1536).fill(0)));
  } finally { await rm(directory, { recursive: true }); }
});
