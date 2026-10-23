import { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/embedding.mjs";

export { generateEmbedding };

export async function vectorSearch(client: SupabaseClient, contentToSearch: string) {
  const { data, error } = await client.rpc("match_documents", {
    query_embedding: await generateEmbedding(contentToSearch),
    match_count: 3,
  });
  if (error) throw error;
  return data ?? [];
}

export async function generateEmbeddingSupabase(content: string) {
  const response = await fetch(process.env.SUPABASE_EMBEDDING_ENDPOINT!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_PRIVATE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: content }),
  });
  const json = await response.json();
  return json.embedding;
}
