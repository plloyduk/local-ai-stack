import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import { embedOpenAI, searchPinecone, answerOpenAI } from "@/lib/qa.mjs";

export async function POST(request: Request) {
  const { prompt } = await request.json();
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY || "" });
  const index = pinecone.index({ name: process.env.PINECONE_INDEX || "" });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const context = await searchPinecone(index, await embedOpenAI(openai, prompt));
  return answerOpenAI(openai, prompt, context, request.signal);
}
