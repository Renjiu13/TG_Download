import { getChannelInfo, getChannelMessages, getChannelMessagesByDate, getFile } from './telegram-api.js';
import { uploadToAlist, uploadToWebdav } from './storage.js';
import { paginateText } from './utils.js';

export async function handleMessage(message, request) {
  const env = request.cf || {};
  
  // 提取命令和参数
  const text = message.text || '';
  const command = text.split(' ')[0].toLowerCase();
  
  // 根据命令路由到不同的处理器
  let response;
  if (command === '/start' || command === '/help') {
    response = await handleStart(message, env);
  } else if (command === '/channel') {
    response = await handleChannel(message, env);
  } else if (command === '/date') {
    response = await handleDate(message, env);
  } else if (command === '/files') {
    response = await handleFiles(message, env);
  } else if (command === '/download') {
    response = await handleDownload(message, env);
  } else if (command === '/save') {
    response = await handleSave(message, env);
  } else {
    response = {
      method: 'sendMessage',
      chat_id: message.chat.id,
      text: '未知命令。请使用 /help 查看可用命令。'
    };
  }
  
  // 发送响应回 Telegram
  const BOT_TOKEN = env.BOT_TOKEN;
  const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}/${response.method}`;
  delete response.method;
  
  await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(response)
  });
  
  return new Response('OK', { status: 200 });
}

// 命令处理函数
export async function handleStart(message, env) {
  return {
    method: 'sendMessage',
    chat_id: message.chat.id,
    parse_mode: 'Markdown',
    text: `欢迎使用频道文件下载机器人！\n\n可用命令：\n/channel @频道名 - 设置要浏览的频道\n/date YYYY-MM-DD - 按日期浏览文件\n/files .pdf - 列出特定后缀的文件\n/download 文件ID - 下载特定文件\n/save 文件ID [存储类型] - 保存文件到存储后端`
  };
}

export async function handleChannel(message, env) {
  const parts = message.text.split(' ');
  if (parts.length < 2) {
    return {
      method: 'sendMessage',
      chat_id: message.chat.id,
      text: '请指定频道名称，例如：/channel @channelname'
    };
  }
  
  const channelName = parts[1];
  
  try {
    // 验证频道是否存在且可访问
    const channelInfo = await getChannelInfo(channelName, env);
    
    // 保存用户选择的频道（使用 KV 存储）
    await env.CHANNEL_STORE.put(`user:${message.from.id}:channel`, channelName);
    
    return {
      method: 'sendMessage',
      chat_id: message.chat.id,
      parse_mode: 'Markdown',
      text: `已设置频道：${channelName}\n\n使用 /date YYYY-MM-DD 命令查看特定日期的文件`
    };
  } catch (error) {
    return {
      method: 'sendMessage',
      chat_id: message.chat.id,
      text: `无法访问频道 ${channelName}。请确保该频道是公开的，且机器人有权限访问。`
    };
  }
}

export async function handleDate(message, env) {
  const parts = message.text.split(' ');
  if (parts.length < 2) {
    return {
      method: 'sendMessage',
      chat_id: message.chat.id,
      text: '请指定日期，例如：/date 2023-11-01'
    };
  }
  
  const date = parts[1];
  // 验证日期格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      method: 'sendMessage',
      chat_id: message.chat.id,
      text: '日期格式不正确，请使用 YYYY-MM-DD 格式'
    };
  }
  
  try {
    // 获取用户选择的频道（从 KV 存储）
    const channelName = await env.CHANNEL_STORE.get(`user:${message.from.id}:channel`);
    
    if (!channelName) {
      return {
        method: 'sendMessage',
        chat_id: message.chat.id,
        text: '请先使用 /channel 命令设置频道'
      };
    }
    
    // 获取指定日期的消息
    const messages = await getChannelMessagesByDate(channelName, date, env);
    
    if (messages.length === 0) {
      return {
        method: 'sendMessage',
        chat_id: message.chat.id,
        text: `在 ${date} 没有找到任何消息`
      };
    }
    
    // 提取包含文件的消息
    const fileMessages = messages.filter(msg => 
      msg.document || msg.photo || msg.video || msg.audio || msg.voice
    );
    
    if (fileMessages.length === 0) {
      return {
        method: 'sendMessage',
        chat_id: message.chat.id,
        text: `在 ${date} 没有找到任何文件`
      };
    }
    
    // 生成文件列表
    let fileList = `${date} 的文件列表：\n\n`;
    fileMessages.forEach((msg, index) => {
      let fileType, fileName, fileId;
      
      if (msg.document) {
        fileType = '文档';
        fileName = msg.document.file_name || '未命名文档';
        fileId = msg.document.file_id;
      } else if (msg.photo) {
        fileType = '图片';
        fileName = '照片';
        fileId = msg.photo[msg.photo.length - 1].file_id;
      } else if (msg.video) {
        fileType = '视频';
        fileName = msg.video.file_name || '视频';
        fileId = msg.video.file_id;
      } else if (msg.audio) {
        fileType = '音频';
        fileName = msg.audio.file_name || '音频';
        fileId = msg.audio.file_id;
      } else if (msg.voice) {
        fileType = '语音';
        fileName = '语音消息';
        fileId = msg.voice.file_id;
      }
      
      fileList += `${index + 1}. [${fileType}] ${fileName}\n使用 /download ${fileId} 下载\n\n`;
    });
    
    return {
      method: 'sendMessage',
      chat_id: message.chat.id,
      parse_mode: 'Markdown',
      text: fileList
    };
  } catch (error) {
    return {
      method: 'sendMessage',
      chat_id: message.chat.id,
      text: `获取文件列表时出错：${error.message}`
    };
  }
}

export async function handleFiles(message, env) {
  const parts = message.text.split(' ');
  if (parts.length < 2) {
    return {
      method: 'sendMessage',
      chat_id: message.chat.id,
      text: '请指定文件后缀，例如：/files .pdf'
    };
  }
  
  const extension = parts[1].toLowerCase();
  if (!extension.startsWith('.')) {
    return {
      method: 'sendMessage',
      chat_id: message.chat.id,
      text: '文件后缀应以点号开头，例如：.pdf'
    };
  }
  
  try {
    // 获取用户选择的频道
    const channelName = await env.CHANNEL_STORE.get(`user:${message.from.id}:channel`);
    
    if (!channelName) {
      return {
        method: 'sendMessage',
        chat_id: message.chat.id,
        text: '请先使用 /channel 命令设置频道'
      };
    }
    
    // 获取频道消息
    const messages = await getChannelMessages(channelName, env);
    
    // 筛选指定后缀的文件
    const filteredFiles = [];
    
    messages.forEach(msg => {
      if (msg.document && msg.document.file_name && 
          msg.document.file_name.toLowerCase().endsWith(extension)) {
        filteredFiles.push({
          type: '文档',
          name: msg.document.file_name,
          id: msg.document.file_id,
          date: new Date(msg.date * 1000).toISOString().split('T')[0]
        });
      }
    });
    
    if (filteredFiles.length === 0) {
      return {
        method: 'sendMessage',
        chat_id: message.chat.id,
        text: `没有找到后缀为 ${extension} 的文件`
      };
    }
    
    // 按日期分组
    const filesByDate = {};
    filteredFiles.forEach(file => {
      if (!filesByDate[file.date]) {
        filesByDate[file.date] = [];
      }
      filesByDate[file.date].push(file);
    });
    
    // 生成文件列表
    let fileList = `后缀为 ${extension} 的文件列表：\n\n`;
    
    Object.keys(filesByDate).sort().reverse().forEach(date => {
      fileList += `📅 ${date}\n`;
      filesByDate[date].forEach((file, index) => {
        fileList += `${index + 1}. ${file.name}\n使用 /download ${file.id} 下载\n\n`;
      });
    });
    
    // 分页处理
    const pages = paginateText(fileList);
    
    if (pages.length === 1) {
      return {
        method: 'sendMessage',
        chat_id: message.chat.id,
        parse_mode: 'Markdown',
        text: pages[0]
      };
    } else {
      // 发送多条消息
      for (let i = 0; i < pages.length; i++) {
        const pageText = `[第 ${i+1}/${pages.length} 页]\n\n${pages[i]}`;
        
        await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chat_id: message.chat.id,
            parse_mode: 'Markdown',
            text: pageText
          })
        });
      }
      
      return { method: 'sendMessage', chat_id: message.chat.id, text: '文件列表已发送完毕。' };
    }
  } catch (error) {
    return {
      method: 'sendMessage',
      chat_id: message.chat.id,
      text: `获取文件列表时出错：${error.message}`
    };
  }
}

export async function handleDownload(message, env) {
  const parts = message.text.split(' ');
  if (parts.length < 2) {
    return {
      method: 'sendMessage',
      chat_id: message.chat.id,
      text: '请指定文件ID，例如：/download FILE_ID'
    };
  }
  
  const fileId = parts[1];
  
  try {
    // 获取文件信息
    const fileInfo = await getFile(fileId, env);
    
    if (!fileInfo.ok) {
      return {
        method: 'sendMessage',
        chat_id: message.chat.id,
        text: `无法获取文件信息：${fileInfo.description}`
      };
    }
    
    // 检查文件大小，如果超过限制则提示用户
    const fileSize = fileInfo.result.file_size || 0;
    if (fileSize > 100 * 1024 * 1024) { // 100MB 作为安全阈值
      // 生成直接下载链接
      const BOT_TOKEN = env.BOT_TOKEN;
      const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
      
      return {
        method: 'sendMessage',
        chat_id: message.chat.id,
        parse_mode: 'Markdown',
        text: `⚠️ 文件大小为 ${(fileSize / (1024 * 1024)).toFixed(2)}MB，超过了安全处理限制。\n\n请直接使用此链接下载：[点击下载](${downloadUrl})\n\n注意：此链接有效期有限，请尽快下载。`
      };
    }
    
    // 对于小文件，继续使用原有逻辑
    const BOT_TOKEN = env.BOT_TOKEN;
    const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
    
    return {
      method: 'sendMessage',
      chat_id: message.chat.id,
      parse_mode: 'Markdown',
      text: `文件下载链接：[点击下载](${downloadUrl})\n\n注意：此链接有效期有限，请尽快下载。`
    };
  } catch (error) {
    return {
      method: 'sendMessage',
      chat_id: message.chat.id,
      text: `获取下载链接时出错：${error.message}`
    };
  }
}

export async function handleSave(message, env) {
  const parts = message.text.split(' ');
  if (parts.length < 2) {
    return {
      method: 'sendMessage',
      chat_id: message.chat.id,
      text: '请指定文件ID，例如：/save FILE_ID'
    };
  }
  
  const fileId = parts[1];
  const storageType = parts.length > 2 ? parts[2].toLowerCase() : 'alist'; // 默认使用alist
  
  try {
    // 获取文件信息
    const fileInfo = await getFile(fileId, env);
    
    if (!fileInfo.ok) {
      return {
        method: 'sendMessage',
        chat_id: message.chat.id,
        text: `无法获取文件信息：${fileInfo.description}`
      };
    }
    
    // 获取文件下载链接
    const BOT_TOKEN = env.BOT_TOKEN;
    const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
    
    // 发送状态消息
    const statusMsg = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.chat.id,
        text: '正在保存文件到存储后端，请稍候...'
      })
    }).then(res => res.json());
    
    // 上传文件到存储后端
    let uploadResult;
    if (storageType === 'alist') {
      uploadResult = await uploadToAlist(downloadUrl, fileInfo.result.file_path.split('/').pop(), env);
    } else if (storageType === 'webdav') {
      uploadResult = await uploadToWebdav(downloadUrl, fileInfo.result.file_path.split('/').pop(), env);
    } else {
      return {
        method: 'sendMessage',
        chat_id: message.chat.id,
        text: `不支持的存储类型：${storageType}。目前支持：alist, webdav`
      };
    }
    
    // 更新状态消息
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.chat.id,
        message_id: statusMsg.result.message_id,
        text: uploadResult.success 
          ? `文件已成功保存到 ${storageType}：${uploadResult.path}`
          : `保存文件失败：${uploadResult.error}`
      })
    });
    
    return { method: 'dummy' }; // 已经发送了响应，返回一个虚拟方法
  } catch (error) {
    return {
      method: 'sendMessage',
      chat_id: message.chat.id,
      text: `保存文件时出错：${error.message}`
    };
  }
}