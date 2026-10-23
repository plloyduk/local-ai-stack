import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";

test("local embeddings retain the MiniLM model, mean pooling and normalized vector shape", async () => {
  const calls = [];
  globalThis.__localEmbeddingCalls = calls;
  const source = `export async function pipeline(...args) {
    globalThis.__localEmbeddingCalls.push(args);
    return async (...input) => {
      globalThis.__localEmbeddingCalls.push(input);
      return { data: new Float32Array(384).fill(0.5) };
    };
  }`;
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "@huggingface/transformers") {
        return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
  try {
    const { generateEmbedding } = await import("../src/lib/embedding.mjs");
    const vector = await generateEmbedding("Synthetic document");
    await generateEmbedding("Second document");
    assert.deepEqual(calls[0], ["feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" }]);
    assert.deepEqual(calls[1], ["Synthetic document", { pooling: "mean", normalize: true }]);
    assert.deepEqual(calls[2], ["Second document", { pooling: "mean", normalize: true }]);
    assert.equal(calls.length, 3);
    assert.equal(vector.length, 384);
    assert.ok(Array.isArray(vector));
    assert.equal(vector[0], 0.5);
  } finally {
    hook.deregister();
    delete globalThis.__localEmbeddingCalls;
  }
});
