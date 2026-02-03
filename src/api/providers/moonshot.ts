import OpenAI from "openai"
import { moonshotModels, moonshotDefaultModelId, type ModelInfo, MOONSHOT_DEFAULT_TEMPERATURE } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import type { ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { OpenAiHandler } from "./openai"

// kilocode_change start
// Kimi K2 and K2.5 models require temperature=1 and don't support other values
const KIMI_K2_REQUIRED_TEMPERATURE = 1.0
// kilocode_change end

export class MoonshotHandler extends OpenAiHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.moonshotApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? moonshotDefaultModelId,
			openAiBaseUrl: options.moonshotBaseUrl ?? "https://api.moonshot.ai/v1",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	override getModel() {
		const id = this.options.apiModelId ?? moonshotDefaultModelId
		const info = moonshotModels[id as keyof typeof moonshotModels] || moonshotModels[moonshotDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })

		// kilocode_change start
		// Kimi K2 and K2.5 models require temperature=1 - override any user-configured temperature
		const isKimiK2Model = id.startsWith("kimi-k2")
		const temperature = isKimiK2Model ? KIMI_K2_REQUIRED_TEMPERATURE : params.temperature
		// kilocode_change end

		return { id, info, ...params, temperature }
	}

	// Override to handle Moonshot's usage metrics, including caching.
	protected override processUsageMetrics(usage: any): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
			cacheWriteTokens: 0,
			cacheReadTokens: usage?.cached_tokens,
		}
	}

	// Override to always include max_tokens for Moonshot (not max_completion_tokens)
	protected override addMaxTokensIfNeeded(
		requestOptions:
			| OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming
			| OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
		modelInfo: ModelInfo,
	): void {
		// Moonshot uses max_tokens instead of max_completion_tokens
		requestOptions.max_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
	}
}
