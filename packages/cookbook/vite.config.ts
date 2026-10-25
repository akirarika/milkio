import { defineConfig } from "vite-plus";

// `co.exe` is a Node single executable application (SEA) built by Vite+
// (`vp pack`, powered by tsdown). By default we build for the host platform
// only. CI sets COOKBOOK_EXE_TARGETS=all to cross-build every published
// platform (tsdown downloads the matching Node.js binary from nodejs.org);
// a comma separated list such as "linux-x64,win-x64" selects a subset.
const nodeVersion = process.env.COOKBOOK_NODE_VERSION ?? "26.12.1";

const allTargets = [
    { platform: "darwin", arch: "arm64", nodeVersion },
    { platform: "darwin", arch: "x64", nodeVersion },
    { platform: "linux", arch: "arm64", nodeVersion },
    { platform: "linux", arch: "x64", nodeVersion },
    { platform: "win", arch: "x64", nodeVersion },
] as const;

function resolveTargets(): Array<(typeof allTargets)[number]> | undefined {
    const spec = process.env.COOKBOOK_EXE_TARGETS;
    if (!spec) return undefined;
    if (spec === "all") return [...allTargets];
    const wanted = new Set(spec.split(",").map((entry) => entry.trim()).filter(Boolean));
    const selected = allTargets.filter((target) => wanted.has(`${target.platform}-${target.arch}`));
    if (selected.length === 0) {
        throw new Error(`COOKBOOK_EXE_TARGETS did not match any target: ${spec}`);
    }
    return selected;
}

const targets = resolveTargets();

export default defineConfig({
    pack: {
        entry: ["cookbook.ts"],
        platform: "node",
        minify: true,
        sourcemap: "inline",
        // A single executable application must be fully self-contained: Node
        // SEA cannot resolve bare imports at runtime, so every package that
        // cookbook declares as a dependency has to be inlined (tsdown
        // externalizes package.json dependencies by default).
        deps: {
            alwaysBundle: [/./],
        },
        exe: targets ? { fileName: "co", targets } : { fileName: "co" },
    },
});
