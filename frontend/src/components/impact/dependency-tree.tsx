import type { DependencyTreeNode } from "@/shared";
import { Badge } from "@/components/ui/badge";

export function DependencyTree({ nodes }: { nodes: DependencyTreeNode[] }) {
  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">No dependency paths found.</p>;
  }

  return (
    <div className="space-y-2">
      {nodes.map((node) => (
        <TreeNodeView key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}

function TreeNodeView({ node, depth }: { node: DependencyTreeNode; depth: number }) {
  return (
    <div>
      <div
        className="mb-2 flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2"
        style={{ marginLeft: depth * 16 }}
      >
        <span className="text-sm font-medium">{node.name}</span>
        <Badge className="border-white/10 bg-white/[0.04]">{node.type}</Badge>
      </div>
      {node.children.map((child) => (
        <TreeNodeView key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
