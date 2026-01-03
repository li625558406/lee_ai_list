// dtos/chat-request.dto.ts
export class ChatRequestDto {
    contents: any[];        // 对话历史
    options?: {
        systemInstruction?: string; // 企业人设
        temperature?: number;
        jsonMode?: boolean;
        enableSearch?: boolean; // 是否开启联网
    };
}

// dtos/image-request.dto.ts
export class ImageRequestDto {
    provider: string;
    apiKey: string;
    model: string;
    prompt: string;
    options?: {
        aspectRatio?: string;
        resolution?: string;
    };
}