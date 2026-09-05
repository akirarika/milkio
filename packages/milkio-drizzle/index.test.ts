import { describe, expect, it } from 'vitest';
import {
  TEST_DATABASE_HEADER,
  TEST_DATABASE_MAX_LENGTH,
  TEST_DATABASE_PREFIX,
  extractDatabaseName,
  generateTestDatabaseId,
  getTestDatabaseId,
  sanitizeDatabasePart,
  withTestDatabase,
} from './index.ts';

describe('generateTestDatabaseId', () => {
  it('以统一前缀开头并带随机后缀', () => {
    const id = generateTestDatabaseId('app/modules/user/__TEST__.test.ts');
    expect(id.startsWith(`${TEST_DATABASE_PREFIX}_`)).toBe(true);
    expect(id.length).toBeLessThanOrEqual(TEST_DATABASE_MAX_LENGTH);
  });

  it('从路径提取可读的文件片段', () => {
    const id = generateTestDatabaseId('app/modules/oc/__TEST__.test.ts');
    expect(id).toContain('oc_test');
  });

  it('同一文件多次生成结果不同（随机性）', () => {
    const a = generateTestDatabaseId('app/modules/user/__TEST__.test.ts');
    const b = generateTestDatabaseId('app/modules/user/__TEST__.test.ts');
    expect(a).not.toBe(b);
  });

  it('超长路径会截断到 64 字符以内', () => {
    const long = 'app/modules/' + 'x'.repeat(200) + '/__TEST__.test.ts';
    const id = generateTestDatabaseId(long);
    expect(id.length).toBeLessThanOrEqual(TEST_DATABASE_MAX_LENGTH);
    expect(id.startsWith(`${TEST_DATABASE_PREFIX}_`)).toBe(true);
  });

  it('无路径时返回合法的默认库名', () => {
    const id = generateTestDatabaseId();
    expect(id.startsWith(`${TEST_DATABASE_PREFIX}_`)).toBe(true);
    expect(id.length).toBeLessThanOrEqual(TEST_DATABASE_MAX_LENGTH);
  });
});

describe('sanitizeDatabasePart', () => {
  it('小写化并把非法字符替换为下划线', () => {
    expect(sanitizeDatabasePart('User-Auth/Token')).toBe('user_auth_token');
  });

  it('压缩重复下划线并去掉首尾下划线', () => {
    expect(sanitizeDatabasePart('__a--b__c__')).toBe('a_b_c');
  });

  it('空字符串返回 default', () => {
    expect(sanitizeDatabasePart('')).toBe('default');
    expect(sanitizeDatabasePart('   ')).toBe('default');
  });
});

describe('withTestDatabase', () => {
  it('替换 mysql url 的数据库名', () => {
    const url = 'mysql://root:pass@127.0.0.1:3306/kecream_server';
    expect(withTestDatabase(url, 'milkio_test_abc')).toBe('mysql://root:pass@127.0.0.1:3306/milkio_test_abc');
  });

  it('替换 postgresql url 的数据库名并保留 query', () => {
    const url = 'postgresql://user:pass@localhost:5432/mydb?sslmode=disable';
    expect(withTestDatabase(url, 'milkio_test_x')).toBe('postgresql://user:pass@localhost:5432/milkio_test_x?sslmode=disable');
  });

  it('databaseId 为 null 时原样返回', () => {
    const url = 'mysql://root@127.0.0.1:3306/kecream_server';
    expect(withTestDatabase(url, null)).toBe(url);
  });

  it('无数据库段时直接附加', () => {
    const url = 'mysql://root@127.0.0.1:3306';
    expect(withTestDatabase(url, 'milkio_test_a')).toBe('mysql://root@127.0.0.1:3306/milkio_test_a');
  });

  it('sqlite 文件路径兜底替换最后一段', () => {
    expect(withTestDatabase('file:./dev.db', 'milkio_test_1')).toBe('file:./milkio_test_1');
    expect(withTestDatabase('sqlite:data/app.db', 'milkio_test_2')).toBe('sqlite:data/milkio_test_2');
  });
});

describe('extractDatabaseName', () => {
  it('从 mysql url 提取数据库名', () => {
    expect(extractDatabaseName('mysql://root@127.0.0.1:3306/kecream_server')).toBe('kecream_server');
  });

  it('忽略 query 与末尾斜杠', () => {
    expect(extractDatabaseName('postgresql://u@localhost/dbname/?sslmode=disable')).toBe('dbname');
  });

  it('无路径时返回 null', () => {
    expect(extractDatabaseName('mysql://root@127.0.0.1:3306')).toBeNull();
  });
});

describe('getTestDatabaseId', () => {
  it('从 Headers 中读取（大小写不敏感）', () => {
    const h = new Headers();
    h.set('X-Milkio-Test-Db', 'milkio_test_header');
    expect(getTestDatabaseId(h)).toBe('milkio_test_header');
  });

  it('从普通对象中读取', () => {
    expect(getTestDatabaseId({ [TEST_DATABASE_HEADER]: 'obj_db' })).toBe('obj_db');
    expect(getTestDatabaseId({ [TEST_DATABASE_HEADER.toUpperCase()]: 'obj_db2' })).toBe('obj_db2');
  });

  it('没有携带时返回 null', () => {
    expect(getTestDatabaseId()).toBeNull();
    expect(getTestDatabaseId(new Headers())).toBeNull();
    expect(getTestDatabaseId({})).toBeNull();
  });
});
