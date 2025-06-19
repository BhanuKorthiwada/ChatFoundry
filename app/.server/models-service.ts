import { env as cfEnv } from "cloudflare:workers";
import { createAzure } from "@ai-sdk/azure";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";
import { createAiGateway } from "ai-gateway-provider";
import { createWorkersAI } from "workers-ai-provider";
import { SecretService } from "./secret-service";

export class ModelsService {
  private static instance: ModelsService;
  private secretService: SecretService;

  private constructor() {
    this.secretService = SecretService.getInstance();
  }

  public static getInstance(): ModelsService {
    if (!ModelsService.instance) {
      ModelsService.instance = new ModelsService();
    }
    return ModelsService.instance;
  }

  public async getOpenAIModel({
    modelName = "gpt-4.1-mini",
    apiKey = undefined,
    baseUrl = undefined,
  }: {
    modelName?: string;
    apiKey?: string;
    baseUrl?: string;
  }): Promise<LanguageModelV1> {
    const openaiKey = apiKey || (await this.secretService.getSecret("CHATFOUNDRY__PROVIDERS__OPENAI_API_KEY"));
    const openaiBaseUrl = baseUrl || (await this.secretService.getSecret("CHATFOUNDRY__PROVIDERS__OPENAI_BASE_URL"));
    const openai = createOpenAI({
      apiKey: openaiKey,
      ...(openaiBaseUrl ? { baseURL: openaiBaseUrl } : {}),
    });
    return openai(modelName);
  }

  public async getAzureOpenAIModel({
    modelName = "gpt-4.1-mini",
    apiKey = undefined,
    resourceName = undefined,
    baseUrl = undefined,
  }: {
    modelName?: string;
    apiKey?: string;
    resourceName?: string;
    baseUrl?: string;
  }): Promise<LanguageModelV1> {
    const azureOpenAIKey =
      apiKey || (await this.secretService.getSecret("CHATFOUNDRY__PROVIDERS__AZURE_OPENAI_API_KEY"));
    const azureResourceName =
      resourceName || (await this.secretService.getSecret("CHATFOUNDRY__PROVIDERS__AZURE_OPENAI_RESOURCE_NAME"));
    const azureOpenAIBaseUrl =
      baseUrl || (await this.secretService.getSecret("CHATFOUNDRY__PROVIDERS__AZURE_OPENAI_BASE_URL"));

    const azureOpenAI = createAzure({
      resourceName: azureResourceName,
      apiKey: azureOpenAIKey,
      baseURL: azureOpenAIBaseUrl,
    });
    return azureOpenAI(modelName);
  }

  public async getWorkersAiModel(modelName: string): Promise<LanguageModelV1> {
    const workersAi = createWorkersAI({
      binding: cfEnv.AI,
    });
    // @ts-ignore accept user-defined model names temporarily
    return workersAi(modelName);
  }

  public async getAiGateway(): Promise<LanguageModelV1> {
    const workersAi = createWorkersAI({
      binding: cfEnv.AI,
    });

    const openaiKey = await this.secretService.getSecret("CHATFOUNDRY__PROVIDERS__OPENAI_API_KEY");
    const openaiBaseUrl = await this.secretService.getSecret("CHATFOUNDRY__PROVIDERS__OPENAI_BASE_URL");
    const openai = createOpenAI({
      apiKey: openaiKey,
      ...(openaiBaseUrl ? { baseURL: openaiBaseUrl } : {}),
    });

    const azureOpenAIKey = await this.secretService.getSecret("CHATFOUNDRY__PROVIDERS__AZURE_OPENAI_API_KEY");
    const azureResourceName = await this.secretService.getSecret("CHATFOUNDRY__PROVIDERS__AZURE_OPENAI_RESOURCE_NAME");
    const azureOpenAIBaseUrl = await this.secretService.getSecret("CHATFOUNDRY__PROVIDERS__AZURE_OPENAI_BASE_URL");
    const azureOpenAI = createAzure({
      resourceName: azureResourceName,
      apiKey: azureOpenAIKey,
      baseURL: azureOpenAIBaseUrl,
    });

    const aiGateway = createAiGateway({
      binding: cfEnv.AI.gateway(`chatfoundry-${cfEnv.ENVIRONMENT}`),
      options: {
        skipCache: true,
      },
    });

    const defaultModel = aiGateway([
      ...(azureOpenAIKey && azureResourceName && azureOpenAIBaseUrl ? [azureOpenAI("gpt-4.1-mini")] : []),
      ...(openaiKey ? [openai("gpt-4.1-mini")] : []),
      // @ts-ignore bug in workers-ai-provider
      workersAi("@cf/meta/llama-4-scout-17b-16e-instruct"),
    ]);

    return defaultModel;
  }
}
