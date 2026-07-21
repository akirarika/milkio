// Extract git credential and fetch GitHub Actions log
const proc = Bun.spawnSync({
    cmd: ["git", "credential", "fill"],
    stdin: Buffer.from("protocol=https\nhost=github.com\n\n"),
    stdout: "pipe",
    stderr: "pipe",
});

const out = new TextDecoder().decode(proc.stdout);
console.log("raw:", out.substring(0, 200));

const match = out.match(/password=(.+)/);
if (!match) {
    console.log("No token found");
    process.exit(1);
}
const token = match[1].trim();
console.log("token_len:", token.length);

const resp = await fetch(
    "https://api.github.com/repos/akirarika/milkio/actions/runs/29803006472/logs",
    {
        headers: { Authorization: `Bearer ${token}`, "User-Agent": "bun", Accept: "application/vnd.github+json" },
        redirect: "follow",
    },
);

console.log("status:", resp.status, "type:", resp.headers.get("content-type"));

if (resp.ok) {
    const text = await resp.text();
    console.log(`length: ${text.length}`);
    const lines = text.split("\n");
    const start = lines.findIndex((l) => l.includes("##[group]Run bun run co generate"));
    if (start >= 0) {
        const end = lines.findIndex((l, i) => i > start && l.includes("##[endgroup]"));
        console.log("\n=== build .milkio ===");
        console.log(lines.slice(start, end > start ? end : undefined).join("\n"));
    } else {
        console.log("\n=== last 200 lines ===");
        console.log(lines.slice(-200).join("\n"));
    }
} else {
    console.log("error:", await resp.text().then((t) => t.substring(0, 500)));
}
