import { pipeline } from "@huggingface/transformers";

let extractor;

export async function generateEmbedding(content) {
  extractor ??= pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" }).catch((error) => {
    extractor = undefined;
    throw error;
  });
  const extract = await extractor;
  const output = await extract(content, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}
