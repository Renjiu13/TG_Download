// 分页辅助函数
export function paginateText(text, pageSize = 4000) {
  if (text.length <= pageSize) {
    return [text];
  }
  
  const pages = [];
  let currentPage = '';
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (currentPage.length + line.length + 1 > pageSize) {
      pages.push(currentPage);
      currentPage = line;
    } else {
      currentPage += (currentPage ? '\n' : '') + line;
    }
  }
  
  if (currentPage) {
    pages.push(currentPage);
  }
  
  return pages;
}

// 解析HTML中的消息
export function parseMessagesFromHtml(html) {
  const messages = [];
  
  // 使用正则表达式提取消息块
  const messageBlocks = html.match(/<div class="tgme_widget_message_bubble">[\s\S]*?<\/div>/g) || [];
  
  messageBlocks.forEach((block, index) => {
    // 提取消息日期
    const dateMatch = block.match(/datetime="([^"]+)"/);
    const date = dateMatch ? new Date(dateMatch[1]) : new Date();
    
    // 提取文件链接
    const fileLinks = block.match(/<a class="tgme_widget_message_document_link" href="([^"]+)"/g) || [];
    
    fileLinks.forEach(link => {
      const urlMatch = link.match(/href="([^"]+)"/);
      const nameMatch = link.match(/<div class="tgme_widget_message_document_title">([^<]+)<\/div>/);
      
      if (urlMatch) {
        messages.push({
          date: Math.floor(date.getTime() / 1000),
          document: {
            file_id: `web_${index}_${Date.now()}`, // 生成唯一ID
            file_name: nameMatch ? nameMatch[1] : '未命名文件',
            mime_type: getMimeType(nameMatch ? nameMatch[1] : ''),
            file_url: urlMatch[1]
          }
        });
      }
    });
    
    // 同样处理图片、视频等其他类型文件
  });
  
  return messages;
}

// 根据文件名获取MIME类型
export function getMimeType(fileName) {
  const extension = fileName.split('.').pop().toLowerCase();
  const mimeTypes = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'mp3': 'audio/mpeg',
    'mp4': 'video/mp4',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    'txt': 'text/plain'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}