import dotenv from "dotenv";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import { embedOpenAIDocuments } from "../lib/qa.mjs";
import { loadPineconeDocuments, indexPineconeDocuments } from "../lib/indexing.mjs";

dotenv.config({ path: ".env.local" });

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index({ name: process.env.PINECONE_INDEX });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
await indexPineconeDocuments(index, await loadPineconeDocuments("blogs"), (contents) => embedOpenAIDocuments(openai, contents));
