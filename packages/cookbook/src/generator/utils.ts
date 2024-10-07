import consola from "consola";
import { join } from "node:path";
import { exit, cwd } from "node:process";

export const checkPath = (paths: { cwd: string }, path: string, type?: string) => {
  if (!/^[a-z0-9/$/-]+$/.test(path.slice(0, path.length - (type?.length ?? 0) - (type ? 4 : 3)))) {
    consola.error(`Invalid path: "${join(paths.cwd, "app", path)}". The path can only contain lowercase letters, numbers, and "-".\n`);
    exit(1);
  }
  for (const keyword of keywords) {
    if (!path.endsWith(`/${keyword}.ts`) && path !== `${keyword}.ts`) continue;
    consola.error(`Invalid path: "${join(paths.cwd, "app", path)}". The name is a JavaScript keyword, which can cause potential problems.\n`);
    exit(1);
  }
};

const keywords = [
  "abstract",
  "arguments",
  "boolean",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "double",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "final",
  "finally",
  "float",
  "for",
  "function",
  "goto",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "int",
  "interface",
  "let",
  "long",
  "native",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "short",
  "static",
  "super",
  "switch",
  "synchronized",
  "this",
  "throw",
  "throws",
  "transient",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "volatile",
  "while",
  "with",
  "yield",
  "name",
  "function",
  "length",
  "eval",
  "prototype",
  "undefined",
  "void",
];
