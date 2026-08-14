import { expect, test } from "vitest";
import { Trie } from "../../../../packages/milkio/utils/trie.ts";

test.sequential("positive hits are cached", () => {
    const trie = new Trie<string>();
    trie.add("/a/b", "value");
    expect(trie.get("/a/b")).toBe("value");
    expect((trie as any).cache.size).toBe(1);
});

test.sequential("misses are not cached, preventing unbounded memory growth", () => {
    const trie = new Trie<string>();
    trie.add("/known", "value");
    for (let i = 0; i < 1000; i++) {
        expect(trie.get(`/unknown-${i}`)).toBeNull();
    }
    expect((trie as any).cache.size).toBe(1);
    expect(trie.get("/known")).toBe("value");
});
