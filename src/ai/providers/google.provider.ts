import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import {
    IAiProvider,
    ChatRequestOptions,
    ImageRequestOptions,
    TokenCountResult
} from '../interfaces/ai-provider.interface';
import {
    GoogleGenAI,
    Tool,
    Content,
    Part,
    GenerateContentConfig
} from "@google/genai";
// 你的敏感词文件路径
import { BANNED_WORDS_LIST, BANNED_PATTERNS_LIST } from '../banned-words';

@Injectable()
export class GoogleProvider implements IAiProvider {

    /**
     * 获取 Google API 客户端实例
     * Google SDK 不需要 baseURL，它直接连接 Google 服务器
     */
    private getClient(apiKey: string): GoogleGenAI {
        if (!apiKey) {
            throw new BadRequestException("Google API Key is required for this provider.");
        }
        return new GoogleGenAI({ apiKey });
    }

    /**
     * 敏感词检测逻辑
     */
    private checkSensitiveContent(input: Content[] | Content | Part | string | any): void {
        if (!input) return;

        let allText = '';
        const extractText = (data: any) => {
            if (!data) return;
            if (typeof data === 'string') {
                allText += data + '\n';
            } else if (Array.isArray(data)) {
                data.forEach(item => extractText(item));
            } else if (typeof data === 'object') {
                if (data.parts) extractText(data.parts);
                else if (data.text) allText += (data.text + '\n');
            }
        };

        extractText(input);
        const normalizedText = allText.toLowerCase();

        for (const word of BANNED_WORDS_LIST) {
            if (!word || word.trim() === '') continue;
            if (normalizedText.includes(word.toLowerCase())) {
                console.warn(`[Sensitive Check] Blocked: "${word}"`);
                throw new BadRequestException(`请求包含敏感内容，已被拦截。`);
            }
        }
        for (const pattern of BANNED_PATTERNS_LIST) {
            if (pattern.test(allText)) {
                console.warn(`[Sensitive Check] Blocked by pattern`);
                throw new BadRequestException(`请求包含敏感内容，已被拦截。`);
            }
        }
    }

    /**
     * 流式对话
     */
    async chatStream(res: Response, contents: Content[], options: ChatRequestOptions): Promise<{ inputTokens: number, outputTokens: number }> {
        try {
            // 1. 安全检查
            this.checkSensitiveContent(contents);
            if (options.systemInstruction) {
                this.checkSensitiveContent(options.systemInstruction);
            }

            // 2. 初始化 (Google 不需要 options.baseURL)
            const client = this.getClient(options.apiKey);

            // 3. 配置工具
            const tools: Tool[] = [];
            if (options.enableSearch) {
                tools.push({ googleSearch: {} });
            }

            // 4. 构建配置
            const config: GenerateContentConfig = {
                responseMimeType: options.jsonMode ? "application/json" : "text/plain",
                tools: tools.length > 0 ? tools : undefined,
                systemInstruction: options.systemInstruction as (string | Content),
                temperature: options.temperature ?? 0.7,
            };

            // 5. 调用 API
            const result = await client.models.generateContentStream({
                model: options.model,
                contents: contents,
                config: config,
            });

            let inputTokens = 0;
            let outputTokens = 0;

            // 6. 处理流
            for await (const chunk of result) {
                if (chunk.usageMetadata) {
                    outputTokens = chunk.usageMetadata.candidatesTokenCount;
                    inputTokens = chunk.usageMetadata.promptTokenCount;
                }

                let text = '';
                try {
                    // 兼容不同版本的 SDK (属性 vs 方法)
                    text = typeof chunk.text === 'function' ? chunk.text : (chunk.text as string);
                } catch (e) {}

                if (text) {
                    res.write(text);
                }
            }

            return { inputTokens, outputTokens };

        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            console.error("[Google Provider] Chat Error:", error);
            throw new InternalServerErrorException(`Google AI Error: ${error.message}`);
        }
    }

    /**
     * 图片生成
     */
    async generateImage(options: ImageRequestOptions): Promise<any> {
        try {
            this.checkSensitiveContent(options.prompt);
            const client = this.getClient(options.apiKey);

            const imageConfig: any = {};
            if (options.aspectRatio) imageConfig.aspectRatio = options.aspectRatio;

            if (options.resolution === '1K') imageConfig.imageSize = '1024x1024';
            else if (options.resolution === '2K') imageConfig.imageSize = '2048x2048';
            else if (options.resolution) imageConfig.imageSize = options.resolution;

            const response = await client.models.generateContent({
                model: options.model || 'gemini-3-pro-image-preview',
                contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
                config: {
                    responseModalities: ['IMAGE'],
                    imageConfig: imageConfig
                },
            });

            return {
                candidates: response.candidates,
                usageMetadata: response.usageMetadata
            };

        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new InternalServerErrorException(`Image Gen Error: ${error.message}`);
        }
    }

    /**
     * Token 计算
     */
    async countTokens(contents: Content[], options: ChatRequestOptions): Promise<TokenCountResult> {
        try {
            const client = this.getClient(options.apiKey);
            let finalContents = [...contents];

            if (options.systemInstruction) {
                const sysText = typeof options.systemInstruction === 'string'
                    ? options.systemInstruction
                    : JSON.stringify(options.systemInstruction);

                finalContents.unshift({
                    role: 'user',
                    parts: [{ text: `System Instruction: ${sysText}` }]
                });
            }

            const response = await client.models.countTokens({
                model: options.model,
                contents: finalContents,
            });

            return { totalTokens: response.totalTokens };
        } catch (error) {
            return { totalTokens: 0 };
        }
    }
}