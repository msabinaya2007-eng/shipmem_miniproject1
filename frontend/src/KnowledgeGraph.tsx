import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  GitBranch,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  RefreshCw,
  Ship,
  Wrench,
  AlertTriangle,
  ClipboardList,
  Eye,
  Box,
  ArrowRight,
  X
} from "lucide-react";
import {
  fetchKnowledgeGraph,
  type KnowledgeGraphData,
  type KnowledgeGraphNode,
  type KnowledgeGraphEdge,
  type KnowledgeGraphNodeType
} from "./api";

// ---------------- STYLES & COLOR CONFIG ----------------

interface NodeTypeConfig {
  label: string;
  color: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
  icon: typeof Ship;
  radius: number;
}

const NODE_CONFIG: Record<KnowledgeGraphNodeType, NodeTypeConfig> = {
  vessel: {
    label: "Vessel",
    color: "#2563eb",
    bgLight: "#eff6ff",
    borderColor: "#3b82f6",
    textColor: "#1e40af",
    icon: Ship,
    radius: 32
  },
  component: {
    label: "Component",
    color: "#0f766e",
    bgLight: "#f0fdfa",
    borderColor: "#14b8a6",
    textColor: "#115e59",
    icon: Box,
    radius: 26
  },
  maintenance: {
    label: "Maintenance",
    color: "#d97706",
    bgLight: "#fffbeb",
    borderColor: "#f59e0b",
    textColor: "#b45309",
    icon: Wrench,
    radius: 22
  },
  incident: {
    label: "Incident",
    color: "#dc2626",
    bgLight: "#fef2f2",
    borderColor: "#ef4444",
    textColor: "#b91c1c",
    icon: AlertTriangle,
    radius: 22
  },
  repair: {
    label: "Repair",
    color: "#7c3aed",
    bgLight: "#faf5ff",
    borderColor: "#8b5cf6",
    textColor: "#6d28d9",
    icon: ClipboardList,
    radius: 22
  },
  inspection: {
    label: "Inspection",
    color: "#0284c7",
    bgLight: "#f0f9ff",
    borderColor: "#38bdf8",
    textColor: "#0369a1",
    icon: Eye,
    radius: 22
  }
};

interface PositionedNode extends KnowledgeGraphNode {
  x: number;
  y: number;
}

// ---------------- COMPONENT ----------------

export default function KnowledgeGraph({
  initialData,
  graph
}: {
  initialData?: KnowledgeGraphData | null;
  graph?: Record<string, string[]>;
}) {
  // If graph prop is provided, it's available as fallback
  void graph;
  const [data, setData] = useState<KnowledgeGraphData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [selectedVessel, setSelectedVessel] = useState<string>("All");

  // Interaction
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Canvas transform: Pan & Zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Node Dragging
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const nodePositionsRef = useRef<Record<string, { x: number; y: number }>>({});

  const svgRef = useRef<SVGSVGElement | null>(null);

  // ---------------- DATA FETCHING ----------------

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchKnowledgeGraph();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load knowledge graph data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) {
      void loadData();
    }
  }, [initialData, loadData]);

  // ---------------- LAYOUT CALCULATION ----------------

  const layout = useMemo(() => {
    if (!data || data.nodes.length === 0) {
      return { nodes: [] as PositionedNode[], edges: [] as KnowledgeGraphEdge[] };
    }

    const vessels = data.nodes.filter((n) => n.type === "vessel");
    const components = data.nodes.filter((n) => n.type === "component");
    const operational = data.nodes.filter(
      (n) => !["vessel", "component"].includes(n.type)
    );

    const positions: Record<string, { x: number; y: number }> = {
      ...nodePositionsRef.current
    };

    const width = 1000;
    const height = 700;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. Position Vessels
    if (vessels.length === 1) {
      const v = vessels[0];
      if (!positions[v.id]) {
        positions[v.id] = { x: centerX, y: centerY };
      }
    } else {
      const vSpacing = 360;
      vessels.forEach((v, idx) => {
        if (!positions[v.id]) {
          const offsetX = (idx - (vessels.length - 1) / 2) * vSpacing;
          positions[v.id] = { x: centerX + offsetX, y: centerY };
        }
      });
    }

    // 2. Position Components around their respective vessel
    components.forEach((c) => {
      if (!positions[c.id]) {
        const vId = c.vessel_id ? `vessel-${c.vessel_id}` : vessels[0]?.id;
        const vPos = positions[vId] || { x: centerX, y: centerY };

        // Find sibling components for same vessel
        const siblings = components.filter((comp) => comp.vessel_id === c.vessel_id);
        const index = siblings.findIndex((comp) => comp.id === c.id);
        const count = siblings.length || 1;

        const angle = (2 * Math.PI * index) / count - Math.PI / 2;
        const radius = 170;
        positions[c.id] = {
          x: vPos.x + radius * Math.cos(angle),
          y: vPos.y + radius * Math.sin(angle)
        };
      }
    });

    // 3. Position Operational records (maintenance, incidents, repairs, inspections)
    operational.forEach((op) => {
      if (!positions[op.id]) {
        // Find which component or vessel it connects to
        const connectedEdges = data.edges.filter(
          (e) => e.source === op.id || e.target === op.id
        );
        const targetEdge =
          connectedEdges.find((e) => e.source.startsWith("comp-") || e.target.startsWith("comp-")) ||
          connectedEdges[0];

        let anchorPos = { x: centerX, y: centerY };
        if (targetEdge) {
          const anchorId = targetEdge.source === op.id ? targetEdge.target : targetEdge.source;
          anchorPos = positions[anchorId] || anchorPos;
        }

        // Sub-angle based on op id hash or index
        const hash = op.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        const angle = ((hash % 360) * Math.PI) / 180;
        const radius = 120 + (hash % 40);

        positions[op.id] = {
          x: anchorPos.x + radius * Math.cos(angle),
          y: anchorPos.y + radius * Math.sin(angle)
        };
      }
    });

    nodePositionsRef.current = positions;

    const positionedNodes: PositionedNode[] = data.nodes.map((node) => ({
      ...node,
      x: positions[node.id]?.x ?? centerX,
      y: positions[node.id]?.y ?? centerY
    }));

    return {
      nodes: positionedNodes,
      edges: data.edges
    };
  }, [data]);

  // ---------------- FILTERING ----------------

  const vesselOptions = useMemo(() => {
    if (!data) return [];
    return data.nodes
      .filter((n) => n.type === "vessel")
      .map((n) => ({ id: n.id, name: n.label, vessel_id: n.vessel_id }));
  }, [data]);

  const filteredNodes = useMemo(() => {
    return layout.nodes.filter((node) => {
      // Type filter
      if (selectedType !== "All" && node.type !== selectedType.toLowerCase()) {
        return false;
      }
      // Vessel filter
      if (selectedVessel !== "All") {
        const vId = Number(selectedVessel);
        if (node.vessel_id !== vId && node.id !== `vessel-${vId}`) {
          return false;
        }
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesLabel = node.label.toLowerCase().includes(q);
        const matchesId = node.id.toLowerCase().includes(q);
        const metaStr = JSON.stringify(node.metadata).toLowerCase();
        const matchesMeta = metaStr.includes(q);
        return matchesLabel || matchesId || matchesMeta;
      }
      return true;
    });
  }, [layout.nodes, selectedType, selectedVessel, searchQuery]);

  const visibleNodeIds = useMemo(() => {
    return new Set(filteredNodes.map((n) => n.id));
  }, [filteredNodes]);

  const filteredEdges = useMemo(() => {
    return layout.edges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, [layout.edges, visibleNodeIds]);

  // Selected node & its connected nodes
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return layout.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [layout.nodes, selectedNodeId]);

  const connectedInfo = useMemo(() => {
    if (!selectedNodeId || !data) return { nodes: [], edges: [] };

    const directEdges = data.edges.filter(
      (e) => e.source === selectedNodeId || e.target === selectedNodeId
    );

    const neighborIds = new Set<string>();
    directEdges.forEach((e) => {
      neighborIds.add(e.source === selectedNodeId ? e.target : e.source);
    });

    const neighbors = layout.nodes.filter((n) => neighborIds.has(n.id));

    return {
      nodes: neighbors,
      edges: directEdges
    };
  }, [selectedNodeId, data, layout.nodes]);

  // ---------------- CANVAS CONTROLS ----------------

  function handleZoomIn() {
    setZoom((prev) => Math.min(prev * 1.25, 2.8));
  }

  function handleZoomOut() {
    setZoom((prev) => Math.max(prev * 0.8, 0.4));
  }

  function handleResetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function handleFitToView() {
    if (filteredNodes.length === 0) return;
    const xs = filteredNodes.map((n) => n.x);
    const ys = filteredNodes.map((n) => n.y);
    const minX = Math.min(...xs) - 80;
    const maxX = Math.max(...xs) + 80;
    const minY = Math.min(...ys) - 80;
    const maxY = Math.max(...ys) + 80;

    const graphW = maxX - minX || 800;
    const graphH = maxY - minY || 600;

    const containerW = 900;
    const containerH = 600;

    const scale = Math.min(containerW / graphW, containerH / graphH, 1.4);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    setZoom(scale);
    setPan({
      x: containerW / 2 - midX * scale,
      y: containerH / 2 - midY * scale
    });
  }

  // Wheel zoom
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(Math.max(prev * factor, 0.35), 2.8));
  }

  // Drag-to-pan canvas
  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0 || draggingNodeId) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      });
    } else if (draggingNodeId) {
      // Reposition dragged node
      const deltaX = (e.clientX - dragStartRef.current.x) / zoom;
      const deltaY = (e.clientY - dragStartRef.current.y) / zoom;

      const current = nodePositionsRef.current[draggingNodeId] || { x: 500, y: 350 };
      nodePositionsRef.current[draggingNodeId] = {
        x: current.x + deltaX,
        y: current.y + deltaY
      };
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      // Trigger re-render
      setData((prev) => (prev ? { ...prev } : null));
    }
  }

  function handleMouseUp() {
    setIsPanning(false);
    setDraggingNodeId(null);
  }

  // ---------------- NODE RENDERING HELPERS ----------------

  const activeFocusId = hoveredNodeId || selectedNodeId;

  function isNodeHighlighted(nodeId: string) {
    if (!activeFocusId) return true;
    if (nodeId === activeFocusId) return true;
    return connectedInfo.nodes.some((n) => n.id === nodeId);
  }

  function isEdgeHighlighted(edge: KnowledgeGraphEdge) {
    if (!activeFocusId) return true;
    return edge.source === activeFocusId || edge.target === activeFocusId;
  }

  // ---------------- RENDER ----------------

  return (
    <div className="space-y-6">
      {/* HEADER CARD */}
      <div className="rounded-2xl border border-[#d5ded8] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#daf0e7] p-3 text-[#146459]">
              <GitBranch size={24} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#0f2d3a]">
                Maritime Operational Knowledge Graph
              </h2>
              <p className="text-xs font-medium text-[#2d4d46]">
                Real-world relational memory network connecting vessels, equipment, maintenance, incidents, and inspections.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadData()}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-[#cad8ce] bg-[#f8faf8] px-4 py-2.5 text-xs font-bold text-[#185e54] transition hover:bg-[#eef5f1] disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh Graph
            </button>
          </div>
        </div>

        {/* METRICS BAR */}
        {data && (
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#edf1ec] pt-5 sm:grid-cols-3 md:grid-cols-6">
            <div className="rounded-xl bg-[#f8faf7] p-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#264d45]">
                Total Nodes
              </span>
              <p className="text-lg font-extrabold text-[#0f2d3a]">
                {data.stats.total_nodes}
              </p>
            </div>
            <div className="rounded-xl bg-[#f8faf7] p-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#264d45]">
                Relationships
              </span>
              <p className="text-lg font-extrabold text-[#0f2d3a]">
                {data.stats.total_edges}
              </p>
            </div>
            <div className="rounded-xl bg-[#dce6f5] p-3 text-[#1e40af]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1e40af]">
                Vessels
              </span>
              <p className="text-lg font-extrabold">
                {data.stats.by_type.vessel || 0}
              </p>
            </div>
            <div className="rounded-xl bg-[#daf0e7] p-3 text-[#0f5c54]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0f5c54]">
                Components
              </span>
              <p className="text-lg font-extrabold">
                {data.stats.by_type.component || 0}
              </p>
            </div>
            <div className="rounded-xl bg-[#fcecd7] p-3 text-[#9c5f18]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#9c5f18]">
                Maintenance
              </span>
              <p className="text-lg font-extrabold">
                {data.stats.by_type.maintenance || 0}
              </p>
            </div>
            <div className="rounded-xl bg-[#fde2db] p-3 text-[#b83f2a]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#b83f2a]">
                Incidents & Repairs
              </span>
              <p className="text-lg font-extrabold">
                {(data.stats.by_type.incident || 0) + (data.stats.by_type.repair || 0)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* FILTER & TOOLBAR */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#d5ded8] bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3d635b]"
            />
            <input
              type="text"
              placeholder="Search nodes, components, records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[#cad8ce] bg-[#f8faf8] py-2 pl-9 pr-3 text-xs font-medium text-[#0f2d3a] placeholder-[#64847c] focus:border-[#1e7a6e] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3d635b] hover:text-[#0f2d3a]"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Type Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {["All", "Vessel", "Component", "Maintenance", "Incident", "Repair", "Inspection"].map(
              (type) => {
                const active = selectedType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? "bg-[#186862] text-white shadow-xs"
                        : "bg-[#edf4ee] text-[#1c473f] hover:bg-[#e1ede4]"
                    }`}
                  >
                    {type}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Vessel Filter Dropdown */}
        {vesselOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#2d524a]">Vessel:</span>
            <select
              value={selectedVessel}
              onChange={(e) => setSelectedVessel(e.target.value)}
              className="rounded-xl border border-[#cad8ce] bg-[#f8faf8] px-3 py-1.5 text-xs font-bold text-[#0f2d3a] focus:border-[#1e7a6e] focus:outline-none"
            >
              <option value="All">All Vessels ({vesselOptions.length})</option>
              {vesselOptions.map((v) => (
                <option key={v.id} value={String(v.vessel_id)}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* GRAPH CANVAS & SIDE INSPECTOR */}
      <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* CANVAS (8 or 12 COLS) */}
        <div
          className={`relative overflow-hidden rounded-2xl border border-[#d5ded8] bg-[#fafcf9] shadow-sm transition-all ${
            selectedNode ? "lg:col-span-8" : "lg:col-span-12"
          }`}
          style={{ minHeight: 640 }}
        >
          {/* Canvas Floating Toolbar */}
          <div className="absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-xl border border-[#cad8ce] bg-white/95 p-1.5 shadow-md backdrop-blur-xs">
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="rounded-lg p-2 text-[#264d45] transition hover:bg-[#ebf4ef]"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="rounded-lg p-2 text-[#264d45] transition hover:bg-[#ebf4ef]"
            >
              <ZoomOut size={16} />
            </button>
            <div className="h-4 w-px bg-[#d5ded8]" />
            <button
              onClick={handleFitToView}
              title="Fit to View"
              className="rounded-lg p-2 text-[#264d45] transition hover:bg-[#ebf4ef]"
            >
              <Maximize2 size={16} />
            </button>
            <button
              onClick={handleResetView}
              title="Reset View (100%)"
              className="rounded-lg p-2 text-[#264d45] transition hover:bg-[#ebf4ef]"
            >
              <RotateCcw size={16} />
            </button>
            <span className="px-2 text-[11px] font-bold text-[#2d524a]">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Canvas Legend */}
          <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-[#cad8ce] bg-white/95 px-3 py-2 text-[11px] font-bold shadow-xs backdrop-blur-xs">
            <span className="font-extrabold text-[#0f2d3a]">Legend:</span>
            {Object.entries(NODE_CONFIG).map(([type, cfg]) => (
              <div key={type} className="flex items-center gap-1 text-[#1a3d36]">
                <span
                  className="flex h-3 w-3 items-center justify-center rounded-full"
                  style={{ backgroundColor: cfg.color }}
                />
                <span>{cfg.label}</span>
              </div>
            ))}
          </div>

          {/* Interactive SVG Canvas */}
          {loading ? (
            <div className="flex h-full min-h-[500px] flex-col items-center justify-center gap-3">
              <RefreshCw size={28} className="animate-spin text-[#34877c]" />
              <p className="text-xs font-semibold text-[#6f8a81]">
                Generating maritime knowledge graph from database...
              </p>
            </div>
          ) : error ? (
            <div className="flex h-full min-h-[500px] flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle size={32} className="text-[#c25e4c]" />
              <p className="text-sm font-semibold text-[#31545c]">{error}</p>
              <button
                onClick={() => void loadData()}
                className="mt-2 rounded-xl bg-[#287d7b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#206967]"
              >
                Retry
              </button>
            </div>
          ) : filteredNodes.length === 0 ? (
            <div className="flex h-full min-h-[500px] flex-col items-center justify-center gap-2 p-6 text-center">
              <GitBranch size={32} className="text-[#146459]" />
              <p className="text-sm font-bold text-[#0f2d3a]">
                No matching operational relationships
              </p>
              <p className="max-w-sm text-xs font-medium text-[#2d4d46]">
                Try adjusting your search query or type filter to explore the vessel knowledge graph.
              </p>
            </div>
          ) : (
            <svg
              ref={svgRef}
              className="h-full w-full cursor-grab active:cursor-grabbing select-none"
              style={{ minHeight: 640 }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <defs>
                {/* Arrowhead marker */}
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#94a3b8" />
                </marker>
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#287d7b" />
                </marker>
              </defs>

              <g
                transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
                style={{ transition: "transform 0.05s ease-out" }}
              >
                {/* EDGES */}
                {filteredEdges.map((edge) => {
                  const srcNode = layout.nodes.find((n) => n.id === edge.source);
                  const tgtNode = layout.nodes.find((n) => n.id === edge.target);
                  if (!srcNode || !tgtNode) return null;

                  const highlighted = isEdgeHighlighted(edge);
                  const midX = (srcNode.x + tgtNode.x) / 2;
                  const midY = (srcNode.y + tgtNode.y) / 2;

                  return (
                    <g key={edge.id} className="transition-opacity duration-200">
                      <line
                        x1={srcNode.x}
                        y1={srcNode.y}
                        x2={tgtNode.x}
                        y2={tgtNode.y}
                        stroke={highlighted ? (activeFocusId ? "#287d7b" : "#cbd5e1") : "#e2e8f0"}
                        strokeWidth={highlighted ? (activeFocusId ? 2.5 : 1.5) : 1}
                        strokeDasharray={edge.relationship.includes("history") ? "4 3" : undefined}
                        opacity={highlighted ? 0.9 : 0.25}
                        markerEnd={highlighted && activeFocusId ? "url(#arrow-active)" : "url(#arrow)"}
                      />
                      {/* Edge Label Pill */}
                      {zoom > 0.75 && (
                        <g transform={`translate(${midX}, ${midY})`}>
                          <rect
                            x={-(edge.label.length * 3.2 + 6)}
                            y="-9"
                            width={edge.label.length * 6.4 + 12}
                            height="18"
                            rx="5"
                            fill="white"
                            stroke={highlighted && activeFocusId ? "#287d7b" : "#e2e8f0"}
                            strokeWidth="1"
                            opacity={highlighted ? 0.95 : 0.3}
                          />
                          <text
                            textAnchor="middle"
                            y="3"
                            fontSize="9"
                            fontWeight="600"
                            fill={highlighted && activeFocusId ? "#115e59" : "#64748b"}
                            opacity={highlighted ? 1 : 0.3}
                          >
                            {edge.label}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* NODES */}
                {filteredNodes.map((node) => {
                  const cfg = NODE_CONFIG[node.type] || NODE_CONFIG.component;
                  const isSelected = selectedNodeId === node.id;
                  const isHovered = hoveredNodeId === node.id;
                  const highlighted = isNodeHighlighted(node.id);
                  const radius = cfg.radius;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      className="cursor-pointer transition-opacity duration-200"
                      opacity={highlighted ? 1 : 0.25}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingNodeId(node.id);
                        dragStartRef.current = { x: e.clientX, y: e.clientY };
                      }}
                    >
                      {/* Pulse effect on selected node */}
                      {isSelected && (
                        <circle
                          r={radius + 8}
                          fill="none"
                          stroke={cfg.color}
                          strokeWidth="2.5"
                          strokeDasharray="4 3"
                          className="animate-spin"
                          style={{ animationDuration: "12s" }}
                        />
                      )}

                      {/* Main Node Circle */}
                      <circle
                        r={radius}
                        fill={cfg.bgLight}
                        stroke={isSelected ? cfg.color : isHovered ? cfg.color : cfg.borderColor}
                        strokeWidth={isSelected ? 3 : 2}
                        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.06))"
                      />

                      {/* Center Node Symbol / Text */}
                      <text
                        textAnchor="middle"
                        y="4"
                        fontSize={node.type === "vessel" ? "12" : "10"}
                        fontWeight="700"
                        fill={cfg.textColor}
                      >
                        {node.type === "vessel"
                          ? "⚓"
                          : node.type === "component"
                          ? "⚙"
                          : node.type === "maintenance"
                          ? "🔧"
                          : node.type === "incident"
                          ? "⚠"
                          : node.type === "repair"
                          ? "🛠"
                          : "👁"}
                      </text>

                      {/* Node Label Below */}
                      <g transform={`translate(0, ${radius + 15})`}>
                        <rect
                          x={-(node.label.length * 3.4 + 8)}
                          y="-9"
                          width={node.label.length * 6.8 + 16}
                          height="18"
                          rx="6"
                          fill="white"
                          stroke={isSelected ? cfg.color : "#cad8ce"}
                          strokeWidth={isSelected ? 1.5 : 1}
                          filter="drop-shadow(0 1px 2px rgba(0,0,0,0.04))"
                        />
                        <text
                          textAnchor="middle"
                          y="3.5"
                          fontSize="10"
                          fontWeight={isSelected ? "800" : "700"}
                          fill="#0f2d3a"
                        >
                          {node.label}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>

        {/* SIDE INSPECTOR PANEL (4 COLS) */}
        {selectedNode && (
          <div className="rounded-2xl border border-[#d5ded8] bg-white p-6 shadow-sm lg:col-span-4">
            <div className="mb-4 flex items-start justify-between border-b border-[#edf1ec] pb-4">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: NODE_CONFIG[selectedNode.type]?.bgLight,
                    color: NODE_CONFIG[selectedNode.type]?.color
                  }}
                >
                  {selectedNode.type === "vessel" ? (
                    <Ship size={18} />
                  ) : selectedNode.type === "component" ? (
                    <Box size={18} />
                  ) : selectedNode.type === "maintenance" ? (
                    <Wrench size={18} />
                  ) : selectedNode.type === "incident" ? (
                    <AlertTriangle size={18} />
                  ) : selectedNode.type === "repair" ? (
                    <ClipboardList size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </span>
                <div>
                  <span
                    className="inline-block rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                    style={{
                      backgroundColor: NODE_CONFIG[selectedNode.type]?.bgLight,
                      color: NODE_CONFIG[selectedNode.type]?.textColor
                    }}
                  >
                    {NODE_CONFIG[selectedNode.type]?.label}
                  </span>
                  <h3 className="font-extrabold text-[#0f2d3a]">{selectedNode.label}</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="rounded-lg p-1 text-[#2d524a] hover:bg-[#edf4ee] hover:text-[#0f2d3a]"
              >
                <X size={16} />
              </button>
            </div>

            {/* METADATA PROPERTIES */}
            <div className="mb-5 space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#1c473f]">
                Operational Metadata
              </h4>
              <div className="rounded-xl border border-[#d5ded8] bg-[#f8faf7] p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-bold text-[#264d45]">Node ID:</span>
                  <span className="font-mono font-bold text-[#0f2d3a]">
                    {selectedNode.id}
                  </span>
                </div>
                {Object.entries(selectedNode.metadata).map(([key, val]) => {
                  if (val === null || val === undefined || val === "") return null;
                  const formattedKey = key
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <div key={key} className="flex justify-between gap-2">
                      <span className="font-bold text-[#264d45]">{formattedKey}:</span>
                      <span className="font-semibold text-[#0f2d3a] text-right truncate max-w-[180px]">
                        {String(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CONNECTED ENTITIES */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#1c473f]">
                  Connected Entities ({connectedInfo.nodes.length})
                </h4>
              </div>

              {connectedInfo.nodes.length === 0 ? (
                <p className="rounded-xl bg-[#f8faf7] p-3 text-xs font-medium text-[#4a6e65]">
                  No directly connected entities.
                </p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {connectedInfo.nodes.map((n) => {
                    const edge = connectedInfo.edges.find(
                      (e) =>
                        (e.source === selectedNode.id && e.target === n.id) ||
                        (e.target === selectedNode.id && e.source === n.id)
                    );
                    const nCfg = NODE_CONFIG[n.type] || NODE_CONFIG.component;

                    return (
                      <button
                        key={n.id}
                        onClick={() => setSelectedNodeId(n.id)}
                        className="flex w-full items-center justify-between rounded-xl border border-[#d5ded8] bg-[#fafcf9] p-2.5 text-left transition hover:border-[#186862] hover:bg-[#edf5f0]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: nCfg.color }}
                            />
                            <p className="truncate text-xs font-bold text-[#0f2d3a]">
                              {n.label}
                            </p>
                          </div>
                          {edge && (
                            <p className="mt-0.5 text-[11px] font-medium text-[#2d524a]">
                              Relationship:{" "}
                              <span className="font-bold text-[#0f5c54]">
                                {edge.relationship}
                              </span>
                            </p>
                          )}
                        </div>
                        <ArrowRight size={13} className="text-[#264d45]" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
