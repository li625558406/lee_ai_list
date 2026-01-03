import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { AiFactory } from './ai.factory'; // 引入上一部定义的工厂
import { ChatRequestDto } from '../dto/chat-request.dto'; // 引入上面定义的DTO

@Controller('ai') // 路由前缀
export class AisController {
    // 1. 在这里声明类的成员变量
    private readonly provider: string;
    private readonly apiKey: string;
    private readonly model: string;

    constructor(
        private readonly aiFactory: AiFactory
    ) {
        this.provider = process.env.PROVIDER;
        this.apiKey = process.env.API_KEY;
        this.model = process.env.MODEL;
    }

    /**
     * 流式对话接口
     * 只有拥有正确 ApiKey 的请求才能被上游厂商处理，否则抛出厂商错误
     */
    @Post('chat')
    async chat(@Body() body: ChatRequestDto, @Res() res: Response) {
        const { contents, options } = body;

        // 1. 基础校验：如果没有 Key，直接驳回，不浪费连接资源
        if (!this.apiKey) {
            return res.status(401).json({ error: 'API Key is missing in request body.' });
        }

        try {
            // 2. 设置 SSE (Server-Sent Events) 响应头
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no'); // 针对 Nginx 必须关闭缓冲

            // 3. 通过工厂获取具体的 Provider (GoogleProvider / OpenAiProvider)
            // 如果 provider 传空，默认可以给个 'google'
            const { service, baseURL } = this.aiFactory.getProviderService(this.provider);

            // 4. 执行流式对话
            // 注意：我们将 res 直接传进去，Provider 内部会负责 res.write()
            // 这里的 chatStream 不需要鉴权逻辑，纯粹透传
            await service.chatStream(res, contents, {
                model: this.model,
                apiKey: this.apiKey,
                baseURL: baseURL, // 将工厂匹配到的 URL 传进去
                systemInstruction: options?.systemInstruction,
                enableSearch: options?.enableSearch,
                temperature: options?.temperature
            });

            // 5. 结束响应
            // Provider 内部通常处理了 write，但 end 需要在这里或 Provider 里明确调用
            // 建议约定：Provider 只负责 write chunk，Controller 负责 end，
            // 但因为 chatStream 是 await 等待流结束的，所以这里可以直接 end
            res.end();

        } catch (error) {
            console.error('[Chat Error]', error.message);

            // 如果 Header 还没发出去，返回 JSON 错误
            if (!res.headersSent) {
                return res.status(500).json({ error: error.message || 'Internal Server Error' });
            }
            // 如果流已经开始了，没法撤回 Header，只能强制断开或发送特定错误帧
            res.end();
        }
    }

    /**
     * 图片生成接口
     */
    // @Post('image')
    // async generateImage(@Body() body: ImageRequestDto, @Res() res: Response) {
    //     const { provider, apiKey, model, prompt, options } = body;
    //
    //     if (!apiKey) {
    //         return res.status(401).json({ error: 'API Key is missing.' });
    //     }
    //
    //     try {
    //         const aiProvider = service.getProvider(provider || 'google');
    //
    //         const result = await aiProvider.generateImage({
    //             apiKey: apiKey,
    //             model: model,
    //             prompt: prompt,
    //             aspectRatio: options?.aspectRatio,
    //             resolution: options?.resolution
    //         });
    //
    //         // 直接返回厂商的原始结果，或者包装一下
    //         return res.status(200).json(result);
    //
    //     } catch (error) {
    //         console.error('[Image Error]', error.message);
    //         // 区分一下是不是 Key 错误
    //         if (error.message.includes('API Key') || error.message.includes('401')) {
    //             return res.status(401).json({ error: 'Invalid API Key or Upstream Error' });
    //         }
    //         return res.status(500).json({ error: error.message });
    //     }
    // }
}