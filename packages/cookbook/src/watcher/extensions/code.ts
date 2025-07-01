import { defineWatcherExtension } from "../extensions";

export const codeWatcherExtension = defineWatcherExtension({
  async: true,
  filter: (file) => {
    return file.type === "code";
  },
  declares: async (root, mode, options, project, changeFiles, allFiles) => {
    let header = "";
    const types = "";
    let content = "";

    content += "\n  interface $rejectCode";
    let codeIndex = 0;
    for await (const file of allFiles) {
      header += `\nimport type { _ as code_${codeIndex} } from "../app/${file.path}";`;
      if (codeIndex > 0) content += ", ";
      else content += " extends ";
      content += `code_${codeIndex}`;
      ++codeIndex;
    }
    content += " {}";

    return [header, types, content];
  },
});
