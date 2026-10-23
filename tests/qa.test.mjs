import assert from "node:assert/strict";
import { test, mock } from "node:test";
import {
  embedOpenAI,
  searchSupabase,
  searchPinecone,
  answerOpenAI,
  answerOllama,
} from "../src/lib/qa.mjs";

test("Supabase retrieval preserves the embedding and requested match count", async () => {
  const client = { rpc: async (name, args) => {
    assert.equal(name, "match_documents");
    assert.deepEqual(args, { query_embedding: [0.1, 0.2], match_count: 3 });
    return { data: [{ content: "Local context" }], error: null };
  } };
  assert.deepEqual(await searchSupabase(client, [0.1, 0.2], 3), ["Local context"]);
});

test("Pinecone retrieves one document using LangChain's existing text metadata field", async () => {
  const index = { query: async (args) => {
    assert.deepEqual(args, { vector: [1, 2], topK: 1, includeMetadata: true });
    return { matches: [{ metadata: { text: "Pinecone context", fileName: "blog.md" } }] };
  } };
  assert.deepEqual(await searchPinecone(index, [1, 2]), ["Pinecone context"]);
});

test("OpenAI embedding keeps the existing model and newline preprocessing", async () => {
  const client = { embeddings: { create: async (args) => {
    assert.deepEqual(args, { model: "text-embedding-ada-002", input: "first second" });
    return { data: [{ embedding: [0.5, -0.5] }] };
  } } };
  assert.deepEqual(await embedOpenAI(client, "first\nsecond"), [0.5, -0.5]);
});

test("OpenAI response streams raw UTF-8 text with context and the original QA instruction", async () => {
  const client = { chat: { completions: { create: async (args, options) => {
    assert.equal(args.model, "gpt-3.5-turbo-16k");
    assert.equal(args.stream, true);
    assert.match(args.messages[0].content, /don't know/);
    assert.match(args.messages[0].content, /source context/);
    assert.equal(args.messages[0].role, "user");
    assert.match(args.messages[0].content, /Question: Question\?\nHelpful Answer:$/);
    assert.ok(options.signal instanceof AbortSignal);
    return (async function* () {
      yield { choices: [{ delta: { role: "assistant" } }] };
      yield { choices: [{ delta: { content: "Answer " } }] };
      yield { choices: [{ delta: { content: "✓" } }] };
    })();
  } } } };
  const response = await answerOpenAI(client, "Question?", ["source context"], new AbortController().signal);
  assert.match(response.headers.get("content-type"), /^text\/plain/);
  assert.equal(await response.text(), "Answer ✓");
});

test("Ollama keeps its base URL, model, local context and plain-text response", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "http://localhost:11434/api/generate");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "llama2");
    assert.equal(body.stream, false);
    assert.match(body.prompt, /Question: Question\?/);
    assert.match(body.prompt, /Context: \["local source"\]/);
    return Response.json({ response: "Local answer" });
  });
  try {
    const response = await answerOllama("http://localhost:11434/", "llama2", "Question?", ["local source"]);
    assert.equal(await response.text(), "Local answer");
  } finally { fetchMock.mock.restore(); }
});
