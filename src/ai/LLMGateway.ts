/**
 * LLMGateway: one entry point for every LLM provider your company allows.
 *
 * Supported providers (pick whichever your company has approved):
 *   - groq        -> https://api.groq.com          (free tier, OpenAI-compatible)
 *   - openrouter  -> https://openrouter.ai         (free ":free" models, OpenAI-compatible)
 *   - openai      -> https://api.openai.com
 *   - anthropic   -> https://api.anthropic.com     (Claude, Messages API)
 *   - deepseek    -> https://api.deepseek.com      (direct API, OpenAI-compatible)
 *
 * Choosing a provider (first match wins):
 *   1. new LLMGateway({ provider: 'groq' })      explicit in code
 *   2. LLM_PROVIDER=groq                         in .env
 *   3. the first provider that has an API key, in the order of PROVIDER_ORDER
 *
 * Company policy: set LLM_ALLOWED_PROVIDERS=groq,openrouter and the gateway
 * refuses to call anything outside that list, even if a key for it is set.
 *
 * Usage:
 *   const llm = new LLMGateway();                           // auto from .env
 *   const { data } = await llm.askJson<{ cases: string[] }>(
 *       'Give 3 negative test cases for a login form as {"cases": [...]}',
 *   );
 *   await llm.askJsonToFile('...prompt...', 'reports/ai/login-cases.json');
 *   const text = await llm.ask('Explain this error: ...');   // plain text
 *
 * Uses Node's built-in fetch, so it needs no extra npm packages.
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from '../utils/logger';

const log = createLogger('LLMGateway');

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type LLMProvider = 'groq' | 'openrouter' | 'openai' | 'anthropic' | 'deepseek';

export interface LLMGatewayOptions {
    /** Which provider to call. Defaults to LLM_PROVIDER, then the first key found. */
    provider?: LLMProvider;
    /** Model id. Defaults to <PROVIDER>_MODEL from .env, then the built-in default. */
    model?: string;
    /** API key. Defaults to <PROVIDER>_API_KEY from .env. */
    apiKey?: string;
    /** Override the base URL (proxy, Azure-style gateway, self-hosted mirror). */
    baseUrl?: string;
    /** Per-request timeout in ms. Default 60s (LLM_TIMEOUT_MS). */
    timeoutMs?: number;
    /** Retries on 429 / 5xx / network errors. Default 2 (LLM_MAX_RETRIES). */
    maxRetries?: number;
}

export interface AskOptions {
    /** System prompt. askJson() appends its JSON-only instruction to this. */
    system?: string;
    /** 0 = deterministic. Default 0.2. */
    temperature?: number;
    /** Max output tokens. Default 2048. */
    maxTokens?: number;
}

export interface AskJsonOptions extends AskOptions {
    /** Also write the parsed JSON to this path (folders are created). */
    saveTo?: string;
}

export interface LLMUsage {
    inputTokens?: number;
    outputTokens?: number;
}

export interface LLMTextResponse {
    provider: LLMProvider;
    model: string;
    text: string;
    usage: LLMUsage;
    latencyMs: number;
}

export interface LLMJsonResponse<T = unknown> extends LLMTextResponse {
    /** The parsed JSON object/array. */
    data: T;
    /** Where the JSON was written, when saveTo was given. */
    savedTo?: string;
}

export class LLMGatewayError extends Error {
    constructor(
        message: string,
        public readonly provider?: LLMProvider,
        public readonly status?: number,
        /** Raw model output or HTTP body, for debugging. */
        public readonly raw?: string,
    ) {
        super(message);
        this.name = 'LLMGatewayError';
    }
}

// ----------------------------------------------------------------------------
// Provider registry
// ----------------------------------------------------------------------------

interface ProviderConfig {
    keyEnv: string;
    modelEnv: string;
    defaultModel: string;
    baseUrl: string;
    /** 'openai' = /chat/completions shape; 'anthropic' = /v1/messages shape. */
    api: 'openai' | 'anthropic';
    /** Whether to send response_format: { type: 'json_object' }. */
    jsonMode: boolean;
}

/**
 * Default models lean free/cheap. Override any of them with <PROVIDER>_MODEL
 * in .env, e.g. GROQ_MODEL=openai/gpt-oss-120b. OpenRouter rotates its ":free"
 * models, so check https://openrouter.ai/models?max_price=0 if one disappears.
 */
export const PROVIDERS: Record<LLMProvider, ProviderConfig> = {
    groq: {
        keyEnv: 'GROQ_API_KEY',
        modelEnv: 'GROQ_MODEL',
        defaultModel: 'llama-3.3-70b-versatile',
        baseUrl: 'https://api.groq.com/openai/v1',
        api: 'openai',
        jsonMode: true,
    },
    openrouter: {
        keyEnv: 'OPENROUTER_API_KEY',
        modelEnv: 'OPENROUTER_MODEL',
        defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
        baseUrl: 'https://openrouter.ai/api/v1',
        api: 'openai',
        // Not every OpenRouter model supports json_object; we rely on the
        // prompt + tolerant parser instead so any model works.
        jsonMode: false,
    },
    openai: {
        keyEnv: 'OPENAI_API_KEY',
        modelEnv: 'OPENAI_MODEL',
        defaultModel: 'gpt-4o-mini',
        baseUrl: 'https://api.openai.com/v1',
        api: 'openai',
        jsonMode: true,
    },
    anthropic: {
        keyEnv: 'ANTHROPIC_API_KEY',
        modelEnv: 'ANTHROPIC_MODEL',
        defaultModel: 'claude-haiku-5-5',
        baseUrl: 'https://api.anthropic.com',
        api: 'anthropic',
        jsonMode: false,
    },
    deepseek: {
        keyEnv: 'DEEPSEEK_API_KEY',
        modelEnv: 'DEEPSEEK_MODEL',
        defaultModel: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com',
        api: 'openai',
        jsonMode: true,
    },
};

/** Auto-detect order when neither provider nor LLM_PROVIDER is set. Free ones first. */
export const PROVIDER_ORDER: LLMProvider[] = ['groq', 'openrouter', 'deepseek', 'openai', 'anthropic'];

const JSON_INSTRUCTION =
    'Respond with valid JSON only. No markdown, no code fences, no commentary before or after the JSON.';

// ----------------------------------------------------------------------------
// Env helpers
// ----------------------------------------------------------------------------

const env = (name: string): string => (process.env[name] ?? '').trim();

const isProvider = (p: string): p is LLMProvider => p in PROVIDERS;

/** Providers the company allows (LLM_ALLOWED_PROVIDERS). Empty env = all allowed. */
export function allowedProviders(): LLMProvider[] {
    const raw = env('LLM_ALLOWED_PROVIDERS');
    if (!raw) return [...PROVIDER_ORDER];
    const list = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const unknown = list.filter((p) => !isProvider(p));
    if (unknown.length) {
        throw new LLMGatewayError(
            `LLM_ALLOWED_PROVIDERS has unknown provider(s): ${unknown.join(', ')}. ` +
                `Valid: ${Object.keys(PROVIDERS).join(', ')}`,
        );
    }
    return list as LLMProvider[];
}

/** Allowed providers that also have an API key set. */
export function availableProviders(): LLMProvider[] {
    const allowed = allowedProviders();
    return PROVIDER_ORDER.filter((p) => allowed.includes(p) && env(PROVIDERS[p].keyEnv).length > 0);
}

/** Resolve which provider to use, honouring explicit choice, LLM_PROVIDER and the allowlist. */
export function resolveProvider(explicit?: LLMProvider): LLMProvider {
    const allowed = allowedProviders();
    const requested = explicit ?? (env('LLM_PROVIDER').toLowerCase() || undefined);

    if (requested) {
        if (!isProvider(requested)) {
            throw new LLMGatewayError(
                `Unknown LLM provider "${requested}". Valid: ${Object.keys(PROVIDERS).join(', ')}`,
            );
        }
        if (!allowed.includes(requested)) {
            throw new LLMGatewayError(
                `Provider "${requested}" is not in LLM_ALLOWED_PROVIDERS (${allowed.join(', ')}).`,
                requested,
            );
        }
        return requested;
    }

    const first = availableProviders()[0];
    if (!first) {
        throw new LLMGatewayError(
            'No LLM provider configured. Set one of ' +
                allowed.map((p) => PROVIDERS[p].keyEnv).join(', ') +
                ' in .env (and optionally LLM_PROVIDER).',
        );
    }
    return first;
}

// ----------------------------------------------------------------------------
// JSON extraction
// ----------------------------------------------------------------------------

/**
 * Parse JSON out of a model reply. Handles the usual LLM habits: ```json fences,
 * a sentence before the object, or trailing commentary after it.
 */
export function extractJson<T = unknown>(text: string): T {
    const trimmed = text.trim();

    try {
        return JSON.parse(trimmed) as T;
    } catch {
        /* fall through to the tolerant paths */
    }

    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
        try {
            return JSON.parse(fence[1].trim()) as T;
        } catch {
            /* keep going */
        }
    }

    // First balanced {...} or [...] block, respecting strings and escapes.
    const start = trimmed.search(/[{[]/);
    if (start !== -1) {
        const open = trimmed[start];
        const close = open === '{' ? '}' : ']';
        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let i = start; i < trimmed.length; i++) {
            const ch = trimmed[i];
            if (inString) {
                if (escaped) escaped = false;
                else if (ch === '\\') escaped = true;
                else if (ch === '"') inString = false;
                continue;
            }
            if (ch === '"') inString = true;
            else if (ch === open) depth++;
            else if (ch === close && --depth === 0) {
                return JSON.parse(trimmed.slice(start, i + 1)) as T;
            }
        }
    }

    throw new Error('No valid JSON found in model output');
}

// ----------------------------------------------------------------------------
// Gateway
// ----------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class LLMGateway {
    readonly provider: LLMProvider;
    readonly model: string;
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly timeoutMs: number;
    private readonly maxRetries: number;
    private readonly cfg: ProviderConfig;

    constructor(opts: LLMGatewayOptions = {}) {
        this.provider = resolveProvider(opts.provider);
        this.cfg = PROVIDERS[this.provider];
        this.model = opts.model || env(this.cfg.modelEnv) || this.cfg.defaultModel;
        this.apiKey = opts.apiKey || env(this.cfg.keyEnv);
        this.baseUrl = (opts.baseUrl || this.cfg.baseUrl).replace(/\/+$/, '');
        this.timeoutMs = opts.timeoutMs ?? (Number(env('LLM_TIMEOUT_MS')) || 60_000);
        this.maxRetries = opts.maxRetries ?? (env('LLM_MAX_RETRIES') ? Number(env('LLM_MAX_RETRIES')) : 2);

        if (!this.apiKey) {
            throw new LLMGatewayError(
                `${this.cfg.keyEnv} is not set. Add it to .env to use provider "${this.provider}".`,
                this.provider,
            );
        }
    }

    /** Ask for plain text. */
    async ask(prompt: string, opts: AskOptions = {}): Promise<LLMTextResponse> {
        return this.complete(prompt, opts, false);
    }

    /** Ask for JSON and get it back parsed. Throws LLMGatewayError if the reply is not JSON. */
    async askJson<T = unknown>(prompt: string, opts: AskJsonOptions = {}): Promise<LLMJsonResponse<T>> {
        const system = opts.system ? `${opts.system}\n\n${JSON_INSTRUCTION}` : JSON_INSTRUCTION;
        const res = await this.complete(prompt, { ...opts, system }, true);

        let data: T;
        try {
            data = extractJson<T>(res.text);
        } catch {
            throw new LLMGatewayError(
                `${this.provider}/${this.model} did not return valid JSON`,
                this.provider,
                undefined,
                res.text,
            );
        }

        const out: LLMJsonResponse<T> = { ...res, data };
        if (opts.saveTo) out.savedTo = writeJson(opts.saveTo, data);
        return out;
    }

    /** Ask for JSON and write it to a file. Returns the same response as askJson(). */
    async askJsonToFile<T = unknown>(
        prompt: string,
        filePath: string,
        opts: AskOptions = {},
    ): Promise<LLMJsonResponse<T>> {
        return this.askJson<T>(prompt, { ...opts, saveTo: filePath });
    }

    // ------------------------------------------------------------------------

    private async complete(prompt: string, opts: AskOptions, wantJson: boolean): Promise<LLMTextResponse> {
        const temperature = opts.temperature ?? 0.2;
        const maxTokens = opts.maxTokens ?? 2048;
        const started = Date.now();

        const { url, headers, body } =
            this.cfg.api === 'anthropic'
                ? this.anthropicRequest(prompt, opts.system, temperature, maxTokens)
                : this.openAiRequest(prompt, opts.system, temperature, maxTokens, wantJson);

        log.info(`-> ${this.provider}/${this.model} (${prompt.length} chars${wantJson ? ', json' : ''})`);
        const json = await this.postWithRetry(url, headers, body);

        const parsed = this.cfg.api === 'anthropic' ? parseAnthropic(json) : parseOpenAi(json);
        if (!parsed.text) {
            throw new LLMGatewayError(
                `${this.provider} returned an empty response`,
                this.provider,
                undefined,
                JSON.stringify(json).slice(0, 2000),
            );
        }

        const latencyMs = Date.now() - started;
        log.info(
            `<- ${this.provider}/${this.model} ${latencyMs}ms ` +
                `(in ${parsed.usage.inputTokens ?? '?'} / out ${parsed.usage.outputTokens ?? '?'} tokens)`,
        );
        return { provider: this.provider, model: this.model, text: parsed.text, usage: parsed.usage, latencyMs };
    }

    /** Groq, OpenRouter, OpenAI and DeepSeek all speak the OpenAI chat/completions dialect. */
    private openAiRequest(
        prompt: string,
        system: string | undefined,
        temperature: number,
        maxTokens: number,
        wantJson: boolean,
    ) {
        const messages: { role: string; content: string }[] = [];
        if (system) messages.push({ role: 'system', content: system });
        messages.push({ role: 'user', content: prompt });

        const body: Record<string, unknown> = {
            model: this.model,
            messages,
            temperature,
            max_tokens: maxTokens,
        };
        if (wantJson && this.cfg.jsonMode) body.response_format = { type: 'json_object' };

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
        };
        if (this.provider === 'openrouter') {
            // Optional attribution headers OpenRouter uses for its app rankings.
            headers['X-Title'] = env('OPENROUTER_APP_NAME') || 'Playwright Framework';
            if (env('OPENROUTER_SITE_URL')) headers['HTTP-Referer'] = env('OPENROUTER_SITE_URL');
        }

        return { url: `${this.baseUrl}/chat/completions`, headers, body };
    }

    /** Claude uses the Anthropic Messages API: system is top-level, auth is x-api-key. */
    private anthropicRequest(prompt: string, system: string | undefined, temperature: number, maxTokens: number) {
        const body: Record<string, unknown> = {
            model: this.model,
            max_tokens: maxTokens,
            temperature,
            messages: [{ role: 'user', content: prompt }],
        };
        if (system) body.system = system;

        return {
            url: `${this.baseUrl}/v1/messages`,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body,
        };
    }

    private async postWithRetry(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
        let lastError: LLMGatewayError | undefined;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            if (attempt > 0) {
                const wait = Math.min(1000 * 2 ** (attempt - 1), 8000);
                log.warn(`retry ${attempt}/${this.maxRetries} for ${this.provider} in ${wait}ms`);
                await sleep(wait);
            }

            let res: Response;
            try {
                res = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(this.timeoutMs),
                });
            } catch (e) {
                // Network failure or timeout: retryable.
                lastError = new LLMGatewayError(
                    `${this.provider} request failed: ${(e as Error).message}`,
                    this.provider,
                );
                continue;
            }

            const text = await res.text();
            if (res.ok) {
                try {
                    return JSON.parse(text);
                } catch {
                    throw new LLMGatewayError(`${this.provider} sent a non-JSON body`, this.provider, res.status, text);
                }
            }

            lastError = new LLMGatewayError(
                `${this.provider} HTTP ${res.status}: ${errorMessage(text)}`,
                this.provider,
                res.status,
                text,
            );
            const retryable = res.status === 429 || res.status === 408 || res.status >= 500;
            if (!retryable) throw lastError;
        }

        throw lastError ?? new LLMGatewayError(`${this.provider} request failed`, this.provider);
    }
}

// ----------------------------------------------------------------------------
// Response parsers
// ----------------------------------------------------------------------------

function parseOpenAi(json: any): { text: string; usage: LLMUsage } {
    const content = json?.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map((c: any) => c?.text ?? '').join('') : '';
    return {
        text: text.trim(),
        usage: { inputTokens: json?.usage?.prompt_tokens, outputTokens: json?.usage?.completion_tokens },
    };
}

function parseAnthropic(json: any): { text: string; usage: LLMUsage } {
    const blocks: any[] = Array.isArray(json?.content) ? json.content : [];
    const text = blocks.filter((b) => b?.type === 'text').map((b) => b.text).join('');
    return {
        text: text.trim(),
        usage: { inputTokens: json?.usage?.input_tokens, outputTokens: json?.usage?.output_tokens },
    };
}

/** Pull a readable message out of a provider error body. */
function errorMessage(body: string): string {
    try {
        const j = JSON.parse(body);
        return j?.error?.message || j?.message || body.slice(0, 300);
    } catch {
        return body.slice(0, 300);
    }
}

function writeJson(filePath: string, data: unknown): string {
    const abs = path.resolve(filePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(data, null, 2) + '\n', 'utf8');
    log.info(`saved JSON -> ${abs}`);
    return abs;
}

// ----------------------------------------------------------------------------
// One-liners
// ----------------------------------------------------------------------------

/** Quick JSON call using whatever provider .env selects. */
export async function askLLMJson<T = unknown>(
    prompt: string,
    opts: AskJsonOptions & { provider?: LLMProvider; model?: string } = {},
): Promise<LLMJsonResponse<T>> {
    const { provider, model, ...ask } = opts;
    return new LLMGateway({ provider, model }).askJson<T>(prompt, ask);
}

/** Quick text call using whatever provider .env selects. */
export async function askLLM(
    prompt: string,
    opts: AskOptions & { provider?: LLMProvider; model?: string } = {},
): Promise<LLMTextResponse> {
    const { provider, model, ...ask } = opts;
    return new LLMGateway({ provider, model }).ask(prompt, ask);
}
