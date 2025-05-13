import { parseMessagesFromHtml } from './utils.js';

// Telegram API 工具函数
export async function getChannelInfo(channelName, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  const response = await fetch(`${API_URL}/getChat?chat_id=${channelName}`);
  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(data.description);
  }
  
  return data.result;
}

export async function getChannelMessages(channelName, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  // 使用 getUpdates 替代 getChatHistory
  // 注意：机器人需要是频道的管理员，且需要先将机器人添加到频道中
  const response = await fetch(`${API_URL}/getUpdates?allowed_updates=["channel_post"]&limit=100`);
  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(data.description);
  }
  
  // 筛选出指定频道的消息
  const channelMessages = data.result
    .filter(update => update.channel_post && update.channel_post.chat.username === channelName.replace('@', ''))
    .map(update => update.channel_post);
  
  return channelMessages;
}

export async function getChannelMessagesByDate(channelName, date, env) {
  // 获取所有消息
  const messages = await getChannelMessages(channelName, env);
  
  // 筛选指定日期的消息
  return messages.filter(msg => {
    const msgDate = new Date(msg.date * 1000).toISOString().split('T')[0];
    return msgDate === date;
  });
}

export async function getFile(fileId, env) {
  const BOT_TOKEN = env.BOT_TOKEN;
  const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  const response = await fetch(`${API_URL}/getFile?file_id=${fileId}`);
  return await response.json();
}

// 使用公开API获取频道消息，无需管理员权限
export async function getPublicChannelMessages(channelName, env) {
  // 使用Telegram Web版的API格式
  const channelUsername = channelName.replace('@', '');
  const apiUrl = `https://t.me/s/${channelUsername}`;
  
  try {
    const response = await fetch(apiUrl);
    const html = await response.text();
    
    // 解析HTML获取消息内容
    const messages = parseMessagesFromHtml(html);
    
    return messages;
  } catch (error) {
    console.error('获取公开频道消息失败:', error);
    throw new Error('无法获取频道消息，请确保频道是公开的');
  }
}