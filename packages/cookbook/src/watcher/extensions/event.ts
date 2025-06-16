import { defineWatcherExtension } from "../extensions";

export const eventWatcherExtension = defineWatcherExtension({
  async: true,
  filter: (file) => {
    return file.type === "event";
  },
  declares: async (root, mode, options, project, changeFiles, allFiles) => {
    let header = "";
    const types = "";
    let content = "";

    content += "\n  interface $events";
    let eventIndex = 0;
    for await (const file of allFiles) {
      header += `\nimport type { _ as event_${eventIndex} } from "../${file.path}";`;
      if (eventIndex > 0) content += ", ";
      else content += " extends ";
      content += `event_${eventIndex}`;
      ++eventIndex;
    }
    content += " {}";

    return [header, types, content];
  },
});
