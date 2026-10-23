import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';

test('local embeddings recover after a failed model load and reuse successful initialization', async () => {
  globalThis.__embeddingRecoveryAttempts = 0;
  const source = `export async function pipeline() {
    globalThis.__embeddingRecoveryAttempts += 1;
    if (globalThis.__embeddingRecoveryAttempts === 1) throw new Error('Synthetic model load failure');
    return async () => ({ data: new Float32Array(384).fill(0.5) });
  }`;
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === '@huggingface/transformers') return {
        url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true,
      };
      return nextResolve(specifier, context);
    },
  });
  try {
    const { generateEmbedding } = await import('../src/lib/embedding.mjs');
    await assert.rejects(generateEmbedding('First document'), /Synthetic model load failure/);
    assert.equal((await generateEmbedding('Second document')).length, 384);
    assert.equal((await generateEmbedding('Third document')).length, 384);
    assert.equal(globalThis.__embeddingRecoveryAttempts, 2);
  } finally {
    hook.deregister();
    delete globalThis.__embeddingRecoveryAttempts;
  }
});
