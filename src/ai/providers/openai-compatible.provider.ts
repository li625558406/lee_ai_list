import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import OpenAI from 'openai';
import { IAiProvider, ChatRequestOptions, ImageRequestOptions, TokenCountResult } from '../interfaces/ai-provider.interface';
import { Content } from '@google/genai'; // 仅借用类型，或者你自己定义

@Injectable()
export class OpenAiCompatibleProvider implements IAiProvider {

    // 动态创建 OpenAI 客户端
    private getClient(apiKey: string, baseURL: string): OpenAI {
        if (!apiKey) throw new BadRequestException("API Key is required");
        return new OpenAI({
            apiKey: apiKey,
            baseURL: baseURL, // 关键：这是切换不同厂家的核心
            dangerouslyAllowBrowser: false
        });
    }

    /**
     * 将 Google 的 Content 格式转为 OpenAI 的 Message 格式
     * 这是一个简单的适配器，确保你的前端不用改数据结构
     */
    private convertToOpenAiMessages(contents: any[], systemInstruction?: string): any[] {
        const messages = [];

        // 1. 添加 System Prompt
        if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
        }

        // 2. 转换历史消息
        for (const item of contents) {
            let role = item.role;
            if (role === 'model') role = 'assistant'; // 兼容 Google 角色名

            // 提取文本内容
            let content = '';
            if (item.parts && Array.isArray(item.parts)) {
                content = item.parts.map((p: any) => p.text).join('\n');
            } else if (typeof item.content === 'string') {
                content = item.content;
            }

            if (content) {
                messages.push({ role, content });
            }
        }
        return messages;
    }

    // === 流式对话 ===
    async chatStream(res: Response, contents: Content[], options: ChatRequestOptions & { baseURL: string }): Promise<{ inputTokens: number, outputTokens: number }> {
        try {
            const client = this.getClient(options.apiKey, options.baseURL);
            const messages = this.convertToOpenAiMessages(contents, options.systemInstruction);

            // 发起流式请求
            const stream = await client.chat.completions.create({
                model: options.model,
                messages: messages,
                stream: true,
                temperature: options.temperature ?? 0.7,
                // max_tokens: 2048, // 可选
            });

            let inputTokens = 0; // OpenAI 流式通常不直接返回 input tokens，有些厂家会在最后一块返回
            let outputTokens = 0;

            for await (const chunk of stream) {
                // 1. 获取文本增量
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    res.write(content);
                }

                // 2. 尝试获取 Token 统计 (DeepSeek/Qwen 等厂家有时会在最后一个 chunk 返回 usage)
                if ((chunk as any).usage) {
                    inputTokens = (chunk as any).usage.prompt_tokens;
                    outputTokens = (chunk as any).usage.completion_tokens;
                }
            }

            return { inputTokens, outputTokens };

        } catch (error) {
            console.error(`[OpenAI Compatible] Error (${options.baseURL}):`, error);
            // 能够更优雅地处理 API Key 错误
            if (error.status === 401) {
                throw new BadRequestException("Invalid API Key for this provider.");
            }
            throw new InternalServerErrorException(error.message);
        }
    }

    // === 图片生成 (部分厂家支持 DALL-E 格式，如 Qwen-VL，否则抛出不支持) ===
    async generateImage(options: ImageRequestOptions & { baseURL: string }): Promise<any> {
        try {
            const client = this.getClient(options.apiKey, options.baseURL);

            const response = await client.images.generate({
                model: options.model,
                prompt: options.prompt,
                size: options.resolution as any || "1024x1024",
                n: 1,
            });

            return {
                candidates: response.data // 统一返回结构
            };
        } catch (error) {
            throw new InternalServerErrorException(`Image generation failed: ${error.message}`);
        }
    }

    // === Token 计算 (简单估算) ===
    async countTokens(contents: Content[], options: ChatRequestOptions): Promise<TokenCountResult> {
        // OpenAI 官方没有公开的 HTTP Token 计算接口，通常在本地用 tiktoken 库计算
        // 为了简化，这里返回 0 或者做一个字符估算
        return { totalTokens: 0 };
    }
}