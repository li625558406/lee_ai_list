import { Response } from 'express';
import { Content } from '@google/genai';

export interface ChatRequestOptions {
    model: string;
    systemInstruction?: string | any;
    temperature?: number;
    jsonMode?: boolean;
    enableSearch?: boolean;
    apiKey?: string;

    // === 新增字段 ===
    baseURL?: string; // 用于区分 OpenAI, DeepSeek, Kimi 等不同厂家的地址
}

export interface ImageRequestOptions {
    model: string;
    prompt: string;
    aspectRatio?: string;
    resolution?: string;
    apiKey?: string;

    // === 新增字段 ===
    baseURL?: string;
}

export interface TokenCountResult {
    totalTokens: number;
}

export interface IAiProvider {
    chatStream(res: Response, contents: Content[], options: ChatRequestOptions): Promise<{ inputTokens: number, outputTokens: number }>;

    generateImage(options: ImageRequestOptions): Promise<any>;

    countTokens(contents: Content[], options: ChatRequestOptions): Promise<TokenCountResult>;
}