export class Trie<T> {
    private root: TrieNode<T>;
    private cache: Map<string, T | null>;

    constructor() {
        this.root = new TrieNode();
        this.cache = new Map();
    }

    add(path: string, value: T): void {
        const parts = path
            .replace(/^\/+|\/+$/g, "")
            .split("/")
            .filter((p) => p !== "");
        let currentNode = this.root;
        if (parts.length === 0) {
            currentNode.value = value;
            this.cache.set(path, value);
            return;
        }
        for (const part of parts) {
            if (!currentNode.children.has(part)) {
                currentNode.children.set(part, new TrieNode());
            }
            currentNode = currentNode.children.get(part)!;
        }
        currentNode.value = value;
        this.cache.set(path, value);
    }

    get(path: string): T | null {
        const cached = this.cache.get(path);
        if (cached !== undefined) return cached;

        const parts = path
            .replace(/^\/+|\/+$/g, "")
            .split("/")
            .filter((p) => p !== "");
        let currentNode = this.root;
        for (const part of parts) {
            if (!currentNode.children.has(part)) {
                this.cache.set(path, null);
                return null;
            }
            currentNode = currentNode.children.get(part)!;
        }
        const result = currentNode.value;
        this.cache.set(path, result);
        return result;
    }

    getByParts(parts: string[]): T | null {
        let currentNode = this.root;
        for (const part of parts) {
            if (!currentNode.children.has(part)) return null;
            currentNode = currentNode.children.get(part)!;
        }
        return currentNode.value;
    }

    has(path: string): boolean {
        return this.get(path) !== null;
    }
}

class TrieNode<T> {
    children: Map<string, TrieNode<T>>;
    value: T | null;

    constructor() {
        this.children = new Map();
        this.value = null;
    }
}
