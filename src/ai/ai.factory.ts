import { Injectable, BadRequestException } from '@nestjs/common';
import { GoogleProvider } from './providers/google.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import { IAiProvider } from './interfaces/ai-provider.interface';

@Injectable()
export class AiFactory {
    // 定义国内常用厂家的 Base URL 配置
    private readonly PROVIDER_CONFIGS = {
        // 1. OpenAI (官方)
        'openai': 'https://api.openai.com/v1',

        // 2. DeepSeek (深度求索) - 极具性价比
        'deepseek': 'https://api.deepseek.com',

        // 3. Moonshot (Kimi/月之暗面)
        'moonshot': 'https://api.moonshot.cn/v1',

        // 4. Aliyun Qwen (通义千问)
        'qwen': 'https://dashscope.aliyuncs.com/compatible-mode/v1',

        // 5. Zhipu AI (智谱 GLM)
        'zhipu': 'https://open.bigmodel.cn/api/paas/v4',

        // 6. 01.AI (零一万物/Yi)
        'yi': 'https://api.01.ai/v1',

        // 7. Doubao (字节跳动/豆包) - 需注意 Model 传参通常是 Endpoint ID
        'doubao': 'https://ark.cn-beijing.volces.com/api/v3',
    };

    constructor(
        private readonly googleProvider: GoogleProvider,
        private readonly openAiCompatibleProvider: OpenAiCompatibleProvider,
    ) {}

    /**
     * 获取 Provider 实例
     * @param providerType 厂家标识 (如 'google', 'deepseek')
     * @returns Provider 实例和该厂家的 BaseURL
     */
    getProviderService(providerType: string): { service: IAiProvider, baseURL?: string } {
        const type = providerType?.toLowerCase() || 'google';

        // 1. Google 走专用 SDK
        if (type === 'google' || type === 'gemini') {
            return { service: this.googleProvider };
        }

        // 2. 其他厂家走 OpenAI 兼容模式
        const baseURL = this.PROVIDER_CONFIGS[type];

        if (baseURL) {
            return {
                service: this.openAiCompatibleProvider,
                baseURL: baseURL
            };
        }

        // 3. 支持自定义 (如果前端直接传 url)
        if (providerType.startsWith('http')) {
            return {
                service: this.openAiCompatibleProvider,
                baseURL: providerType
            };
        }

        throw new BadRequestException(`Unknown provider: ${providerType}`);
    }
}