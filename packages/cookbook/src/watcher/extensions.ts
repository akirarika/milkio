import type { CookbookOptions } from "../utils/cookbook-dto-types";

export type CookbookWatcherExtensionProject = CookbookOptions["projects"][keyof CookbookOptions["projects"]];

export type CookbookWatcherFile = {
  /**
   * Path relative to the project root directory, starting with the directory name rather than a leading `/`. Path separators must always be `/` regardless of the operating system.
   */
  path: string;
  /**
   * The parts of the path, e.g. `foo/bar/baz.ts` with parts `foo`, `bar`, `baz`. The first part is always the directory name of the project root directory. The last part is always the file name. The middle parts are the directory names in between.
   */
  parts: Array<string>;
  /**
   * The file name, e.g. `foo/bar/baz.ts` with file name `baz.ts`.
   */
  fileName: string;
  /**
   * Variable names that can be safely used in import statements, for example: `module$foo$indexTaction`
   */
  importName: string;
  /**
   * Angular-style file types, e.g. `foo.bar.ts` with type `bar`, `foo.ts` with type null.
   */
  type: string | null;
  /**
   * The project root path, it is an absolute path and its delimiter is consistent with the system. For example, on Windows, it uses `\\` instead of `/`. You can use `fs.join(file.projectFsPath, file.path)` to construct the actual absolute path of a file.
   */
  projectFsPath: string;
  /**
   * If true, it means this file itself may not have been altered, but dependencies it belongs to have been modified. Typically, in such cases, you need to rerun certain steps, such as typia generation.
   */
  dependencyChanged: boolean;
};

export function defineWatcherExtension<
  T extends {
    async: boolean;
    filter: (file: CookbookWatcherFile) => boolean;
    setup?: (root: string, mode: string, options: CookbookOptions, project: CookbookWatcherExtensionProject, changeFiles: Array<CookbookWatcherFile>, allFiles: Array<CookbookWatcherFile>) => Promise<void>;
    declares?: (root: string, mode: string, options: CookbookOptions, project: CookbookWatcherExtensionProject, changeFiles: Array<CookbookWatcherFile>, allFiles: Array<CookbookWatcherFile>) => Promise<[string, string, string]>;
  },
>(extension: T): T {
  return extension;
}
