# Multi-provider LLM gateway that returns JSON

**Problem:** One utility (`src/ai/LLMGateway.ts`) that sends a prompt to whichever LLM the company allows (Groq, OpenRouter, OpenAI, Anthropic, DeepSeek) and returns parsed JSON or writes it to a file.

## Approach
1. **Count the wire formats.** Five providers, only two dialects: Groq, OpenRouter, OpenAI and DeepSeek all use OpenAI `POST /chat/completions` with a Bearer token. Anthropic uses `POST /v1/messages` with `x-api-key`, `anthropic-version`, a top-level `system` field, and `content[]` blocks in the reply. So you need one registry table (key env, model env, default model, base URL, dialect, jsonMode flag) and two request builders and parsers, not five clients.
2. **Pick the provider in a fixed order:** explicit constructor arg, then `LLM_PROVIDER`, then the first provider with a key, free ones first. `LLM_ALLOWED_PROVIDERS` is the company allowlist, and it is enforced even when a provider is chosen explicitly.
3. **Get JSON on two layers.** Always add a "valid JSON only" system instruction. Send `response_format: json_object` only where it reliably works (Groq, OpenAI, DeepSeek). Then parse with a tolerant extractor in this order: direct parse, then a ```json fence, then a scan for the first balanced `{}` or `[]` that skips braces inside strings.
4. **Make failures clear.** Retry 429, 408, 5xx and network errors with exponential backoff. Fail fast on other 4xx codes. Throw a typed error that carries the raw body or model output so a bad reply can be debugged.
5. **Add no dependencies.** Node 22 has `fetch` and `AbortSignal.timeout` built in.

## Judgment calls (what was NOT done)
- **No `response_format` on OpenRouter.** Whether it is supported depends on the model, and the `:free` models change often. The prompt plus the tolerant parser works for every model.
- **No assistant prefill (`{`) for Claude.** Newer Claude models reject prefill. The system prompt plus the extractor is enough.
- **No provider SDKs** (`openai`, `@anthropic-ai/sdk`). That would mean five packages for two HTTP shapes.
- **No automatic fallback to another provider on failure.** Quietly switching to a provider that compliance did not choose would undo the point of the allowlist.
- **`src/ai/config/providers.ts` was left alone.** The reporter's `hasApiKey()` depends on it.

## Verification without keys
The only key in `.env` was empty. The `baseUrl` override let a throwaway spec point every provider at a local `http.createServer` mock. It checked the headers, `response_format` presence for each provider, the Anthropic body shape, a retry after a 429, fail-fast on a 401, the allowlist rejection, and the missing-key error.

## Follow-up: LLM test data repeats itself
`DataGenerator.checkoutCustomerAI()` sent the same prompt at temperature 1, and three calls in a row returned the same first name and ZIP ("Marisol", 63108). Turning up the temperature does not fix this. What fixed it was adding random values to the prompt: placeholders (`{{FIRST_INITIAL}}`, `{{LAST_INITIAL}}`, `{{STATE}}`) that Faker fills in before each call. Rule: when an LLM generates test data, vary the prompt itself on every call.

## Reusable rule
When asked for "N LLM providers", group them by wire format first (usually OpenAI-compatible plus Anthropic). Use the provider's JSON mode only where it is reliable, and always add a prompt instruction and a tolerant parser. Expose `baseUrl` so the whole thing can be tested against a local mock with no keys.
