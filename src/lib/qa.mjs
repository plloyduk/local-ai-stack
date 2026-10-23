export async function embedOpenAI(client, content) {
  const result = await client.embeddings.create({
    model: "text-embedding-ada-002",
    input: content.replace(/\n/g, " "),
  });
  return result.data[0].embedding;
}

export async function embedOpenAIDocuments(client, contents) {
  const batches = [];
  for (let offset = 0; offset < contents.length; offset += 512) {
    batches.push(contents.slice(offset, offset + 512).map(content => content.replace(/\n/g, " ")));
  }
  const embeddings = [];
  for (let offset = 0; offset < batches.length; offset += 2) {
    const responses = await Promise.all(batches.slice(offset, offset + 2).map(input =>
      client.embeddings.create({ model: "text-embedding-ada-002", input })
    ));
    embeddings.push(...responses.flatMap(response => response.data.map(row => row.embedding)));
  }
  return embeddings;
}

export async function searchSupabase(client, embedding, matchCount) {
  const { data, error } = await client.rpc("match_documents", {
    query_embedding: embedding,
    match_count: matchCount,
  });
  if (error) throw error;
  return (data ?? []).map((document) => document.content);
}

export async function searchPinecone(index, embedding) {
  const result = await index.query({ vector: embedding, topK: 1, includeMetadata: true });
  return (result.matches ?? []).map((match) => match.metadata?.text ?? "");
}

export async function answerOpenAI(client, prompt, context, signal) {
  const chunks = await client.chat.completions.create({
    model: "gpt-3.5-turbo-16k",
    stream: true,
    messages: [
      { role: "user", content: `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.\n\n${context.join("\n\n")}\n\nQuestion: ${prompt}\nHelpful Answer:` },
    ],
  }, { signal });
  const iterator = chunks[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value.choices[0]?.delta?.content ?? ""));
      } catch (error) { controller.error(error); }
    },
    async cancel() { await iterator.return?.(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function answerOllama(baseUrl, model, prompt, context, signal) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model: model || "ollama",
      stream: false,
      prompt: `Please answer the users question based on the following context. If you can't answer the question based on the context, say 'I don't know'.
    
    Question: ${prompt}
    
    Context: ${JSON.stringify(context)}`,
    }),
  });
  if (!response.ok) throw new Error(`Ollama request failed (${response.status})`);
  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return new Response(result.response, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
