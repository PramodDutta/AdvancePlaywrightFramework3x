/**
 * Agent factory: an AI agent is a prompt file plus an output schema, nothing else.
 *
 *   export const rcaAgent = createAgent<RcaVerdict>({
 *       name: 'rca',
 *       prompt: 'rca.prompt.md',        // in src/ai/prompts/, may use {{PLACEHOLDERS}}
 *       schema: RCA_SCHEMA,             // JSON Schema the reply must match (checked with AJV)
 *   });
 *   const verdict = await rcaAgent.run({ TITLE: '...', ERROR: '...' });
 *
 * run() fills the placeholders, appends the schema to the system prompt, calls
 * the LLMGateway (provider from .env), validates the JSON, and, when attachAs is
 * set and a test is running, attaches the output so the TTA report can show it.
 */

import fs from 'fs';
import path from 'path';
import Ajv, { type ValidateFunction } from 'ajv';
import { test } from '@playwright/test';
import { LLMGateway, type LLMGatewayOptions } from '../LLMGateway';

const PROMPTS_DIR = path.resolve(__dirname, '../prompts');
const ajv = new Ajv({ allErrors: true });

export interface AgentSpec {
    /** Short id, used in logs and errors. */
    name: string;
    /** Prompt file name inside src/ai/prompts/. */
    prompt: string;
    /** JSON Schema the model output must match. */
    schema: object;
    /** Optional role/system prompt. */
    system?: string;
    temperature?: number;
    maxTokens?: number;
    /** Attach the output to the running test under this name, e.g. 'ai-data' for the AI Data tab. */
    attachAs?: string;
    /** Provider/model overrides; defaults come from .env. */
    gateway?: LLMGatewayOptions;
}

export interface Agent<T> {
    readonly name: string;
    run(vars?: Record<string, string | number>): Promise<T>;
}

export function createAgent<T>(spec: AgentSpec): Agent<T> {
    let validate: ValidateFunction | undefined;

    return {
        name: spec.name,
        async run(vars = {}) {
            const template = fs.readFileSync(path.join(PROMPTS_DIR, spec.prompt), 'utf8');
            // One pass, so values that themselves contain {{...}} are not substituted again.
            const prompt = template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
                if (!(key in vars)) throw new Error(`[agent:${spec.name}] missing prompt variable {{${key}}}`);
                return String(vars[key]);
            });

            const system =
                (spec.system ? `${spec.system}\n\n` : '') +
                `Your JSON must match this JSON Schema:\n${JSON.stringify(spec.schema)}`;

            const { data } = await new LLMGateway(spec.gateway).askJson<T>(prompt, {
                system,
                temperature: spec.temperature,
                maxTokens: spec.maxTokens,
            });

            validate ??= ajv.compile(spec.schema);
            if (!validate(data)) {
                throw new Error(
                    `[agent:${spec.name}] output does not match schema: ${ajv.errorsText(validate.errors)}\n` +
                        JSON.stringify(data),
                );
            }

            if (spec.attachAs) await attachToCurrentTest(spec.attachAs, data);
            return data;
        },
    };
}

/** Attach JSON to the running test; a no-op outside a test (e.g. inside the reporter). */
async function attachToCurrentTest(name: string, data: unknown): Promise<void> {
    let info;
    try {
        info = test.info();
    } catch {
        return;
    }
    await info.attach(name, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
}
