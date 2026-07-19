"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps
} from "@xyflow/react";
import type { GraphEdge, GraphNode, GraphResponse } from "@/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { colorForType } from "./node-colors";

interface GraphCanvasProps {
  graph?: GraphResponse;
  height?: number;
  title?: string;
  onSelectedNodeChange?: (node: GraphNode | null) => void;
  onSelectedEdgeChange?: (edge: GraphEdge | null) => void;
}

type DependencyNodeData = {
  label: string;
  type: string;
  color: string;
  childCount: number;
  collapsed: boolean;
  selected: boolean;
  sourceHandleCount: number;
  targetHandleCount: number;
};

const EMPTY_GRAPH: GraphResponse = { nodes: [], edges: [] };

export function GraphCanvas({
  graph,
  height = 560,
  title = "Service Dependency Map",
  onSelectedNodeChange,
  onSelectedEdgeChange
}: GraphCanvasProps) {
  const source = graph ?? EMPTY_GRAPH;
  const hasGraph = source.nodes.length > 0;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(hasGraph ? source.rootNodeId ?? source.nodes[0]?.id ?? null : null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  useEffect(() => {
    setCollapsed(new Set());
    setSelectedId(hasGraph ? source.rootNodeId ?? source.nodes[0]?.id ?? null : null);
    setSelectedEdgeId(null);
  }, [hasGraph, source.rootNodeId, source.nodes]);

  const { nodes, edges } = useMemo(
    () => toFlowGraph(source, collapsed, selectedId, selectedEdgeId),
    [source, collapsed, selectedId, selectedEdgeId]
  );

  useEffect(() => {
    onSelectedNodeChange?.(source.nodes.find((node) => node.id === selectedId) ?? null);
  }, [onSelectedNodeChange, selectedId, source.nodes]);

  function toggleNode(nodeId: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">Service is the root. Double-click nodes to collapse or expand branches.</p>
        </div>
      </div>
      <div className="bg-background dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,8,23,1))]">
        <div style={{ height }} className="min-w-0">
          {hasGraph ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.22 }}
              minZoom={0.12}
              maxZoom={1.7}
              nodesDraggable
              nodesConnectable={false}
              elementsSelectable
              panOnDrag
              panOnScroll
              zoomOnScroll
              zoomOnPinch
              proOptions={{ hideAttribution: true }}
              onNodeClick={(_, node) => {
                setSelectedId(node.id);
                setSelectedEdgeId(null);
                onSelectedEdgeChange?.(null);
                onSelectedNodeChange?.(source.nodes.find((item) => item.id === node.id) ?? null);
              }}
              onEdgeClick={(_, edge) => {
                setSelectedId(null);
                setSelectedEdgeId(edge.id);
                onSelectedNodeChange?.(null);
                onSelectedEdgeChange?.(source.edges.find((item) => item.id === edge.id) ?? null);
              }}
              onNodeDoubleClick={(_, node) => toggleNode(node.id)}
            >
              <Background color="rgba(148, 163, 184, 0.18)" gap={36} />
              <Controls showInteractive={false} />
            </ReactFlow>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div>
                <div className="text-base font-semibold">No graph loaded</div>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">Search or select an item to load its relationship graph.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { dependency: DependencyNode };

function DependencyNode({ data }: NodeProps<Node<DependencyNodeData>>) {
  return (
    <div
      className={cn(
        "w-56 rounded-md border bg-card px-3 py-3 text-card-foreground shadow-[0_18px_44px_rgba(0,0,0,0.16)] transition-transform dark:bg-[#07111f]/95 dark:shadow-[0_18px_44px_rgba(0,0,0,0.34)]",
        data.selected && "scale-[1.03] shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_24px_52px_rgba(0,0,0,0.42)]"
      )}
      style={{ borderColor: String(data.color) }}
    >
      {Array.from({ length: Math.max(1, data.targetHandleCount) }).map((_, index) => (
        <Handle
          key={`target-${index}`}
          id={`target-${index}`}
          type="target"
          position={Position.Top}
          className="!h-2.5 !w-2.5 !border-0"
          style={{ backgroundColor: String(data.color), left: handleOffset(index, Math.max(1, data.targetHandleCount)) }}
        />
      ))}
      <div className="flex items-center gap-2">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-xs font-bold"
          style={{ backgroundColor: `${String(data.color)}24`, color: String(data.color) }}
        >
          {nodeInitial(data.type)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{String(data.label)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{columnLabel(String(data.type))}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Badge className="border-border bg-muted/60 text-[11px]">{data.childCount} child</Badge>
        {data.childCount > 0 ? (
          <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
            {data.collapsed ? "Collapsed" : "Expanded"}
          </span>
        ) : null}
      </div>
      {Array.from({ length: Math.max(1, data.sourceHandleCount) }).map((_, index) => (
        <Handle
          key={`source-${index}`}
          id={`source-${index}`}
          type="source"
          position={Position.Bottom}
          className="!h-2.5 !w-2.5 !border-0"
          style={{ backgroundColor: String(data.color), left: handleOffset(index, Math.max(1, data.sourceHandleCount)) }}
        />
      ))}
    </div>
  );
}

function toFlowGraph(
  graph: GraphResponse,
  collapsed: Set<string>,
  selectedId: string | null,
  selectedEdgeId: string | null
): { nodes: Node<DependencyNodeData>[]; edges: Edge[] } {
  const childrenById = createChildrenMap(graph);
  const hiddenIds = getHiddenNodeIds(graph, childrenById, collapsed);
  const positions = createTreePositions(graph, childrenById, hiddenIds);
  const visibleNodes = graph.nodes.filter((node) => !hiddenIds.has(node.id));
  const visibleEdges = graph.edges.filter((edge) => !hiddenIds.has(edge.source) && !hiddenIds.has(edge.target));
  const handleMap = createEdgeHandleMap(visibleEdges, positions);

  const nodes: Node<DependencyNodeData>[] = visibleNodes.map((node) => ({
    id: node.id,
    type: "dependency",
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: {
      label: node.name,
      type: node.type,
      color: colorForType(node.type),
      childCount: childrenById.get(node.id)?.length ?? 0,
      collapsed: collapsed.has(node.id),
      selected: selectedId === node.id,
      sourceHandleCount: handleMap.sourceCounts.get(node.id) ?? 0,
      targetHandleCount: handleMap.targetCounts.get(node.id) ?? 0
    }
  }));

  const edges: Edge[] = visibleEdges
    .map((edge) => {
      const sourceNode = graph.nodes.find((node) => node.id === edge.source);
      const edgeColor = sourceNode ? colorForType(sourceNode.type) : "#38bdf8";
      const selected = selectedEdgeId === edge.id;
      const isDependency = edge.type === "DEPENDS_ON";
      const handleIds = handleMap.edgeHandles.get(edge.id);

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: handleIds?.sourceHandle,
        targetHandle: handleIds?.targetHandle,
        type: "bezier",
        animated: isDependency || selected,
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
        interactionWidth: 24,
        style: {
          strokeWidth: selected ? 4.5 : isDependency ? 2.4 : 2.8,
          stroke: edgeColor,
          opacity: selectedEdgeId && !selected ? 0.28 : 0.94,
          strokeDasharray: isDependency ? "10 7" : undefined,
          filter: selected ? "drop-shadow(0 0 8px rgba(255,255,255,0.35))" : undefined
        }
      };
    });

  return { nodes, edges };
}

function handleOffset(index: number, count: number): string {
  if (count <= 1) {
    return "50%";
  }
  const min = 20;
  const max = 80;
  return `${min + (index * (max - min)) / (count - 1)}%`;
}

function createEdgeHandleMap(edges: GraphEdge[], positions: Map<string, { x: number; y: number }>) {
  const bySource = groupEdges(edges, (edge) => edge.source);
  const byTarget = groupEdges(edges, (edge) => edge.target);
  const edgeHandles = new Map<string, { sourceHandle: string; targetHandle: string }>();

  for (const sourceEdges of bySource.values()) {
    sourceEdges
      .sort((left, right) => compareEdgeTargets(left, right, positions))
      .forEach((edge, index) => {
        const current = edgeHandles.get(edge.id) ?? { sourceHandle: "source-0", targetHandle: "target-0" };
        edgeHandles.set(edge.id, { ...current, sourceHandle: `source-${index}` });
      });
  }

  for (const targetEdges of byTarget.values()) {
    targetEdges
      .sort((left, right) => compareEdgeSources(left, right, positions))
      .forEach((edge, index) => {
        const current = edgeHandles.get(edge.id) ?? { sourceHandle: "source-0", targetHandle: "target-0" };
        edgeHandles.set(edge.id, { ...current, targetHandle: `target-${index}` });
      });
  }

  return {
    edgeHandles,
    sourceCounts: new Map(Array.from(bySource.entries()).map(([nodeId, nodeEdges]) => [nodeId, nodeEdges.length])),
    targetCounts: new Map(Array.from(byTarget.entries()).map(([nodeId, nodeEdges]) => [nodeId, nodeEdges.length]))
  };
}

function compareEdgeTargets(left: GraphEdge, right: GraphEdge, positions: Map<string, { x: number; y: number }>) {
  return (positions.get(left.target)?.x ?? 0) - (positions.get(right.target)?.x ?? 0) || left.target.localeCompare(right.target);
}

function compareEdgeSources(left: GraphEdge, right: GraphEdge, positions: Map<string, { x: number; y: number }>) {
  return (positions.get(left.source)?.x ?? 0) - (positions.get(right.source)?.x ?? 0) || left.source.localeCompare(right.source);
}

function groupEdges(edges: GraphEdge[], keyFactory: (edge: GraphEdge) => string): Map<string, GraphEdge[]> {
  const grouped = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const key = keyFactory(edge);
    const items = grouped.get(key) ?? [];
    items.push(edge);
    grouped.set(key, items);
  }
  return grouped;
}

function createChildrenMap(graph: GraphResponse): Map<string, string[]> {
  const childrenById = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const children = childrenById.get(edge.source) ?? [];
    children.push(edge.target);
    childrenById.set(edge.source, children);
  }

  for (const [parentId, children] of childrenById) {
    childrenById.set(parentId, [...new Set(children)].sort((left, right) => nodeName(graph, left).localeCompare(nodeName(graph, right))));
  }
  return childrenById;
}

function getHiddenNodeIds(graph: GraphResponse, childrenById: Map<string, string[]>, collapsed: Set<string>): Set<string> {
  const rootId = graph.rootNodeId ?? graph.nodes.find((node) => node.type === "Service")?.id ?? graph.nodes[0]?.id;
  const visibleIds = new Set<string>();
  const queue = rootId ? [rootId] : [];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visibleIds.has(nodeId)) {
      continue;
    }
    visibleIds.add(nodeId);
    if (!collapsed.has(nodeId)) {
      queue.push(...(childrenById.get(nodeId) ?? []));
    }
  }

  return new Set(graph.nodes.filter((node) => !visibleIds.has(node.id)).map((node) => node.id));
}

function createTreePositions(
  graph: GraphResponse,
  childrenById: Map<string, string[]>,
  hiddenIds: Set<string>
): Map<string, { x: number; y: number }> {
  const dependencyPositions = createDependencyPositions(graph, childrenById, hiddenIds);
  if (dependencyPositions.size > 0) {
    return dependencyPositions;
  }

  const positions = new Map<string, { x: number; y: number }>();
  const rootId = graph.rootNodeId ?? graph.nodes.find((node) => node.type === "Service")?.id ?? graph.nodes[0]?.id;
  const roots = rootId ? [rootId] : [];
  const xGap = 290;
  const yGap = 175;
  let leafIndex = 0;

  function place(nodeId: string, depth: number): number {
    const children = (childrenById.get(nodeId) ?? []).filter((childId) => !hiddenIds.has(childId));
    if (children.length === 0) {
      const x = leafIndex * xGap;
      leafIndex += 1;
      positions.set(nodeId, { x, y: depth * yGap });
      return x;
    }

    const childXs = children.map((childId) => place(childId, depth + 1));
    const x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
    positions.set(nodeId, { x, y: depth * yGap });
    return x;
  }

  roots.forEach((root) => place(root, 0));
  centerPositions(positions);
  return positions;
}

function createDependencyPositions(
  graph: GraphResponse,
  childrenById: Map<string, string[]>,
  hiddenIds: Set<string>
): Map<string, { x: number; y: number }> {
  const rootId = graph.rootNodeId ?? graph.nodes.find((node) => node.type === "Service")?.id;
  if (!rootId || hiddenIds.has(rootId)) {
    return new Map();
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const visible = (nodeId: string) => !hiddenIds.has(nodeId);
  const directChannels = (childrenById.get(rootId) ?? []).filter(
    (nodeId) => visible(nodeId) && nodeById.get(nodeId)?.type === "DirectChannel"
  );
  if (directChannels.length === 0) {
    return new Map();
  }

  const positions = new Map<string, { x: number; y: number }>();
  const xGap = 340;
  const clusterGap = 420;
  const yGap = 220;
  let cursorX = 0;
  const dcCenters: number[] = [];

  for (const dcId of directChannels) {
    const apps = (childrenById.get(dcId) ?? []).filter(
      (nodeId) => visible(nodeId) && nodeById.get(nodeId)?.type === "Application"
    );
    const integrationIds = unique(
      apps.flatMap((appId) =>
        (childrenById.get(appId) ?? []).filter(
          (nodeId) => visible(nodeId) && nodeById.get(nodeId)?.type === "Integration"
        )
      )
    );
    const ordered = orderApplicationIntegrationLayers(graph, apps, integrationIds, childrenById);
    const integrations = ordered.integrations;
    const orderedApps = ordered.apps;
    const hardwareSpecs = unique(
      integrations.flatMap((integrationId) =>
        (childrenById.get(integrationId) ?? []).filter(
          (nodeId) => visible(nodeId) && nodeById.get(nodeId)?.type === "HardwareSpec"
        )
      )
    ).sort(
      (left, right) =>
        averageConnectedLayerIndex(left, integrations, (integrationId) => childrenById.get(integrationId) ?? []) -
          averageConnectedLayerIndex(right, integrations, (integrationId) => childrenById.get(integrationId) ?? []) ||
        nodeName(graph, left).localeCompare(nodeName(graph, right))
    );
    const width = Math.max(orderedApps.length, integrations.length, hardwareSpecs.length, 1) * xGap;
    const startX = cursorX;
    const centerX = startX + (width - xGap) / 2;

    positions.set(dcId, { x: centerX, y: yGap });
    orderedApps.forEach((appId, index) => positions.set(appId, { x: startX + index * xGap, y: yGap * 2 }));
    integrations.forEach((nodeId, index) => positions.set(nodeId, { x: startX + index * xGap, y: yGap * 3 }));
    hardwareSpecs.forEach((hardwareSpecId, index) =>
      positions.set(hardwareSpecId, { x: startX + index * xGap, y: yGap * 4 })
    );

    dcCenters.push(centerX);
    cursorX += width + clusterGap;
  }

  positions.set(rootId, {
    x: (Math.min(...dcCenters) + Math.max(...dcCenters)) / 2,
    y: 0
  });
  centerPositions(positions);
  return positions;
}

function orderApplicationIntegrationLayers(
  graph: GraphResponse,
  apps: string[],
  integrations: string[],
  childrenById: Map<string, string[]>
): { apps: string[]; integrations: string[] } {
  let orderedApps = [...apps].sort((left, right) => nodeName(graph, left).localeCompare(nodeName(graph, right)));
  let orderedIntegrations = [...integrations].sort((left, right) => nodeName(graph, left).localeCompare(nodeName(graph, right)));

  for (let iteration = 0; iteration < 4; iteration += 1) {
    orderedIntegrations = orderByConnectedLayer(
      graph,
      orderedIntegrations,
      orderedApps,
      (appId) => childrenById.get(appId) ?? []
    );
    orderedApps = orderByOwnConnections(
      graph,
      orderedApps,
      orderedIntegrations,
      (appId) => childrenById.get(appId) ?? []
    );
  }

  return { apps: orderedApps, integrations: orderedIntegrations };
}

function orderByConnectedLayer(
  graph: GraphResponse,
  nodes: string[],
  referenceLayer: string[],
  connectionIds: (nodeId: string) => string[]
): string[] {
  const originalIndex = new Map(nodes.map((nodeId, index) => [nodeId, index]));

  return [...nodes].sort((left, right) => {
    const leftScore = averageConnectedLayerIndex(left, referenceLayer, connectionIds);
    const rightScore = averageConnectedLayerIndex(right, referenceLayer, connectionIds);

    return (
      leftScore - rightScore ||
      (originalIndex.get(left) ?? 0) - (originalIndex.get(right) ?? 0) ||
      nodeName(graph, left).localeCompare(nodeName(graph, right))
    );
  });
}

function orderByOwnConnections(
  graph: GraphResponse,
  nodes: string[],
  referenceLayer: string[],
  connectionIds: (nodeId: string) => string[]
): string[] {
  const originalIndex = new Map(nodes.map((nodeId, index) => [nodeId, index]));

  return [...nodes].sort((left, right) => {
    const leftScore = averageOwnConnectionIndex(left, referenceLayer, connectionIds);
    const rightScore = averageOwnConnectionIndex(right, referenceLayer, connectionIds);

    return (
      leftScore - rightScore ||
      (originalIndex.get(left) ?? 0) - (originalIndex.get(right) ?? 0) ||
      nodeName(graph, left).localeCompare(nodeName(graph, right))
    );
  });
}

function averageConnectedLayerIndex(
  nodeId: string,
  referenceLayer: string[],
  connectionIds: (nodeId: string) => string[]
): number {
  const indexes = referenceLayer
    .map((referenceId, index) => (connectionIds(referenceId).includes(nodeId) ? index : null))
    .filter((index): index is number => index !== null);

  if (indexes.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  return indexes.reduce((total, index) => total + index, 0) / indexes.length;
}

function averageOwnConnectionIndex(
  nodeId: string,
  referenceLayer: string[],
  connectionIds: (nodeId: string) => string[]
): number {
  const connectedIds = new Set(connectionIds(nodeId));
  const indexes = referenceLayer
    .map((referenceId, index) => (connectedIds.has(referenceId) ? index : null))
    .filter((index): index is number => index !== null);

  if (indexes.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  return indexes.reduce((total, index) => total + index, 0) / indexes.length;
}

function centerPositions(positions: Map<string, { x: number; y: number }>) {
  const xs = Array.from(positions.values()).map((position) => position.x);
  if (xs.length === 0) {
    return;
  }
  const offset = (Math.min(...xs) + Math.max(...xs)) / 2;
  for (const [id, position] of positions) {
    positions.set(id, { ...position, x: position.x - offset });
  }
}

function nodeName(graph: GraphResponse, nodeId: string): string {
  return graph.nodes.find((node) => node.id === nodeId)?.name ?? nodeId;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function columnLabel(type: string): string {
  if (type === "DirectChannel") {
    return "Direct Channel";
  }
  if (type === "Application") {
    return "Application";
  }
  if (type === "Integration") {
    return "Integration";
  }
  if (type === "HardwareSpec") {
    return "Hardware Specification";
  }
  if (type === "ThirdParty") {
    return "Third Party";
  }
  return type;
}

function nodeInitial(type: string): string {
  if (type === "DirectChannel") {
    return "DC";
  }
  if (type === "HardwareSpec") {
    return "HW";
  }
  if (type === "ThirdParty") {
    return "TP";
  }
  return type.slice(0, 1).toUpperCase();
}
