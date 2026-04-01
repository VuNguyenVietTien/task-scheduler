/**
 * Converts a simple indented list into an ASCII file/folder tree.
 *
 * Input format (2 or 4-space indent, or tabs):
 *   ecommerce-app/
 *     src/
 *       main/
 *         App.java
 *     README.md
 *
 * Output:
 *   ecommerce-app/
 *   └── src/
 *       └── main/
 *           └── App.java
 *   └── README.md   ← corrected: ├── when siblings follow
 */

interface TreeNode {
  name: string;
  children: TreeNode[];
}

/** Detect indent size from the first indented line */
function detectIndentSize(lines: string[]): number {
  for (const line of lines) {
    const match = line.match(/^(\s+)\S/);
    if (match) return match[1].replace(/\t/g, '  ').length;
  }
  return 2;
}

/** Parse indented text into a tree of nodes */
function parseIndentedList(text: string): TreeNode[] {
  const rawLines = text.split('\n').filter(l => l.trim().length > 0);
  const indentSize = detectIndentSize(rawLines);

  const root: TreeNode = { name: '__root__', children: [] };
  // Stack entries: [node, depth]
  const stack: Array<{ node: TreeNode; depth: number }> = [{ node: root, depth: -1 }];

  for (const raw of rawLines) {
    const spaces = raw.match(/^(\s*)/)?.[1] ?? '';
    const depth = Math.floor(spaces.replace(/\t/g, '  ').length / indentSize);
    const name = raw.trim();

    const node: TreeNode = { name, children: [] };

    // Pop stack until we find the parent
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    stack[stack.length - 1].node.children.push(node);
    stack.push({ node, depth });
  }

  return root.children;
}

/** Render tree nodes into ASCII lines */
function renderNodes(nodes: TreeNode[], prefix: string): string[] {
  const lines: string[] = [];

  nodes.forEach((node, index) => {
    const isLast = index === nodes.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');

    lines.push(prefix + connector + node.name);

    if (node.children.length > 0) {
      lines.push(...renderNodes(node.children, childPrefix));
    }
  });

  return lines;
}

/**
 * Convert indented text to ASCII tree string.
 * The root item(s) are rendered without a connector.
 */
export function generateAsciiTree(text: string): string {
  const nodes = parseIndentedList(text);
  if (nodes.length === 0) return '';

  const lines: string[] = [];

  nodes.forEach((node, index) => {
    const isOnlyRoot = nodes.length === 1;

    if (isOnlyRoot) {
      // Single root: print it directly, children start with connectors
      lines.push(node.name);
      if (node.children.length > 0) {
        lines.push(...renderNodes(node.children, ''));
      }
    } else {
      // Multiple roots: treat each as a top-level item
      const isLast = index === nodes.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';
      lines.push(connector + node.name);
      if (node.children.length > 0) {
        lines.push(...renderNodes(node.children, childPrefix));
      }
    }
  });

  return lines.join('\n');
}
