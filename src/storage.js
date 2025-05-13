// 上传到Alist
export async function uploadToAlist(fileUrl, fileName, env) {
  try {
    const ALIST_URL = env.ALIST_URL || 'https://your-alist-instance.com';
    const ALIST_TOKEN = env.ALIST_TOKEN || '';
    const ALIST_PATH = env.ALIST_PATH || '/telegram';
    
    // 下载文件
    const fileResponse = await fetch(fileUrl);
    const fileBuffer = await fileResponse.arrayBuffer();
    
    // 上传到Alist
    const uploadResponse = await fetch(`${ALIST_URL}/api/fs/put`, {
      method: 'PUT',
      headers: {
        'Authorization': ALIST_TOKEN,
        'Content-Type': 'application/octet-stream',
        'File-Path': `${ALIST_PATH}/${fileName}`
      },
      body: fileBuffer
    });
    
    const result = await uploadResponse.json();
    
    return {
      success: result.code === 200,
      path: `${ALIST_PATH}/${fileName}`,
      error: result.code !== 200 ? result.message : null
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// 上传到WebDAV
export async function uploadToWebdav(fileUrl, fileName, env) {
  try {
    const WEBDAV_URL = env.WEBDAV_URL || 'https://your-webdav-server.com';
    const WEBDAV_USER = env.WEBDAV_USER || '';
    const WEBDAV_PASS = env.WEBDAV_PASS || '';
    const WEBDAV_PATH = env.WEBDAV_PATH || '/telegram';
    
    // 下载文件
    const fileResponse = await fetch(fileUrl);
    const fileBuffer = await fileResponse.arrayBuffer();
    
    // 上传到WebDAV
    const uploadResponse = await fetch(`${WEBDAV_URL}${WEBDAV_PATH}/${fileName}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${btoa(`${WEBDAV_USER}:${WEBDAV_PASS}`)}`,
        'Content-Type': 'application/octet-stream'
      },
      body: fileBuffer
    });
    
    return {
      success: uploadResponse.ok,
      path: `${WEBDAV_PATH}/${fileName}`,
      error: !uploadResponse.ok ? await uploadResponse.text() : null
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}