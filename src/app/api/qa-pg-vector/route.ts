import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { generateEmbedding } from "@/lib/embedding.mjs";
import { embedOpenAI, searchSupabase, answerOpenAI, answerOllama } from "@/lib/qa.mjs";

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const privateKey = process.env.SUPABASE_PRIVATE_KEY;
  if (!privateKey) throw new Error("Expected env var SUPABASE_PRIVATE_KEY");
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("Expected env var SUPABASE_URL");
  const client = createClient(url, privateKey, {
    auth: { detectSessionInUrl: false, persistSession: false, autoRefreshToken: false },
  });

  if (process.env.OLLAMA_URL) {
    const context = await searchSupabase(client, await generateEmbedding(prompt), 3);
    return answerOllama(process.env.OLLAMA_URL, process.env.OLLAMA_MODEL, prompt, context, req.signal);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const context = await searchSupabase(client, await embedOpenAI(openai, prompt), 1);
  return answerOpenAI(openai, prompt, context, req.signal);
}
