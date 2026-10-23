import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export async function loadMarkdownDocuments(directory) {
  const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", { chunkSize: 1000, chunkOverlap: 50 });
  const documents = await Promise.all((await readdir(directory)).map(async (fileName) => {
    const content = await readFile(path.join(directory, fileName), "utf8");
    return (await splitter.splitText(content)).map((pageContent) => ({ pageContent, metadata: { fileName } }));
  }));
  return documents.flat();
}

export async function loadPineconeDocuments(directory) {
  const documents = await Promise.all((await readdir(directory)).map(async (fileName) => {
    const content = await readFile(path.join(directory, fileName), "utf8");
    const chunks = [];
    for (let offset = 0; offset < content.length; offset += 8191) {
      chunks.push({ pageContent: content.slice(offset, offset + 8191), metadata: { fileName, chunkIndex: offset / 8191 } });
    }
    return chunks;
  }));
  return documents.flat();
}

export async function indexSupabaseDocuments(client, documents, embedDocuments) {
  const embeddings = await embedDocuments(documents.map(document => document.pageContent));
  const rows = documents.map((document, index) => ({
    content: document.pageContent,
    metadata: document.metadata,
    embedding: embeddings[index],
  }));
  const { error } = await client.from("documents").insert(rows);
  if (error) throw error;
}

export async function indexPineconeDocuments(index, documents, embedDocuments) {
  // Pinecone's vector API accepts batches of up to 1000; keep requests small
  // enough to preserve the original 8191-character text metadata too.
  for (let offset = 0; offset < documents.length; offset += 100) {
    const batch = documents.slice(offset, offset + 100);
    const embeddings = await embedDocuments(batch.map(document => document.pageContent));
    const records = batch.map((document, index) => ({
      id: randomUUID(),
      values: embeddings[index],
      metadata: { ...document.metadata, text: document.pageContent },
    }));
    await index.upsert({ records });
  }
}
