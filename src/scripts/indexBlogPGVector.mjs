import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { embedOpenAIDocuments } from "../lib/qa.mjs";
import { loadMarkdownDocuments, indexSupabaseDocuments } from "../lib/indexing.mjs";

dotenv.config({ path: ".env.local" });

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PRIVATE_KEY, {
  auth: { detectSessionInUrl: false, persistSession: false, autoRefreshToken: false },
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
await indexSupabaseDocuments(client, await loadMarkdownDocuments("blogs"), (contents) => embedOpenAIDocuments(openai, contents));
