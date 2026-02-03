import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";

export type LayoutDirection = "TB" | "LR" | "BT" | "RL";

interface LayoutOptions {
  direction?: LayoutDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number; // Vertical separation between ranks
  nodeSep?: number; // Horizontal separation between nodes
}

/**
 * Auto-layout nodes using Dagre algorithm.
 * Returns new nodes with updated positions.
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const {
    direction = "TB",
    nodeWidth = 250,
    nodeHeight = 100,
    rankSep = 120,
    nodeSep = 80,
  } = options;

  if (nodes.length === 0) {
    return { nodes, edges };
  }

  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  g.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
    marginx: 50,
    marginy: 50,
  });

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    // Use node dimensions if available, otherwise use defaults
    const width = node.measured?.width ?? nodeWidth;
    const height = node.measured?.height ?? nodeHeight;
    g.setNode(node.id, { width, height });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  // Run the layout algorithm
  dagre.layout(g);

  // Apply computed positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) {
      return node;
    }

    const width = node.measured?.width ?? nodeWidth;
    const height = node.measured?.height ?? nodeHeight;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Determine best layout direction based on diagram type.
 */
export function getLayoutDirection(diagramType: string): LayoutDirection {
  switch (diagramType) {
    case "sequence":
      return "TB"; // Top to bottom for time flow
    case "activity":
    case "state":
      return "TB"; // Flow diagrams go top-down
    case "class":
    case "component":
      return "TB"; // Hierarchical
    case "deployment":
      return "LR"; // Left to right for infrastructure
    case "architecture":
    case "hld":
    case "mindtree":
      return "TB"; // Layers / mind map top-down
    case "usecase":
      return "LR"; // Actors on left, use cases on right
    default:
      return "TB";
  }
}

/**
 * Get layout options optimized for specific diagram types.
 */
export function getLayoutOptions(diagramType: string): LayoutOptions {
  const direction = getLayoutDirection(diagramType);

  switch (diagramType) {
    case "sequence":
      return {
        direction,
        nodeWidth: 180,
        nodeHeight: 60,
        rankSep: 80,
        nodeSep: 100,
      };
    case "class":
      return {
        direction,
        nodeWidth: 280,
        nodeHeight: 180,
        rankSep: 150,
        nodeSep: 100,
      };
    case "architecture":
    case "hld":
      return {
        direction,
        nodeWidth: 220,
        nodeHeight: 80,
        rankSep: 140,
        nodeSep: 80,
      };
    case "mindtree":
      return {
        direction,
        nodeWidth: 180,
        nodeHeight: 60,
        rankSep: 100,
        nodeSep: 60,
      };
    case "usecase":
      return {
        direction,
        nodeWidth: 200,
        nodeHeight: 80,
        rankSep: 100,
        nodeSep: 60,
      };
    case "activity":
    case "state":
      return {
        direction,
        nodeWidth: 180,
        nodeHeight: 70,
        rankSep: 100,
        nodeSep: 70,
      };
    case "component":
      return {
        direction,
        nodeWidth: 220,
        nodeHeight: 70,
        rankSep: 120,
        nodeSep: 80,
      };
    case "deployment":
      return {
        direction,
        nodeWidth: 240,
        nodeHeight: 100,
        rankSep: 150,
        nodeSep: 100,
      };
    default:
      return {
        direction,
        nodeWidth: 200,
        nodeHeight: 80,
        rankSep: 120,
        nodeSep: 80,
      };
  }
}
