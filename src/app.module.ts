import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AisController } from './ai/ais.controller';
import { AiFactory } from './ai/ai.factory';
import { GoogleProvider } from './ai/providers/google.provider';
import { OpenAiCompatibleProvider } from './ai/providers/openai-compatible.provider';

@Module({
    imports: [
        // 1. 配置模块
        ConfigModule.forRoot({
            isGlobal: true, // 让配置全局可用
        }),
        // TypeOrmModule.forFeature([]),
    ],
    controllers: [AisController],
    providers: [AiFactory, GoogleProvider, OpenAiCompatibleProvider],
})
export class AppModule {}