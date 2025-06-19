import { env as cfEnv } from "cloudflare:workers";

export class SecretService {
  private static instance: SecretService;

  private constructor() {}

  public static getInstance(): SecretService {
    if (!SecretService.instance) {
      SecretService.instance = new SecretService();
    }
    return SecretService.instance;
  }

  public async setSecret(key: string, value: string, days = 365): Promise<boolean> {
    await cfEnv.CF_KV.put(key, value, { expirationTtl: 60 * 60 * 24 * days });
    return true;
  }

  public async getSecret(key: string): Promise<string | undefined> {
    const secret = await cfEnv.CF_KV.get(key);
    return secret ? secret : undefined;
  }

  public async hasSecret(key: string): Promise<boolean> {
    const secret = await this.getSecret(key);
    return secret !== undefined;
  }
}
