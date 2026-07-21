#!/usr/bin/env bun

import { cookbook } from './src/index'

// When running as the detached background dev server spawned by "co start",
// redirect stdout/stderr into rotating log files before anything else logs.
if (process.env.COOKBOOK_BACKGROUND === "1") {
    const { installBackgroundLogger } = await import("./src/utils/background-logger");
    installBackgroundLogger();
}

await cookbook();
