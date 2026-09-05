// @milkio/drizzle 是一个极简的工具集，不包装 drizzle-orm，也不隐藏任何实现细节。
// 它只负责两件事：
// 1) 测试随机数据库名的生成、清洗、URL 改写与请求头解析；
// 2) 与 @milkio/astra 的 cleanDatabase 钩子共享同一套库名/请求头约定。
//
// 实际的连接、迁移、seed、删库、清库、以及 context.db 的挂载，都应由使用者在
// 自己工程的 bootstrap / 样板代码里完成（可参考 template-milkio）。

/** 测试数据库名的统一前缀（启动清理时按此前缀 DROP）。 */
export const TEST_DATABASE_PREFIX = 'milkio_test';

/** 用于在测试请求中传递随机数据库名的请求头。 */
export const TEST_DATABASE_HEADER = 'x-milkio-test-db';

/** 数据库名的最大长度（兼容 MySQL 等 64 字符限制）。 */
export const TEST_DATABASE_MAX_LENGTH = 64;

const RANDOM_SUFFIX_LENGTH = 8;

/** 从 Headers（或普通对象）中读取随机数据库名；没有携带时返回 null（走默认库）。 */
export function getTestDatabaseId(headers?: Headers | Record<string, any> | null): string | null {
  if (!headers) return null;
  const lowerKey = TEST_DATABASE_HEADER.toLowerCase();
  if (typeof (headers as Headers).get === 'function') {
    const value = (headers as Headers).get(TEST_DATABASE_HEADER) ?? (headers as Headers).get(lowerKey);
    return value ?? null;
  }
  const obj = headers as Record<string, any>;
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === lowerKey) return obj[key] ?? null;
  }
  return null;
}

/** 生成随机后缀（小写字母 + 数字）。 */
function randomSuffix(length = RANDOM_SUFFIX_LENGTH): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const alphabetLength = alphabet.length;
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabetLength];
  return out;
}

/** 清洗一段标识符为合法数据库名片段：小写、非法字符变 `_`、压缩重复下划线、去首尾下划线。 */
export function sanitizeDatabasePart(input: string, maxLength = 48): string {
  let out = String(input).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_');
  out = out.replace(/^_+|_+$/g, '');
  if (out.length > maxLength) out = out.slice(0, maxLength).replace(/_+$/g, '');
  return out || 'default';
}

/**
 * 从文件路径（含 import.meta.url）提取可读的数据库名片段。
 * 只取路径最后两段（如 `oc/__TEST__.test.ts` → `oc_test`），避免数据库名过长。
 */
function filePartFromPath(filePath?: string | null): string {
  if (!filePath) return 'default';
  let path = String(filePath);
  if (path.startsWith('file://')) {
    try {
      path = decodeURIComponent(new URL(path).pathname);
    } catch {
      // 保留原始 path
    }
  }
  path = path.replace(/\\/g, '/');
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return 'default';
  const fileName = (segments[segments.length - 1] || 'default').replace(/\.test\.ts$/i, '').replace(/\.ts$/i, '');
  const dir = segments[segments.length - 2] || '';
  return sanitizeDatabasePart(`${dir ? `${dir}_` : ''}${fileName}`);
}

/**
 * 生成一个随机的测试数据库名，形如 `milkio_test_<文件片段>_<随机>`。
 * 结果保证不超过 64 字符，便于通过前缀 `milkio_test` 做统一清理。
 */
export function generateTestDatabaseId(filePath?: string | null): string {
  const filePart = filePartFromPath(filePath);
  let candidate = `${TEST_DATABASE_PREFIX}_${filePart}_${randomSuffix()}`;
  if (candidate.length <= TEST_DATABASE_MAX_LENGTH) return candidate;
  // 过长时压缩文件片段，保证整体长度达标
  const keep = Math.max(TEST_DATABASE_MAX_LENGTH - TEST_DATABASE_PREFIX.length - RANDOM_SUFFIX_LENGTH - 2, 1);
  const shortFilePart = sanitizeDatabasePart(filePart, keep);
  candidate = `${TEST_DATABASE_PREFIX}_${shortFilePart}_${randomSuffix()}`;
  if (candidate.length <= TEST_DATABASE_MAX_LENGTH) return candidate;
  return `${TEST_DATABASE_PREFIX}_${randomSuffix()}`;
}

/** 从连接 URL 中提取当前数据库名（最后一个 path 段，忽略 `?`）。 */
export function extractDatabaseName(url: string): string | null {
  try {
    const u = new URL(url);
    const pathname = u.pathname.replace(/\/+$/, '');
    if (!pathname) return null;
    const name = pathname.split('/').pop();
    return name ? decodeURIComponent(name) : null;
  } catch {
    return null;
  }
}

/**
 * 把连接 URL 的数据库名替换为给定的 databaseId；当 databaseId 为 null/空时原样返回。
 * 支持 mysql://、postgres://、file:/sqlite: 等常见形式。
 */
export function withTestDatabase(url: string, databaseId: string | null): string {
  if (!databaseId) return url;
  try {
    const u = new URL(url);
    // sqlite / 文件协议（如 "file:./dev.db"）的 URL 解析行为与网络协议不同，
    // 为避免被规范化成 "file:///..."，统一走"替换最后一段"的兜底逻辑。
    if (u.protocol === 'file:' || u.protocol === 'sqlite:') throw new Error('non-network protocol');
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      const query = u.search || '';
      const hash = u.hash || '';
      return `${url.replace(/\/+$/, '')}/${databaseId}${query}${hash}`;
    }
    segments[segments.length - 1] = databaseId;
    u.pathname = `/${segments.join('/')}`;
    return u.toString();
  } catch {
    // 兜底：替换路径最后一段（兼容 sqlite:app.db / file:./dev.db 等形式）
    const qIndex = url.indexOf('?');
    const [base, query = ''] = qIndex >= 0 ? [url.slice(0, qIndex), url.slice(qIndex)] : [url, ''];
    const trimmed = base.replace(/\/+$/, '');
    const lastSlash = trimmed.lastIndexOf('/');
    if (lastSlash === -1) return `${trimmed}/${databaseId}${query}`;
    return `${trimmed.slice(0, lastSlash + 1)}${databaseId}${query}`;
  }
}
