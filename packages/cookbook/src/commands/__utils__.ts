import consola from "consola";
import { cwd } from "node:process";
import { spawn } from "node:child_process";
import type { Params } from "..";
import { progress } from "../progress";
import { fetchEventSource } from "../utils/fetch-event-source";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { selectProject } from "../utils/select-project";

const INVALID_HYPHEN_MSG = (str: string) => `Invalid hyphen string: ${str}. Only lowercase letters, numbers and hyphens allowed, and must be in hyphen-case format`;
const HYPHEN_STRING_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function createCommandUtils(params: Params, options: { path?: string; description?: "global" | "npm-script" | "workspace" | "built-in" }) {
  // Basic console methods
  const log = consola.log;
  const info = consola.info;
  const warn = consola.warn;
  const error = consola.error;
  const success = consola.success;
  const debug = consola.debug;
  const fatal = consola.fatal;
  const trace = consola.trace;
  const start = consola.start;
  const box = consola.box;
  const prompt = consola.prompt;

  // Path retrieval methods
  const getScriptPath = () => options.path!;
  const getWorkspacePath = () => cwd();
  const getCurrentParams = () => params;

  // User input methods
  const getBooleanInput = async (config: {
    env: string;
    message: string;
    placeholder?: string;
  }) => {
    if (config.env in params.options) {
      return params.options[config.env] === "1";
    }
    return consola.prompt(config.message, {
      type: "confirm",
      placeholder: config.placeholder,
    });
  };

  const getStringInput = async (config: {
    env: string;
    message: string;
    placeholder?: string;
  }) => {
    if (config.env in params.options) {
      return params.options[config.env];
    }
    return consola.prompt(config.message, {
      type: "text",
      placeholder: config.placeholder,
    });
  };

  // Progress control
  const startProgress = (message: string) => progress.open(message);
  const endProgress = (message: string) => progress.close(message);

  // String transformation helpers
  const validateHyphenString = (str: string) => {
    if (!HYPHEN_STRING_REGEX.test(str)) {
      throw new Error(INVALID_HYPHEN_MSG(str));
    }
    return str;
  };

  const toCamelCase = (str: string) => {
    const validated = validateHyphenString(str);
    return validated.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());
  };

  const toPascalCase = (str: string) => {
    const camel = toCamelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  };

  const toSnakeCase = (str: string) => {
    const validated = validateHyphenString(str);
    return validated.replace(/-/g, "_").toLowerCase();
  };

  const toConstantCase = (str: string) => {
    const validated = validateHyphenString(str);
    return validated.replace(/-/g, "_").toUpperCase();
  };

  // AI capability check
  let cookbookToml: Awaited<ReturnType<typeof getCookbookToml>>;

  const useAIConfig = async () => {
    cookbookToml ||= await getCookbookToml();
    const { aiModel, aiBaseUrl, aiApiKey, aiModelDeepResearch } = cookbookToml?.config || {};

    if (aiModel && aiBaseUrl && aiApiKey) {
      return {
        aiBaseUrl,
        aiApiKey,
        aiModel,
        aiModelDeepResearch: aiModelDeepResearch ?? aiModel,
      };
    }
    return undefined;
  };

  // Project selector
  const selectTargetProject = async (opts?: Parameters<typeof selectProject>[1]) => {
    return selectProject(await getCookbookToml(), opts);
  };

  // Cookbook config loader
  const loadCookbookConfig = async () => {
    if (cookbookToml) return cookbookToml;

    cookbookToml = await getCookbookToml();
    if (!cookbookToml.config) {
      cookbookToml.config = {};
    }
    return cookbookToml;
  };

  const runDrizzleCommand = async (command?: string, project?: string, mode?: string) => {
    const module = await import("../commands/drizzle");
    return module.default({ ...utils } as any, command, project, mode);
  };

  // Command existence checker (supports PowerShell/Linux/Mac)
  const commandExists = async (cmd: string): Promise<boolean> => {
    try {
      return await new Promise<boolean>((resolve) => {
        const command = process.platform === "win32" ? "powershell -Command Get-Command" : "command -v";
        const child = spawn(command, [cmd], {
          shell: true,
          stdio: "ignore",
        });
        child.on("exit", (code) => resolve(code === 0));
        child.on("error", () => resolve(false));
      });
    } catch {
      return false;
    }
  };

  const gotoCommand = async (command: Promise<{ default: (...args: any[]) => any }>) => {
    await (await command).default(utils);
  };

  // Combined utilities
  const utils = {
    // Logging
    log,
    info,
    warn,
    error,
    success,
    debug,
    fatal,
    trace,
    start,
    box,
    prompt,

    // Path handling
    getScriptPath,
    getWorkspacePath,
    getParams: getCurrentParams,

    // User interaction
    inputBoolean: getBooleanInput,
    inputString: getStringInput,

    // Process control
    openProgress: startProgress,
    closeProgress: endProgress,

    // Capability checks
    useAIConfig: useAIConfig,
    fetchEventSource,

    // Project operations
    selectProject: selectTargetProject,
    getCookbookToml: loadCookbookConfig,

    // Command execution
    gotoCommand,
    gotoDrizzleCommand: runDrizzleCommand,

    // String transformations
    toCamelCase,
    toPascalCase,
    toSnakeCase,
    toConstantCase,

    // Command existence check
    commandExists,
  };

  return utils;
}
