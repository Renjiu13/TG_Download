import { handleMessage } from './handlers.js';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // 只处理 POST 请求
  if (request.method !== 'POST') {
    return new Response('请使用 Telegram 机器人发送命令', { status: 200 });
  }

  try {
    const payload = await request.json();
    
    // 处理 Telegram 更新
    if (payload.message) {
      return await handleMessage(payload.message, request);
    }
    
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('处理请求时出错:', error);
    return new Response('处理请求时出错', { status: 500 });
  }
}