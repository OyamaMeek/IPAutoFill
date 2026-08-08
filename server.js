const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');

const ROOT = __dirname;
const PROFILES = new Set(['HZCT', 'HZCM']);
const MAX_BODY_BYTES = 64 * 1024;

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function decodeBase64Json(encoded) {
  try {
    const normalized = encoded.trim().replace(/-/g, '+').replace(/_/g, '/');
    if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
      throw new Error('invalid base64');
    }
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    const text = Buffer.from(normalized + padding, 'base64').toString('utf8');
    if (!text || !Buffer.from(text, 'utf8').equals(Buffer.from(normalized + padding, 'base64'))) {
      throw new Error('invalid utf8');
    }
    return JSON.parse(text);
  } catch {
    throw new AppError('原始节点不是有效的 VMess Base64 JSON 链接。');
  }
}

function parseVmessLink(nodeLink) {
  if (typeof nodeLink !== 'string' || !nodeLink.trim()) {
    throw new AppError('请填写一条原始 VMess 节点链接。');
  }

  const input = nodeLink.trim();
  if (!input.startsWith('vmess://')) {
    throw new AppError('当前仅支持 vmess:// Base64 JSON 格式的节点链接。');
  }

  const node = decodeBase64Json(input.slice('vmess://'.length));
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new AppError('VMess 节点内容必须是 JSON 对象。');
  }
  if (typeof node.add !== 'string' || !node.add.trim()) {
    throw new AppError('VMess 节点缺少有效的连接地址字段 add。');
  }
  if (typeof node.ps !== 'string') {
    throw new AppError('VMess 节点缺少有效的名称字段 ps。');
  }
  return node;
}

function serializeVmessLink(node) {
  return `vmess://${Buffer.from(JSON.stringify(node), 'utf8').toString('base64')}`;
}

async function loadProfileIps(profile, configPath = path.join(ROOT, 'config.json')) {
  if (!PROFILES.has(profile)) {
    throw new AppError('只支持 HZCT 或 HZCM 选项。');
  }

  let config;
  try {
    config = JSON.parse(await readFile(configPath, 'utf8'));
  } catch {
    throw new AppError('config.json 缺失或格式无效。', 500);
  }

  const ips = config?.[profile];
  if (!Array.isArray(ips) || ips.length < 3) {
    throw new AppError(`config.json 中 ${profile} 的有效 IP 数量不足三个。`, 500);
  }
  const selected = ips.slice(0, 3);
  if (!selected.every((ip) => typeof ip === 'string' && net.isIP(ip.trim()) !== 0)) {
    throw new AppError(`config.json 中 ${profile} 包含无效 IP。`, 500);
  }
  return selected.map((ip) => ip.trim());
}

async function generateNodes({ nodeLink, profile }, options = {}) {
  const sourceNode = parseVmessLink(nodeLink);
  const ips = await loadProfileIps(profile, options.configPath);

  return ips.map((server, index) => {
    const node = { ...sourceNode, add: server, ps: `-${index + 1}` };
    return { name: node.ps, server, link: serializeVmessLink(node) };
  });
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function sendFile(response, fileName, contentType) {
  readFile(path.join(ROOT, fileName))
    .then((content) => {
      response.writeHead(200, {
        'content-type': contentType,
        'cache-control': 'no-store',
      });
      response.end(content);
    })
    .catch(() => sendJson(response, 500, { ok: false, error: '静态资源加载失败。' }));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new AppError('请求内容过大。'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new AppError('请求体必须是有效的 JSON。'));
      }
    });
    request.on('error', () => reject(new AppError('读取请求失败。')));
  });
}

function createServer(options = {}) {
  return http.createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/') {
        sendFile(response, 'index.html', 'text/html; charset=utf-8');
        return;
      }
      if (request.method === 'GET' && request.url === '/app.js') {
        sendFile(response, 'app.js', 'application/javascript; charset=utf-8');
        return;
      }
      if (request.url === '/api/generate') {
        if (request.method !== 'POST') {
          sendJson(response, 405, { ok: false, error: '此接口只支持 POST 请求。' });
          return;
        }
        const payload = await readJsonBody(request);
        const nodes = await generateNodes(payload, options);
        sendJson(response, 200, { ok: true, profile: payload.profile, nodes });
        return;
      }
      sendJson(response, 404, { ok: false, error: '未找到请求的资源。' });
    } catch (error) {
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      sendJson(response, statusCode, { ok: false, error: error.message || '服务器处理失败。' });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => {
    console.log(`IPAutoFill 已启动：http://localhost:${port}`);
  });
}

module.exports = { AppError, createServer, generateNodes, loadProfileIps, parseVmessLink, serializeVmessLink };
