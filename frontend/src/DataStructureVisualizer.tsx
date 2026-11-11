import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  List,
  Layers,
  ClipboardList,
  GitBranch,
  Network,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  Eye,
  ChevronRight,
  ChevronDown,
  Ship,
  Wrench,
  Info,
  Box,
  RefreshCw
} from "lucide-react";
import {
  fetchComponentTree,
  fetchKnowledgeGraph,
  fetchGraphBFS,
  fetchGraphDFS,
  type Maintenance,
  type Incident,
  type Inspection,
  type Repair,
  type Activity,
  type ComponentTreeNode,
  type KnowledgeGraphData
} from "./api";

// ---------------- TYPES ----------------

type VisualizerTab = "List" | "Stack" | "Queue" | "Tree" | "Graph";

interface DataStructureVisualizerProps {
  maintenance: Maintenance[];
  incidents: Incident[];
  inspections: Inspection[];
  repairs: Repair[];
  activityHistory: Activity[];
  vessels: { vessel_id: number; vessel_name: string }[];
  graph?: Record<string, string[]>;
}

export default function DataStructureVisualizer({
  maintenance,
  incidents,
  inspections,
  repairs,
  activityHistory,
  vessels,
  graph
}: DataStructureVisualizerProps) {
  void graph;
  const [activeTab, setActiveTab] = useState<VisualizerTab>("List");

  const tabs: { label: VisualizerTab; icon: typeof List; description: string }[] = [
    { label: "List", icon: List, description: "Sequential Linked List of operational logs" },
    { label: "Stack", icon: Layers, description: "LIFO operational event stack" },
    { label: "Queue", icon: ClipboardList, description: "FIFO pending maintenance task queue" },
    { label: "Tree", icon: GitBranch, description: "Hierarchical Vessel Component Tree" },
    { label: "Graph", icon: Network, description: "Operational network & BFS/DFS traversals" }
  ];

  return (
    <div className="space-y-6">
      {/* HEADER CARD */}
      <div className="rounded-2xl border border-[#d5ded8] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-[#0f2d3a]">
              Maritime Data Structure Visualizer
            </h2>
            <p className="text-xs font-medium text-[#2d4d46]">
              Interactive visual algorithms and structures modeled directly on SHIPMEM database records.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#dcefe5] px-3 py-1.5 text-xs font-extrabold text-[#0f5c54]">
              Mode: {activeTab}
            </span>
          </div>
        </div>

        {/* TAB BUTTONS */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-[#edf1ec] pt-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.label;
            return (
              <button
                key={tab.label}
                onClick={() => setActiveTab(tab.label)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  active
                    ? "bg-[#186862] text-white shadow-xs"
                    : "bg-[#edf4ee] text-[#1c473f] hover:bg-[#e1ede4]"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ACTIVE VISUALIZER TAB CONTENT */}
      {activeTab === "List" && (
        <ListVisualizer
          maintenance={maintenance}
          incidents={incidents}
          inspections={inspections}
          repairs={repairs}
        />
      )}

      {activeTab === "Stack" && (
        <StackVisualizer activityHistory={activityHistory} />
      )}

      {activeTab === "Queue" && (
        <QueueVisualizer maintenance={maintenance} />
      )}

      {activeTab === "Tree" && (
        <TreeVisualizer vessels={vessels} />
      )}

      {activeTab === "Graph" && (
        <GraphVisualizer />
      )}
    </div>
  );
}

// =======================================================================
// A. LIST VISUALIZER (Linked-List Style Operational Records)
// =======================================================================

type ListSource = "Maintenance" | "Incidents" | "Inspections" | "Repairs";

function ListVisualizer({
  maintenance,
  incidents,
  inspections,
  repairs
}: {
  maintenance: Maintenance[];
  incidents: Incident[];
  inspections: Inspection[];
  repairs: Repair[];
}) {
  const [source, setSource] = useState<ListSource>("Maintenance");
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(0);

  // Normalized list records
  const listItems = useMemo(() => {
    if (source === "Maintenance") {
      return maintenance.map((m, idx) => ({
        index: idx,
        id: `maint-${m.record_id}`,
        title: `Record #${m.record_id}: ${m.component || "General"}`,
        subtitle: m.description || "Routine maintenance procedure",
        badge: m.status || "Pending",
        date: m.maintenance_date || "N/A",
        address: `0x${(1000 + idx * 32).toString(16).toUpperCase()}`
      }));
    } else if (source === "Incidents") {
      return incidents.map((inc, idx) => ({
        index: idx,
        id: `inc-${inc.incident_id}`,
        title: `Incident #${inc.incident_id}: ${inc.component || "Vessel"}`,
        subtitle: inc.description || "Incident logged by crew",
        badge: `${inc.severity || "Medium"} • ${inc.status || "Open"}`,
        date: inc.incident_date || "N/A",
        address: `0x${(2000 + idx * 32).toString(16).toUpperCase()}`
      }));
    } else if (source === "Repairs") {
      return repairs.map((r, idx) => ({
        index: idx,
        id: `repair-${r.repair_id}`,
        title: `Repair #${r.repair_id}: ${r.component || "General"}`,
        subtitle: r.repair_description || "Repair operation recorded",
        badge: r.status || "Pending",
        date: r.repair_date || "N/A",
        address: `0x${(4000 + idx * 32).toString(16).toUpperCase()}`
      }));
    } else {
      return inspections.map((ins, idx) => ({
        index: idx,
        id: `insp-${ins.inspection_id}`,
        title: `Inspection #${ins.inspection_id}: ${ins.inspection_type || "Safety"}`,
        subtitle: ins.result || "Standard inspection completed",
        badge: "Inspected",
        date: ins.inspection_date || "N/A",
        address: `0x${(3000 + idx * 32).toString(16).toUpperCase()}`
      }));
    }
  }, [source, maintenance, incidents, inspections, repairs]);

  const selectedNode = selectedNodeIndex !== null ? listItems[selectedNodeIndex] : null;

  return (
    <div className="space-y-6">
      {/* CONTROLS */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#d5ded8] bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-bold text-[#0f2d3a]">
            Linked List Data Structure
          </h3>
          <p className="text-xs font-medium text-[#2d4d46]">
            Visualizes sequential operational memory items with forward pointer references (`node.next`).
          </p>
        </div>

        {/* Data Source Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#2d524a]">Data Source:</span>
          {(["Maintenance", "Incidents", "Inspections", "Repairs"] as ListSource[]).map((src) => {
            const active = source === src;
            const count =
              src === "Maintenance"
                ? maintenance.length
                : src === "Incidents"
                ? incidents.length
                : src === "Repairs"
                ? repairs.length
                : inspections.length;

            return (
              <button
                key={src}
                onClick={() => {
                  setSource(src);
                  setSelectedNodeIndex(0);
                }}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  active
                    ? "bg-[#186862] text-white"
                    : "bg-[#edf4ee] text-[#1c473f] hover:bg-[#e1ede4]"
                }`}
              >
                {src} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* LINKED LIST VISUAL CHAIN */}
      <div className="rounded-2xl border border-[#d5ded8] bg-[#fafcf9] p-6 shadow-sm">
        {listItems.length === 0 ? (
          <div className="py-12 text-center">
            <List size={32} className="mx-auto text-[#146459]" />
            <p className="mt-2 text-sm font-bold text-[#0f2d3a]">
              No {source} records found
            </p>
            <p className="text-xs font-medium text-[#2d4d46]">
              Add {source.toLowerCase()} through the operational dashboard to populate this linked list.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Horizontal Linked-List Chain */}
            <div className="overflow-x-auto pb-4">
              <div className="flex items-center gap-3 min-w-max px-2">
                {/* HEAD POINTER */}
                <div className="flex flex-col items-center">
                  <div className="rounded-xl border border-[#3b82f6] bg-[#eff6ff] px-3.5 py-2 text-center shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563eb]">
                      HEAD
                    </span>
                    <p className="text-xs font-mono font-bold text-[#1e40af]">
                      {listItems[0].address}
                    </p>
                  </div>
                  <ArrowRight size={18} className="mt-1 text-[#3b82f6]" />
                </div>

                {/* CHAIN OF NODES */}
                {listItems.map((item, idx) => {
                  const isSelected = selectedNodeIndex === idx;
                  const isTail = idx === listItems.length - 1;
                  const nextAddress = isTail ? "NULL" : listItems[idx + 1].address;

                  return (
                    <React.Fragment key={item.id}>
                      {/* Node Card */}
                      <div
                        onClick={() => setSelectedNodeIndex(idx)}
                        className={`group relative cursor-pointer rounded-2xl border bg-white p-4 transition-all ${
                          isSelected
                            ? "border-[#186862] shadow-md ring-2 ring-[#186862]/20"
                            : "border-[#d5ded8] hover:border-[#186862] hover:shadow-xs"
                        }`}
                        style={{ width: 240 }}
                      >
                        {/* Memory header */}
                        <div className="mb-2 flex items-center justify-between border-b border-[#edf1ec] pb-1.5 text-[10px]">
                          <span className="font-mono font-bold text-[#3d635b]">
                            Node #{item.index}
                          </span>
                          <span className="rounded bg-[#dcfce7] px-1.5 py-0.5 font-mono font-bold text-[#14532d]">
                            {item.address}
                          </span>
                        </div>

                        {/* Title & Subtitle */}
                        <h4 className="truncate text-xs font-extrabold text-[#0f2d3a]">
                          {item.title}
                        </h4>
                        <p className="mt-1 line-clamp-2 text-[11px] font-medium text-[#264842]">
                          {item.subtitle}
                        </p>

                        <div className="mt-3 flex items-center justify-between">
                          <span className="rounded-md bg-[#dcefe5] px-2 py-0.5 text-[10px] font-bold text-[#0f5c54]">
                            {item.badge}
                          </span>
                          <span className="text-[10px] font-semibold text-[#3d635b]">
                            {item.date}
                          </span>
                        </div>

                        {/* Pointer footer */}
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-[#f8faf7] px-2.5 py-1 text-[10px] font-mono">
                          <span className="font-bold text-[#2d524a]">next:</span>
                          <span
                            className={
                              isTail
                                ? "font-bold text-[#dc2626]"
                                : "font-bold text-[#0f5c54]"
                            }
                          >
                            {nextAddress}
                          </span>
                        </div>
                      </div>

                      {/* Pointer Arrow to Next Node */}
                      <div className="flex items-center text-[#94a3b8]">
                        <ArrowRight
                          size={20}
                          className={isSelected ? "text-[#186862]" : "text-[#cbd5e1]"}
                        />
                      </div>
                    </React.Fragment>
                  );
                })}

                {/* TAIL NULL POINTER */}
                <div className="flex flex-col items-center">
                  <div className="rounded-xl border border-[#ef4444] bg-[#fef2f2] px-3.5 py-2 text-center shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#dc2626]">
                      TAIL
                    </span>
                    <p className="text-xs font-mono font-bold text-[#991b1b]">
                      NULL
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* NODE INSPECTOR DRAWER */}
            {selectedNode && (
              <div className="rounded-2xl border border-[#cad8ce] bg-white p-5 shadow-xs">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-[#daf0e7] p-2 text-[#146459]">
                      <Info size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#1c473f]">
                        Node Memory Inspector • Index #{selectedNode.index}
                      </h4>
                      <p className="text-sm font-extrabold text-[#0f2d3a]">
                        {selectedNode.title}
                      </p>
                    </div>
                  </div>

                  <span className="font-mono text-xs font-bold text-[#0f5c54]">
                    Memory: {selectedNode.address}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-[#f8faf7] p-3 text-xs">
                    <span className="font-bold text-[#2d524a]">Pointer `prev`:</span>
                    <p className="mt-0.5 font-mono font-bold text-[#0f2d3a]">
                      {selectedNode.index === 0
                        ? "NULL (HEAD)"
                        : listItems[selectedNode.index - 1].address}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#f8faf7] p-3 text-xs">
                    <span className="font-bold text-[#2d524a]">Data Payload:</span>
                    <p className="mt-0.5 font-bold text-[#0f2d3a]">
                      {selectedNode.subtitle}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#f8faf7] p-3 text-xs">
                    <span className="font-bold text-[#2d524a]">Pointer `next`:</span>
                    <p className="mt-0.5 font-mono font-bold text-[#0f2d3a]">
                      {selectedNode.index === listItems.length - 1
                        ? "NULL (TAIL)"
                        : listItems[selectedNode.index + 1].address}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =======================================================================
// B. STACK VISUALIZER (LIFO - Last In, First Out)
// =======================================================================

function StackVisualizer({ activityHistory }: { activityHistory: Activity[] }) {
  // Safe temporary interactive copy
  const [stack, setStack] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [peekedMessage, setPeekedMessage] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Initialize from database records
  const resetToDB = useCallback(() => {
    if (activityHistory && activityHistory.length > 0) {
      const items = activityHistory
        .slice()
        .reverse()
        .map((a) => `${a.action}: ${a.description}`);
      setStack(items);
    } else {
      setStack([
        "System Initialized: Vessel operational monitoring online",
        "Vessel Registered: Ocean Star cargo ship added",
        "Maintenance Created: Main Engine routine maintenance"
      ]);
    }
    setPeekedMessage(null);
    setStatusNotification("Stack restored to live database activity history.");
  }, [activityHistory]);

  useEffect(() => {
    resetToDB();
  }, [resetToDB]);

  // Operations
  function handlePush(item: string) {
    if (!item.trim()) return;
    setStack((prev) => [...prev, item.trim()]);
    setCustomInput("");
    setPeekedMessage(null);
    setStatusNotification(`Pushed onto Top of Stack: "${item.trim()}"`);
  }

  function handlePop() {
    if (stack.length === 0) return;
    const popped = stack[stack.length - 1];
    setStack((prev) => prev.slice(0, prev.length - 1));
    setPeekedMessage(null);
    setStatusNotification(`Popped from Top of Stack: "${popped}"`);
  }

  function handlePeek() {
    if (stack.length === 0) {
      setPeekedMessage("Stack is empty.");
      return;
    }
    const top = stack[stack.length - 1];
    setPeekedMessage(top);
    setStatusNotification(`Peeked Top of Stack: "${top}"`);
  }

  const PRESETS = [
    "Engine Diagnostics: Cylinder pressure verified normal",
    "Bunker Fuel Sampled: Sulfur content compliant with MARPOL",
    "Emergency Bilge Alarm Tested: Sensor triggered and reset",
    "Cargo Hold Ventilation: Fans checked before departure"
  ];

  return (
    <div className="space-y-6">
      {/* NOTICE BANNER */}
      <div className="flex items-center justify-between rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-xs font-semibold text-[#14532d]">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#16a34a]" />
          <span>
            <strong className="font-bold">Safe Simulation Mode:</strong> Interactive demonstrations operate on an isolated local copy. Permanent database activity logs are protected.
          </span>
        </div>
        <button
          onClick={resetToDB}
          className="flex items-center gap-1.5 rounded-lg border border-[#86efac] bg-white px-3 py-1 font-bold text-[#15803d] hover:bg-[#dcfce7]"
        >
          <RotateCcw size={12} />
          Reset to Database
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* INTERACTIVE CONTROLS (5 COLS) */}
        <div className="space-y-5 rounded-2xl border border-[#d5ded8] bg-white p-6 shadow-sm lg:col-span-5">
          <div>
            <h3 className="font-bold text-base text-[#0f2d3a]">
              Stack Operations (LIFO)
            </h3>
            <p className="mt-1 text-xs font-medium text-[#2d4d46]">
              Last In, First Out — items pushed last are popped first from the top.
            </p>
          </div>

          {/* Quick Presets */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1c473f]">
              Quick Event Presets
            </span>
            <div className="mt-2 space-y-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => handlePush(p)}
                  className="flex w-full items-center justify-between rounded-xl border border-[#d5ded8] bg-[#fafcf9] p-2.5 text-left text-xs font-semibold text-[#133844] transition hover:border-[#186862] hover:bg-[#edf5f0]"
                >
                  <span className="truncate pr-2">{p}</span>
                  <Plus size={14} className="text-[#146459] shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Custom Push Input */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1c473f]">
              Custom Operational Event
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter event to push..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePush(customInput)}
                className="flex-1 rounded-xl border border-[#cad8ce] bg-[#f8faf8] px-3.5 py-2 text-xs font-medium text-[#0f2d3a] placeholder-[#64847c] focus:border-[#1e7a6e] focus:outline-none"
              />
              <button
                onClick={() => handlePush(customInput)}
                disabled={!customInput.trim()}
                className="rounded-xl bg-[#186862] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#12534e] disabled:opacity-50"
              >
                Push
              </button>
            </div>
          </div>

          {/* Control Buttons: Pop & Peek */}
          <div className="flex gap-2 border-t border-[#edf1ec] pt-4">
            <button
              onClick={handlePop}
              disabled={stack.length === 0}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#fca5a5] bg-[#fef2f2] px-4 py-2.5 text-xs font-bold text-[#991b1b] transition hover:bg-[#fee2e2] disabled:opacity-50"
            >
              <Trash2 size={14} />
              Pop (Remove Top)
            </button>
            <button
              onClick={handlePeek}
              disabled={stack.length === 0}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#cad8ce] bg-[#f8faf8] px-4 py-2.5 text-xs font-bold text-[#185e54] transition hover:bg-[#edf4ee] disabled:opacity-50"
            >
              <Eye size={14} />
              Peek (Inspect Top)
            </button>
          </div>

          {/* Notification / Peek Display */}
          {statusNotification && (
            <div className="rounded-xl bg-[#eff6ff] p-3 text-xs font-semibold text-[#1e40af]">
              <strong>Operation:</strong> {statusNotification}
            </div>
          )}
        </div>

        {/* STACK CHAMBER VISUAL (7 COLS) */}
        <div className="rounded-2xl border border-[#d5ded8] bg-[#fafcf9] p-6 shadow-sm lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#0f2d3a]">
              Stack Chamber • Size: {stack.length}
            </span>
            <span className="rounded-md bg-[#dcefe5] px-2.5 py-1 text-[11px] font-mono font-bold text-[#0f5c54]">
              Top Pointer: Index {stack.length > 0 ? stack.length - 1 : "Empty"}
            </span>
          </div>

          {/* Top Indicator */}
          <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-extrabold text-[#0f5c54]">
            <ArrowDown size={14} />
            <span>PUSH / POP ENTRANCE (TOP)</span>
            <ArrowDown size={14} />
          </div>

          {/* Stack Container */}
          <div
            className="flex flex-col-reverse gap-2.5 rounded-2xl border-2 border-dashed border-[#cad8ce] bg-white p-4"
            style={{ minHeight: 380 }}
          >
            {stack.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <Layers size={32} className="text-[#146459]" />
                <p className="mt-2 text-sm font-bold text-[#0f2d3a]">
                  Stack is empty
                </p>
                <p className="text-xs font-medium text-[#2d4d46]">
                  Push an operational event to visualize the LIFO structure.
                </p>
              </div>
            ) : (
              stack.map((item, index) => {
                const isTop = index === stack.length - 1;
                const isPeeked = peekedMessage === item;

                return (
                  <div
                    key={`${item}-${index}`}
                    className={`relative rounded-xl border p-3.5 transition-all ${
                      isTop
                        ? "border-[#186862] bg-[#eef7f2] shadow-sm ring-2 ring-[#186862]/20"
                        : isPeeked
                        ? "border-[#38bdf8] bg-[#eff6ff]"
                        : "border-[#d5ded8] bg-[#fbfcf9]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono font-bold text-[#2d524a]">
                        Stack Frame [{index}]
                      </span>
                      {isTop && (
                        <span className="rounded bg-[#186862] px-2 py-0.5 font-extrabold uppercase tracking-wider text-white">
                          TOP (LIFO)
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-bold text-[#0f2d3a]">
                      {item}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Base of Stack */}
          <div className="mt-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-[#2d524a]">
            ── Base of Stack (Index 0) ──
          </div>
        </div>
      </div>
    </div>
  );
}

// =======================================================================
// C. QUEUE VISUALIZER (FIFO - First In, First Out)
// =======================================================================

interface QueueTask {
  id: string;
  component: string;
  description: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  status: string;
}

function QueueVisualizer({ maintenance }: { maintenance: Maintenance[] }) {
  const [queue, setQueue] = useState<QueueTask[]>([]);
  const [newComponent, setNewComponent] = useState("Main Engine");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<QueueTask["priority"]>("Medium");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Initialize from live database pending maintenance
  const resetToDB = useCallback(() => {
    if (maintenance && maintenance.length > 0) {
      const items: QueueTask[] = maintenance.map((m, idx) => ({
        id: `task-${m.record_id}-${idx}`,
        component: m.component || "General Equipment",
        description: m.description || "Scheduled routine maintenance task",
        priority: idx === 0 ? "High" : "Medium",
        status: m.status || "Pending"
      }));
      setQueue(items);
    } else {
      setQueue([
        {
          id: "task-1",
          component: "Cooling Pump",
          description: "Inspect impeller clearance and replace mechanical seal",
          priority: "High",
          status: "Pending"
        },
        {
          id: "task-2",
          component: "Auxiliary Engine",
          description: "Change lube oil and calibrate injector nozzles",
          priority: "Medium",
          status: "Pending"
        }
      ]);
    }
    setStatusMessage("Queue synchronized with live database maintenance tasks.");
  }, [maintenance]);

  useEffect(() => {
    resetToDB();
  }, [resetToDB]);

  // Operations
  function handleEnqueue() {
    if (!newDescription.trim()) return;
    const task: QueueTask = {
      id: `task-${Date.now()}`,
      component: newComponent,
      description: newDescription.trim(),
      priority: newPriority,
      status: "Pending"
    };
    setQueue((prev) => [...prev, task]);
    setNewDescription("");
    setStatusMessage(`Enqueued to Rear: "${task.component} - ${task.description}"`);
  }

  function handleDequeue() {
    if (queue.length === 0) return;
    const removed = queue[0];
    setQueue((prev) => prev.slice(1));
    setStatusMessage(`Dequeued from Front: "${removed.component} - ${removed.description}"`);
  }

  function handlePeek() {
    if (queue.length === 0) return;
    const front = queue[0];
    setStatusMessage(`Peek Front Task: "${front.component} - ${front.description}"`);
  }

  return (
    <div className="space-y-6">
      {/* NOTICE BANNER */}
      <div className="flex items-center justify-between rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-xs font-semibold text-[#14532d]">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#16a34a]" />
          <span>
            <strong className="font-bold">Safe Simulation Mode:</strong> Enqueue and Dequeue operate on an interactive copy. Permanent database maintenance records remain intact.
          </span>
        </div>
        <button
          onClick={resetToDB}
          className="flex items-center gap-1.5 rounded-lg border border-[#86efac] bg-white px-3 py-1 font-bold text-[#15803d] hover:bg-[#dcfce7]"
        >
          <RotateCcw size={12} />
          Reset to Database
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ENQUEUE FORM (4 COLS) */}
        <div className="space-y-5 rounded-2xl border border-[#d5ded8] bg-white p-6 shadow-sm lg:col-span-4">
          <div>
            <h3 className="font-bold text-base text-[#0f2d3a]">
              Enqueue Maintenance Task
            </h3>
            <p className="mt-1 text-xs font-medium text-[#2d4d46]">
              Tasks enter at the rear (tail) and wait in line for servicing.
            </p>
          </div>

          {/* Component selection */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1c473f]">
              Component
            </span>
            <select
              value={newComponent}
              onChange={(e) => setNewComponent(e.target.value)}
              className="w-full rounded-xl border border-[#cad8ce] bg-[#f8faf8] px-3.5 py-2 text-xs font-bold text-[#0f2d3a] focus:border-[#1e7a6e] focus:outline-none"
            >
              <option value="Main Engine">Main Engine</option>
              <option value="Auxiliary Engine">Auxiliary Engine</option>
              <option value="Cooling Pump">Cooling Pump</option>
              <option value="Fuel Separator">Fuel Separator</option>
              <option value="Steering Gear">Steering Gear</option>
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1c473f]">
              Task Description
            </span>
            <input
              type="text"
              placeholder="e.g. Inspect fuel pressure regulation valve..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full rounded-xl border border-[#cad8ce] bg-[#f8faf8] px-3.5 py-2 text-xs font-medium text-[#0f2d3a] placeholder-[#64847c] focus:border-[#1e7a6e] focus:outline-none"
            />
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1c473f]">
              Priority Level
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {(["Low", "Medium", "High", "Critical"] as const).map((pri) => (
                <button
                  key={pri}
                  type="button"
                  onClick={() => setNewPriority(pri)}
                  className={`rounded-lg py-1.5 text-[11px] font-bold transition ${
                    newPriority === pri
                      ? pri === "Critical"
                        ? "bg-[#dc2626] text-white"
                        : pri === "High"
                        ? "bg-[#ea580c] text-white"
                        : pri === "Medium"
                        ? "bg-[#186862] text-white"
                        : "bg-[#0284c7] text-white"
                      : "bg-[#edf4ee] text-[#264d45] hover:bg-[#e1ede4]"
                  }`}
                >
                  {pri}
                </button>
              ))}
            </div>
          </div>

          {/* Enqueue button */}
          <button
            onClick={handleEnqueue}
            disabled={!newDescription.trim()}
            className="w-full rounded-xl bg-[#186862] py-2.5 text-xs font-bold text-white transition hover:bg-[#12534e] disabled:opacity-50"
          >
            Enqueue Task (Add to Rear)
          </button>

          {/* Controls: Dequeue & Peek */}
          <div className="flex gap-2 border-t border-[#edf1ec] pt-4">
            <button
              onClick={handleDequeue}
              disabled={queue.length === 0}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-xs font-bold text-[#991b1b] hover:bg-[#fee2e2] disabled:opacity-50"
            >
              <Trash2 size={13} />
              Dequeue (Front)
            </button>
            <button
              onClick={handlePeek}
              disabled={queue.length === 0}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#cad8ce] bg-[#f8faf8] px-3 py-2 text-xs font-bold text-[#185e54] hover:bg-[#edf4ee] disabled:opacity-50"
            >
              <Eye size={13} />
              Peek Front
            </button>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className="rounded-xl bg-[#eff6ff] p-3 text-xs font-semibold text-[#1e40af]">
              <strong>Queue State:</strong> {statusMessage}
            </div>
          )}
        </div>

        {/* QUEUE PIPELINE VISUAL (8 COLS) */}
        <div className="rounded-2xl border border-[#d5ded8] bg-[#fafcf9] p-6 shadow-sm lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#0f2d3a]">
              FIFO Maintenance Queue • Length: {queue.length}
            </span>
            <div className="flex items-center gap-3 text-xs font-mono font-bold">
              <span className="text-[#15803d]">Front: 0</span>
              <span className="text-[#1e40af]">
                Rear: {queue.length > 0 ? queue.length - 1 : 0}
              </span>
            </div>
          </div>

          {/* Queue Track */}
          <div className="space-y-3">
            {queue.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#cad8ce] bg-white text-center">
                <ClipboardList size={32} className="text-[#146459]" />
                <p className="mt-2 text-sm font-bold text-[#0f2d3a]">
                  Maintenance Queue is empty
                </p>
                <p className="text-xs font-medium text-[#2d4d46]">
                  Enqueue tasks from the left panel to demonstrate First In, First Out processing.
                </p>
              </div>
            ) : (
              queue.map((task, index) => {
                const isFront = index === 0;
                const isRear = index === queue.length - 1;

                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-4 rounded-xl border p-4 transition-all ${
                      isFront
                        ? "border-[#16a34a] bg-[#f0fdf4] shadow-sm ring-2 ring-[#16a34a]/20"
                        : isRear
                        ? "border-[#3b82f6] bg-[#eff6ff]"
                        : "border-[#d5ded8] bg-white"
                    }`}
                  >
                    {/* Position & Role Badge */}
                    <div className="w-24 shrink-0 text-center">
                      <span className="block text-[10px] font-mono font-bold text-[#3d635b]">
                        Pos #{index + 1}
                      </span>
                      {isFront ? (
                        <span className="mt-1 inline-block rounded-md bg-[#16a34a] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                          FRONT
                        </span>
                      ) : isRear ? (
                        <span className="mt-1 inline-block rounded-md bg-[#2563eb] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                          REAR
                        </span>
                      ) : (
                        <span className="mt-1 inline-block rounded-md bg-[#edf4ee] px-2 py-0.5 text-[10px] font-bold text-[#264d45]">
                          Waiting
                        </span>
                      )}
                    </div>

                    {/* Task Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-[#0f2d3a]">
                          {task.component}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                            task.priority === "Critical"
                              ? "bg-[#fee2e2] text-[#991b1b]"
                              : task.priority === "High"
                              ? "bg-[#ffedd5] text-[#9a3412]"
                              : "bg-[#e0f2fe] text-[#0369a1]"
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-[#264842]">
                        {task.description}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="text-right shrink-0">
                      <span className="rounded-md bg-[#eef7f2] px-2 py-1 text-[11px] font-bold text-[#0f5c54]">
                        {task.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =======================================================================
// D. TREE VISUALIZER (Hierarchical Vessel Component Tree)
// =======================================================================

function TreeVisualizer({
  vessels
}: {
  vessels: { vessel_id: number; vessel_name: string }[];
}) {
  const [treeData, setTreeData] = useState<ComponentTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedVesselId, setSelectedVesselId] = useState<number | undefined>(undefined);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [selectedTreeNode, setSelectedTreeNode] = useState<ComponentTreeNode | null>(null);

  const loadTree = useCallback(async (vesselId?: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchComponentTree(vesselId);
      setTreeData(data);
      setSelectedTreeNode(data);
      // Auto expand root and first level
      const initialExpanded: Record<string, boolean> = {
        [data.id || data.name]: true
      };
      if (data.children) {
        data.children.forEach((c) => {
          initialExpanded[c.id || c.name] = true;
        });
      }
      setExpandedNodes(initialExpanded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load component tree.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTree(selectedVesselId);
  }, [selectedVesselId, loadTree]);

  function toggleExpand(nodeId: string) {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  }

  function expandAll(node: ComponentTreeNode) {
    const next: Record<string, boolean> = {};
    function traverse(n: ComponentTreeNode) {
      next[n.id || n.name] = true;
      if (n.children) {
        n.children.forEach(traverse);
      }
    }
    traverse(node);
    setExpandedNodes(next);
  }

  function collapseAll() {
    if (!treeData) return;
    setExpandedNodes({ [treeData.id || treeData.name]: true });
  }

  return (
    <div className="space-y-6">
      {/* TOOLBAR */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#d5ded8] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-[#0f2d3a]">
            Vessel Component Hierarchy Tree
          </h3>
          <p className="text-xs font-medium text-[#2d4d46]">
            Hierarchical breakdown: Vessel → Equipment Components → Maintenance & Operational Records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {vessels.length > 0 && (
            <select
              value={selectedVesselId || ""}
              onChange={(e) =>
                setSelectedVesselId(e.target.value ? Number(e.target.value) : undefined)
              }
              className="rounded-xl border border-[#cad8ce] bg-[#f8faf8] px-3 py-1.5 text-xs font-bold text-[#0f2d3a] focus:outline-none"
            >
              <option value="">Default (Ocean Star)</option>
              {vessels.map((v) => (
                <option key={v.vessel_id} value={v.vessel_id}>
                  {v.vessel_name}
                </option>
              ))}
            </select>
          )}

          {treeData && (
            <>
              <button
                onClick={() => expandAll(treeData)}
                className="rounded-lg border border-[#cad8ce] bg-[#f8faf8] px-3 py-1.5 text-xs font-bold text-[#185e54] hover:bg-[#edf4ee]"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="rounded-lg border border-[#cad8ce] bg-[#f8faf8] px-3 py-1.5 text-xs font-bold text-[#185e54] hover:bg-[#edf4ee]"
              >
                Collapse All
              </button>
            </>
          )}

          <button
            onClick={() => void loadTree(selectedVesselId)}
            className="flex items-center gap-1.5 rounded-lg bg-[#186862] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#12534e]"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* TREE & NODE DETAILS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* TREE VIEW (7 COLS) */}
        <div className="rounded-2xl border border-[#d5ded8] bg-[#fafcf9] p-6 shadow-sm lg:col-span-7">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <RefreshCw size={24} className="animate-spin text-[#146459]" />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs font-semibold text-[#b91c1c]">{error}</div>
          ) : !treeData ? (
            <div className="p-6 text-center text-xs font-medium text-[#3d635b]">No tree data available.</div>
          ) : (
            <div className="space-y-1">
              <TreeNodeItem
                node={treeData}
                level={0}
                expandedNodes={expandedNodes}
                onToggleExpand={toggleExpand}
                selectedNode={selectedTreeNode}
                onSelectNode={setSelectedTreeNode}
              />
            </div>
          )}
        </div>

        {/* NODE INSPECTOR (5 COLS) */}
        <div className="rounded-2xl border border-[#d5ded8] bg-white p-6 shadow-sm lg:col-span-5">
          <div className="mb-4 border-b border-[#edf1ec] pb-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#1c473f]">
              Node Inspector
            </h4>
            <p className="mt-0.5 text-sm font-extrabold text-[#0f2d3a]">
              {selectedTreeNode?.name || "Select a node to inspect details"}
            </p>
          </div>

          {selectedTreeNode ? (
            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-[#f8faf7] p-3 space-y-1.5 border border-[#edf1ec]">
                <div className="flex justify-between">
                  <span className="font-bold text-[#264d45]">Node Type:</span>
                  <span className="font-bold text-[#0f5c54] uppercase">
                    {selectedTreeNode.type || "Component"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-[#264d45]">Identifier:</span>
                  <span className="font-mono font-bold text-[#0f2d3a]">
                    {selectedTreeNode.id || selectedTreeNode.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-[#264d45]">Children Count:</span>
                  <span className="font-extrabold text-[#0f2d3a]">
                    {selectedTreeNode.children?.length || 0} sub-nodes
                  </span>
                </div>
              </div>

              {selectedTreeNode.metadata && Object.keys(selectedTreeNode.metadata).length > 0 && (
                <div>
                  <span className="block mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#1c473f]">
                    Detailed Attributes
                  </span>
                  <div className="rounded-xl border border-[#d5ded8] bg-white p-3 space-y-1.5">
                    {Object.entries(selectedTreeNode.metadata).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="font-bold text-[#264d45] capitalize">
                          {k.replace(/_/g, " ")}:
                        </span>
                        <span className="font-semibold text-[#0f2d3a] text-right truncate max-w-[200px]">
                          {String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs font-medium text-[#3d635b]">
              Click on any node in the hierarchy tree to view its operational metadata and child components.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TreeNodeItem({
  node,
  level,
  expandedNodes,
  onToggleExpand,
  selectedNode,
  onSelectNode
}: {
  node: ComponentTreeNode;
  level: number;
  expandedNodes: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  selectedNode: ComponentTreeNode | null;
  onSelectNode: (n: ComponentTreeNode) => void;
}) {
  const nodeId = node.id || node.name;
  const isExpanded = !!expandedNodes[nodeId];
  const isSelected = selectedNode?.name === node.name && selectedNode?.id === node.id;
  const hasChildren = node.children && node.children.length > 0;

  // Node icon & color by level/type
  const icon =
    node.type === "vessel" || level === 0 ? (
      <Ship size={14} className="text-[#2563eb]" />
    ) : node.type === "component" || level === 1 ? (
      <Box size={14} className="text-[#0f766e]" />
    ) : node.type === "maintenance" ? (
      <Wrench size={13} className="text-[#d97706]" />
    ) : node.type === "incident" ? (
      <AlertTriangle size={13} className="text-[#dc2626]" />
    ) : (
      <ClipboardList size={13} className="text-[#7c3aed]" />
    );

  return (
    <div>
      <div
        onClick={() => onSelectNode(node)}
        className={`group flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition cursor-pointer ${
          isSelected
            ? "bg-[#dcefe5] text-[#0f5c54] font-bold"
            : "hover:bg-[#edf4ee] text-[#133844] font-semibold"
        }`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {/* Expand / Collapse toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(nodeId);
            }}
            className="rounded p-0.5 text-[#3d635b] hover:bg-[#cad8ce] hover:text-[#0f2d3a]"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-3.5 inline-block" />
        )}

        {/* Level Icon */}
        <span>{icon}</span>

        {/* Node Name */}
        <span className="text-xs truncate flex-1 font-bold">{node.name}</span>

        {/* Child count pill */}
        {hasChildren && (
          <span className="rounded-full bg-[#dcefe5] px-2 py-0.5 text-[10px] font-mono font-bold text-[#0f5c54]">
            {node.children.length}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id || child.name}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              selectedNode={selectedNode}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =======================================================================
// E. GRAPH VISUALIZER (Network & BFS/DFS Traversal)
// =======================================================================

function GraphVisualizer() {
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startNode, setStartNode] = useState<string>("Ocean Star");
  const [traversalType, setTraversalType] = useState<"BFS" | "DFS">("BFS");
  const [traversalResult, setTraversalResult] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchKnowledgeGraph();
      setGraphData(data);
      if (data.nodes.length > 0) {
        const defaultStart =
          data.nodes.find((n) => n.label === "Ocean Star")?.label || data.nodes[0].label;
        setStartNode(defaultStart);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  // Execute BFS or DFS
  const executeTraversal = useCallback(async () => {
    if (!startNode) return;
    setError("");
    setIsRunning(false);
    setActiveStep(0);
    try {
      const resp =
        traversalType === "BFS"
          ? await fetchGraphBFS(startNode)
          : await fetchGraphDFS(startNode);
      setTraversalResult(resp.result);
      setActiveStep(resp.result.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Traversal failed.");
    }
  }, [startNode, traversalType]);

  // Step-by-Step Auto Animation
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isRunning && activeStep < traversalResult.length) {
      timer = setTimeout(() => {
        setActiveStep((prev) => prev + 1);
      }, 700);
    } else if (activeStep >= traversalResult.length) {
      setIsRunning(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isRunning, activeStep, traversalResult.length]);

  function handleStepForward() {
    if (activeStep < traversalResult.length) {
      setActiveStep((prev) => prev + 1);
    }
  }

  function handleResetTraversal() {
    setIsRunning(false);
    setActiveStep(0);
  }

  const visitedSet = useMemo(() => {
    return new Set(traversalResult.slice(0, activeStep));
  }, [traversalResult, activeStep]);

  return (
    <div className="space-y-6">
      {/* TRAVERSAL CONTROLS */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#d5ded8] bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-bold text-[#0f2d3a]">
            Operational Graph Traversal Engine
          </h3>
          <p className="text-xs font-medium text-[#2d4d46]">
            Demonstrates BFS (level-by-level using Queue) and DFS (branch-deep using Stack) over vessel connections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Start Node Dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-bold text-[#2d524a]">Start:</span>
            <select
              value={startNode}
              onChange={(e) => {
                setStartNode(e.target.value);
                setTraversalResult([]);
                setActiveStep(0);
              }}
              className="rounded-xl border border-[#cad8ce] bg-[#f8faf8] px-3 py-1.5 font-bold text-[#0f2d3a] focus:outline-none"
            >
              {graphData?.nodes.map((n) => (
                <option key={n.id} value={n.label}>
                  {n.label} ({n.type})
                </option>
              ))}
            </select>
          </div>

          {/* Algorithm Toggle */}
          <div className="flex rounded-xl bg-[#edf4ee] p-1">
            <button
              onClick={() => {
                setTraversalType("BFS");
                setTraversalResult([]);
                setActiveStep(0);
              }}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                traversalType === "BFS"
                  ? "bg-[#186862] text-white shadow-xs"
                  : "text-[#264d45] hover:text-[#0f2d3a]"
              }`}
            >
              BFS (Queue)
            </button>
            <button
              onClick={() => {
                setTraversalType("DFS");
                setTraversalResult([]);
                setActiveStep(0);
              }}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                traversalType === "DFS"
                  ? "bg-[#186862] text-white shadow-xs"
                  : "text-[#264d45] hover:text-[#0f2d3a]"
              }`}
            >
              DFS (Stack)
            </button>
          </div>

          {/* Run & Step Actions */}
          <button
            onClick={() => void executeTraversal()}
            className="flex items-center gap-1.5 rounded-xl bg-[#186862] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#12534e]"
          >
            <Play size={13} />
            Run {traversalType}
          </button>
        </div>
      </div>

      {/* TRAVERSAL SEQUENCE & GRAPH NETWORK */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* TRAVERSAL SEQUENCE DRAWER (4 COLS) */}
        <div className="space-y-4 rounded-2xl border border-[#d5ded8] bg-white p-6 shadow-sm lg:col-span-4">
          <div className="flex items-center justify-between border-b border-[#edf1ec] pb-3">
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#1c473f]">
                Traversal Sequence ({traversalType})
              </h4>
              <p className="text-xs font-bold text-[#0f2d3a]">
                Visited: {visitedSet.size} of {traversalResult.length || graphData?.nodes.length || 0}
              </p>
            </div>

            {traversalResult.length > 0 && (
              <div className="flex gap-1">
                <button
                  onClick={handleStepForward}
                  disabled={activeStep >= traversalResult.length}
                  className="rounded-lg bg-[#dcefe5] px-2.5 py-1 text-xs font-bold text-[#0f5c54] hover:bg-[#cae7da] disabled:opacity-50"
                >
                  Step
                </button>
                <button
                  onClick={handleResetTraversal}
                  className="rounded-lg p-1 text-[#2d524a] hover:bg-[#edf4ee]"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-xs font-bold text-[#b91c1c]">{error}</p>}

          {traversalResult.length === 0 ? (
            <p className="text-xs font-medium text-[#3d635b]">
              Click <strong>Run {traversalType}</strong> to compute the graph exploration sequence starting from "{startNode}".
            </p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {traversalResult.map((nodeName, idx) => {
                const isVisited = idx < activeStep;
                const isCurrent = idx === activeStep - 1;

                return (
                  <div
                    key={`${nodeName}-${idx}`}
                    className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${
                      isCurrent
                        ? "border-[#186862] bg-[#eef7f2] font-bold text-[#0f5c54] shadow-xs"
                        : isVisited
                        ? "border-[#cad8ce] bg-[#f8faf8] font-bold text-[#0f2d3a]"
                        : "border-[#edf1ec] bg-[#fafcf9] text-[#64847c] opacity-60"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-extrabold ${
                        isCurrent
                          ? "bg-[#186862] text-white"
                          : isVisited
                          ? "bg-[#dcefe5] text-[#0f5c54]"
                          : "bg-[#edf1ec] text-[#64847c]"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-xs truncate flex-1 font-bold">{nodeName}</span>
                    {isCurrent && (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0f5c54]">
                        Active
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pedagogical Explanation Box */}
          <div className="rounded-xl border border-[#edf1ec] bg-[#f8faf7] p-3 text-xs text-[#264842]">
            <p className="font-extrabold text-[#0f2d3a]">
              {traversalType === "BFS" ? "Breadth-First Search" : "Depth-First Search"}
            </p>
            <p className="mt-1 text-[11px] font-medium leading-relaxed">
              {traversalType === "BFS"
                ? "Explores all direct component neighbors first (level-by-level) using a FIFO queue. Useful for identifying immediate maritime subsystem impact."
                : "Traverses deep down one operational branch before backtracking using a LIFO stack. Useful for tracing specific equipment failure chains."}
            </p>
          </div>
        </div>

        {/* GRAPH NETWORK CANVAS (8 COLS) */}
        <div className="rounded-2xl border border-[#d5ded8] bg-[#fafcf9] p-6 shadow-sm lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#0f2d3a]">
              Operational Network Node Map
            </span>
            <span className="text-[11px] font-bold text-[#0f5c54]">
              Visited nodes highlighted in emerald green
            </span>
          </div>

          {loading ? (
            <div className="flex h-80 items-center justify-center">
              <RefreshCw size={24} className="animate-spin text-[#146459]" />
            </div>
          ) : !graphData || graphData.nodes.length === 0 ? (
            <div className="py-16 text-center text-xs font-medium text-[#3d635b]">
              Graph data is currently empty.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {graphData.nodes.map((node) => {
                const isVisited = visitedSet.has(node.label) || visitedSet.has(node.id);
                const isStart = node.label === startNode;

                return (
                  <div
                    key={node.id}
                    className={`rounded-xl border p-3.5 transition-all ${
                      isStart
                        ? "border-[#2563eb] bg-[#eff6ff] ring-2 ring-[#2563eb]/20"
                        : isVisited
                        ? "border-[#186862] bg-[#eef7f2] shadow-sm"
                        : "border-[#d5ded8] bg-white text-[#264d45]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-extrabold uppercase tracking-wider text-[#264d45]">
                        {node.type}
                      </span>
                      {isStart ? (
                        <span className="rounded bg-[#2563eb] px-1.5 py-0.5 text-[9px] font-bold text-white">
                          START
                        </span>
                      ) : isVisited ? (
                        <span className="rounded bg-[#186862] px-1.5 py-0.5 text-[9px] font-bold text-white">
                          VISITED
                        </span>
                      ) : null}
                    </div>

                    <h5 className="mt-1 truncate text-xs font-extrabold text-[#0f2d3a]">
                      {node.label}
                    </h5>

                    <p className="mt-1 truncate text-[10px] font-semibold text-[#3d635b]">
                      ID: {node.id}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
