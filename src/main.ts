import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
// 使用谷歌、chatGpt模型，本地测试需配置代理
// import { ProxyAgent, setGlobalDispatcher } from 'undici';

async function bootstrap() {
    // === 1. 代理配置 :使用谷歌、chatGpt模型，本地测试需配置代理 ===
    // 在本地开发时，你可以在 .env 文件里写 HTTPS_PROXY=http://127.0.0.1:10808
    // const proxyUrl = process.env.HTTPS_PROXY;
    //
    // if (proxyUrl) {
    //     console.log(`[System] 正在使用代理服务: ${proxyUrl}`);
    //     const dispatcher = new ProxyAgent(proxyUrl);
    //     setGlobalDispatcher(dispatcher);
    // } else {
    //     console.log(`[System] 未检测到代理配置，使用直连模式`);
    // }

    // 创建 Nest 应用实例
    const app = await NestFactory.create(AppModule);

    // 增加请求体大小限制，防止上传图片/大文本报错
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));

    // === 3. 跨域配置 (CORS) ===
    // 既然你是做 npm 包给别人用，CORS 必须全开
    app.enableCors({
        origin: '*', // 允许任何域名访问（生产环境如果是特定客户，可以改成数组）
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: false,
        allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
    });

    // === 4. 端口配置 ===

    // [修改] 优先读取环境变量 PORT，默认为 3000 (容器内部端口)
    const port = process.env.PORT || 3000;
    // 优先读取环境变量 PORT，默认为 3000
    app.use((req, res, next) => {
        console.log(`[调试日志]收到请求: ${req.method} ${req.url}`);
        next();
    });
    await app.listen(port);
    console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();