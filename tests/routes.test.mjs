import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { registerHooks } from 'node:module';

const modules = {
  'dotenv': 'export default { config() {} };',
  '@supabase/supabase-js': 'export function createClient() { return globalThis.__qaRouteFixture.database; }',
  'openai': 'export default class OpenAI { constructor() { return globalThis.__qaRouteFixture.openai; } }',
  '@pinecone-database/pinecone': 'export class Pinecone { index() { return globalThis.__qaRouteFixture.index; } }',
  '@huggingface/transformers': 'export async function pipeline() { return async () => ({ data: new Float32Array(384).fill(0.5) }); }',
};
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (modules[specifier]) return { url: 'data:text/javascript,' + encodeURIComponent(modules[specifier]), shortCircuit: true };
    if (specifier.startsWith('@/')) return { url: new URL('../src/' + specifier.slice(2), import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const supabase = await import('../src/app/api/qa-pg-vector/route.ts');
const pinecone = await import('../src/app/api/qa-pinecone/route.ts');
const request = () => new Request('http://test.invalid/api/qa', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Synthetic question?' }),
});
function configure() {
  const names = ['SUPABASE_URL', 'SUPABASE_PRIVATE_KEY', 'OPENAI_API_KEY', 'PINECONE_API_KEY', 'PINECONE_INDEX', 'OLLAMA_URL', 'OLLAMA_MODEL'];
  const old = new Map(names.map(name => [name, process.env[name]]));
  process.env.SUPABASE_URL = 'http://test.invalid';
  process.env.SUPABASE_PRIVATE_KEY = 'synthetic-test-value';
  process.env.OPENAI_API_KEY = 'synthetic-test-value';
  process.env.PINECONE_API_KEY = 'synthetic-test-value';
  process.env.PINECONE_INDEX = 'synthetic-index';
  delete process.env.OLLAMA_URL;
  delete process.env.OLLAMA_MODEL;
  const calls = [];
  globalThis.__qaRouteFixture = {
    openai: {
      embeddings: { create: async ({ input }) => {
        assert.equal(input, 'Synthetic question?');
        return { data: [{ embedding: Array(1536).fill(0.25) }] };
      } },
      chat: { completions: { create: async ({ messages }) => {
        assert.match(messages[0].content, /Synthetic source/);
        assert.match(messages[0].content, /Synthetic question/);
        return (async function* () { yield { choices: [{ delta: { content: 'Answer ✓' } }] }; })();
      } } },
    },
    database: { rpc: async (name, args) => { calls.push([name, args]); return { data: [{ content: 'Synthetic source' }], error: null }; } },
    index: { query: async args => { calls.push(args); return { matches: [{ metadata: { text: 'Synthetic source' } }] }; } },
  };
  return { calls, restore() {
    for (const [name, value] of old) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    delete globalThis.__qaRouteFixture;
  } };
}

test('Supabase OpenAI endpoint retrieves matching vectors and returns browser text protocol', async () => {
  const fixture = configure();
  try {
    const response = await supabase.POST(request());
    assert.equal(await response.text(), 'Answer ✓');
    assert.match(response.headers.get('content-type'), /^text\/plain/);
    assert.equal(fixture.calls[0][0], 'match_documents');
    assert.equal(fixture.calls[0][1].query_embedding.length, 1536);
    assert.equal(fixture.calls[0][1].match_count, 1);
  } finally { fixture.restore(); }
});

test('Ollama endpoint keeps local vectors and the three-document retrieval path', async () => {
  const fixture = configure();
  process.env.OLLAMA_URL = 'http://ollama.invalid';
  const fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://ollama.invalid/api/generate');
    assert.match(JSON.parse(options.body).prompt, /Synthetic source/);
    return Response.json({ response: 'Local answer' });
  });
  try {
    assert.equal(await (await supabase.POST(request())).text(), 'Local answer');
    assert.equal(fixture.calls[0][1].query_embedding.length, 384);
    assert.equal(fixture.calls[0][1].match_count, 3);
  } finally { fetchMock.mock.restore(); fixture.restore(); }
});

test('Pinecone endpoint retrieves text metadata with OpenAI vectors and streams the answer', async () => {
  const fixture = configure();
  try {
    assert.equal(await (await pinecone.POST(request())).text(), 'Answer ✓');
    assert.equal(fixture.calls[0].vector.length, 1536);
    assert.equal(fixture.calls[0].topK, 1);
    assert.equal(fixture.calls[0].includeMetadata, true);
  } finally { fixture.restore(); }
});

test.after(() => hook.deregister());
