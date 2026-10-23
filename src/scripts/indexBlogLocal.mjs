import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "../lib/embedding.mjs";
import { loadMarkdownDocuments, indexSupabaseDocuments } from "../lib/indexing.mjs";

dotenv.config({ path: ".env.local" });

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PRIVATE_KEY, {
  auth: { detectSessionInUrl: false, persistSession: false, autoRefreshToken: false },
});
await indexSupabaseDocuments(client, await loadMarkdownDocuments("blogs"), contents => Promise.all(contents.map(generateEmbedding)));
