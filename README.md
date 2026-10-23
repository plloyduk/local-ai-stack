# Local AI Stack

Make it possible for anyone to run a simple AI app that can do document Q&A **100% locally** without having to swipe a credit card 💳. Based on [AI Starter Kit](https://github.com/a16z-infra/ai-getting-started). 

<img width="600" alt="Screen Shot 2023-10-30 at 10 20 17 PM" src="https://github.com/ykhli/local-ai-stack/assets/3489963/b4a7eddb-e655-45c3-93d4-fbb26e94a96c">

Have questions? Join [AI Stack devs](https://discord.gg/TsWCNVvRP5) and find me in #local-ai-stack channel.

## Stack

- 🦙 Inference: [Ollama](https://github.com/jmorganca/ollama)
- 💻 VectorDB: [Supabase pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)
- 🧠 Retrieval and inference: direct Supabase, Pinecone, OpenAI and Ollama APIs
- 🖼️ App logic: [Next.js](https://nextjs.org/)

## Quickstart

### 1. Fork and Clone repo

Fork the repo to your Github account, then run the following command to clone the repo:

```
git clone git@github.com:[YOUR_GITHUB_ACCOUNT_NAME]/local-ai-stack.git
```

### 2. Install dependencies

Use Node.js 22.15 or newer. Install the checked-in dependency versions with `npm ci`.

```
cd local-ai-stack
npm ci
```

### 3. Install Ollama

Instructions are [here](https://github.com/jmorganca/ollama#macos)

### 4. Run Supabase locally

1. Install Supabase CLI

```
brew install supabase/tap/supabase
```

2. Start Supabase
  
Make sure you are under `/local-ai-stack` directory and run:
```
supabase start
```

### 5. Fill in secrets

```
cp .env.local.example .env.local
```
Then get `SUPABASE_PRIVATE_KEY` by running
```
supabase status
```
Copy `anon key` and save it as `SUPABASE_PRIVATE_KEY` in `.env.local`


### 6. Generate embeddings

```bash
node src/scripts/indexBlogLocal.mjs
```
This script takes in all files from /blogs, generate embeddings using [transformers.js](https://github.com/xenova/transformers.js), and store embeddings as well as metadata in Supabase.

The local path still uses `Xenova/all-MiniLM-L6-v2`, mean pooling and normalized
384-dimensional vectors. The maintained `@huggingface/transformers` package replaces
`@xenova/transformers`; existing locally generated vectors stay compatible. On its
first run it downloads the model, then runs inference locally.

### 7. Run app locally

Now you are ready to test out the app locally! To do this, simply run `npm run dev` under the project root and visit `http://localhost:3000`.

### 6. Deploy the app

If you want to the the local-only app to the next level, feel free to follow instructions on [AI Starter Kit](https://github.com/a16z-infra/ai-getting-started) for using Clerk, Pinecone/Supabase, OpenAI, Replicate and other cloud-based vendors.

## Optional cloud paths and upgrade compatibility

- `/api/qa-pg-vector` uses local embeddings and Ollama when `OLLAMA_URL` is set,
  preserving `OLLAMA_MODEL` (default `ollama`) and the three-document search.
  Remove `OLLAMA_URL` to use OpenAI embeddings and streaming OpenAI answers instead.
- `/api/qa-pinecone` uses `OPENAI_API_KEY`, `PINECONE_API_KEY` and `PINECONE_INDEX`.
  The current Pinecone SDK discovers the index host from its name;
  `PINECONE_ENVIRONMENT` is no longer required. Existing vectors retain their
  `text`, `fileName` and `chunkIndex` metadata.
- `npm run generate-embeddings-local` indexes all blogs into local Supabase.
  `npm run generate-embeddings-supabase` indexes with OpenAI embeddings instead;
  `npm run generate-embeddings-pinecone` indexes into Pinecone. Both OpenAI
  indexers require `OPENAI_API_KEY` and still use `text-embedding-ada-002`
  (1536 dimensions). The supplied Supabase migration is for local 384-dimensional
  embeddings: use a separate 1536-dimensional table and matching `match_documents`
  function when choosing the OpenAI path. Do not mix the two embedding spaces.
- Cloud answers retain the existing `gpt-3.5-turbo-16k` model. That model must be
  available to the configured OpenAI account. Both QA endpoints return plain text;
  the client explicitly selects the AI SDK's text stream protocol.
- The optional `/sign-in` and `/sign-up` pages use Clerk. Set
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to use them; the local
  document-QA workflow does not require Clerk credentials.
- The optional Supabase embedding Edge Function retains `Supabase/gte-small`;
  it uses a different embedding space from MiniLM despite sharing its 384-vector
  size. Pair each index with the same embedding model at query time.

Run `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run build` to verify
the application. Tests use synthetic data and never call paid providers or
download embedding models.

## Refs & Credits
- [AI SDK](https://sdk.vercel.ai/docs)
- [LangUI](https://www.langui.dev/components)
- [Tailwind CSS](https://tailwindcss.com/)
- [a16z AI starter kit](https://github.com/a16z-infra/ai-getting-started)
- https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/pinecone
- https://js.langchain.com/docs/modules/models/llms/integrations#replicate
- https://js.langchain.com/docs/modules/chains/index_related_chains/retrieval_qa
