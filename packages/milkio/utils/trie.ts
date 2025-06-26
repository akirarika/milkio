export class Trie<T> {
  private root: TrieNode<T>;

  constructor() {
    this.root = new TrieNode();
  }

  add(path: string, value: T): void {
    const parts = path
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter((p) => p !== "");
    let currentNode = this.root;
    if (parts.length === 0) {
      currentNode.value = value;
      return;
    }
    for (const part of parts) {
      if (!currentNode.children.has(part)) {
        currentNode.children.set(part, new TrieNode());
      }
      currentNode = currentNode.children.get(part)!;
    }
    currentNode.value = value;
  }

  get(path: string): T | null {
    const parts = path
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter((p) => p !== "");
    let currentNode = this.root;
    for (const part of parts) {
      if (!currentNode.children.has(part)) return null;
      currentNode = currentNode.children.get(part)!;
    }
    return currentNode.value;
  }

  has(path: string): boolean {
    const parts = path
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter((p) => p !== "");
    let currentNode = this.root;
    if (parts.length === 0) return currentNode.value !== null;
    for (const part of parts) {
      if (!currentNode.children.has(part)) return false;
      else currentNode = currentNode.children.get(part)!;
    }
    return currentNode.value !== null;
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
