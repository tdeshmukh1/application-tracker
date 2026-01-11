# Application Tracker

Track job applications by syncing Gmail, classifying emails, and organizing them into Applied/Accepted/Rejected columns.

## Setup

1. Copy the env template:
   - `copy .env.local.example .env.local`
2. Fill in values in `.env.local`.
3. Install dependencies and run the app:

```bash
pnpm install
pnpm dev
```

## LLM Classification (OpenAI vs Ollama)

The classifier runs in `src/lib/gptClassifier.ts` and is controlled by env vars.

Set one of these in `.env.local`:

### Ollama (local, free)
```
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

### OpenAI (cloud)
```
LLM_PROVIDER=openai
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-4o-mini
```

## Env Template

Use `.env.local.example` as the canonical template. It is tracked in git and safe for public repos. Do not commit `.env.local`.

## Next Steps

- Add per-user isolation (scope applications by user id).
- Improve Gmail parsing (thread handling, better company/role extraction).
- Add sync metadata (last sync time, progress, error details).
- Background sync (cron/queue) instead of manual-only.
