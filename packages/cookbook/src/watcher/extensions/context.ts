import { defineWatcherExtension } from "../extensions";

export const contextWatcherExtension = defineWatcherExtension({
  async: true,
  filter: (file) => {
    return file.type === "context";
  },
  declares: async (root, mode, options, project, changeFiles, allFiles) => {
    let header = "";
    const types = "";
    let content = "";

    content += "\n  interface $context";
    let contextIndex = 0;
    for await (const file of allFiles) {
      header += `\nimport type { _ as context_${contextIndex} } from "../${file.path}";`;
      if (contextIndex > 0) content += ", ";
      else content += " extends ";
      content += `context_${contextIndex}`;
      ++contextIndex;
    }
    content += " {}";

    return [header, types, content];
  },
});
