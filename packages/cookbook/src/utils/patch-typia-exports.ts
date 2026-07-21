import { readFile, writeFile } from "node:fs/promises";
import consola from "consola";

const WILDCARD_KEY = "./lib/internal/*";
const EXPLICIT_KEY = "./lib/internal/*.js";

/**
 * Ensures typia's package.json exports are patched for ESM resolution.
 *
 * typia (observed in 13.1.1) has an exports bug: the "./lib/internal/*"
 * pattern resolves requests carrying an explicit ".js" suffix (e.g.
 * "typia/lib/internal/_validateReport.js") to "*.js.mjs" under ESM import,
 * which breaks module loading. The fix inserts an explicit
 * "./lib/internal/*.js" entry — with the same mapping as the wildcard —
 * before the wildcard entry, so ".js"-suffixed requests resolve correctly.
 *
 * The check is deliberately loose and conservative, because typia may
 * release new versions that restructure package.json or fix the bug
 * upstream. The patch is applied ONLY when the exact known-buggy shape is
 * present:
 *   - "exports" is a plain object
 *   - "./lib/internal/*" exists (same layout as the affected versions)
 *   - "./lib/internal/*.js" is absent (not yet patched or fixed upstream)
 * In every other case the file is left completely untouched, and any
 * failure is swallowed so it never blocks startup.
 */
export async function ensureTypiaExportsPatched(typiaPackageJsonPath: string): Promise<void> {
    try {
        const raw = await readFile(typiaPackageJsonPath, "utf-8");
        const pkg = JSON.parse(raw);
        const exportsField = pkg?.exports;
        if (!exportsField || typeof exportsField !== "object" || Array.isArray(exportsField)) return;
        if (!(WILDCARD_KEY in exportsField)) return;
        if (EXPLICIT_KEY in exportsField) return;

        // insert the explicit ".js" entry immediately before the wildcard,
        // reusing the wildcard's own mapping (works regardless of whether the
        // mapping is a string or a conditions object)
        const patched: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(exportsField)) {
            if (key === WILDCARD_KEY) patched[EXPLICIT_KEY] = value;
            patched[key] = value;
        }
        pkg.exports = patched;
        await writeFile(typiaPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
        consola.info(`Patched typia exports: added "${EXPLICIT_KEY}" entry (${typiaPackageJsonPath})`);
    } catch {
        // patching is best-effort and must never block startup
    }
}
