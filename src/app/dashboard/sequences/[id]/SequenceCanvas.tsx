'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import {
  ReactFlow, Background, Controls, Handle, Position,
  useNodesState, useEdgesState, addEdge, Panel,
  type NodeProps, type Connection, type Edge, type Node, type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  MessageSquare, Clock, GitBranch, Tag, UserCheck, XCircle,
  Type, Image, Save, Plus, Trash2, Check, RotateCcw,
} from 'lucide-react'
import { saveSequenceFlow } from '../actions'

// ─── Node type config ─────────────────────────────────────────────
const NODE_TYPES_META = [
  { type: 'templateMessage', label: 'Template Message', icon: MessageSquare, color: '#F5A623', border: 'border-primary/60', bg: 'bg-primary/10' },
  { type: 'textMessage',     label: 'Text Message',     icon: Type,           color: '#60a5fa', border: 'border-blue-400/60',   bg: 'bg-blue-400/10' },
  { type: 'mediaMessage',    label: 'Media Message',    icon: Image,          color: '#a78bfa', border: 'border-purple-400/60', bg: 'bg-purple-400/10' },
  { type: 'delay',           label: 'Time Delay',       icon: Clock,          color: '#94a3b8', border: 'border-slate-400/60',  bg: 'bg-slate-400/10' },
  { type: 'condition',       label: 'Condition / Branch', icon: GitBranch,    color: '#fb923c', border: 'border-orange-400/60', bg: 'bg-orange-400/10' },
  { type: 'addTag',          label: 'Add Tag',          icon: Tag,            color: '#4ade80', border: 'border-green-400/60',  bg: 'bg-green-400/10' },
  { type: 'removeTag',       label: 'Remove Tag',       icon: Tag,            color: '#f87171', border: 'border-red-400/60',    bg: 'bg-red-400/10' },
  { type: 'assignAgent',     label: 'Assign Agent',     icon: UserCheck,      color: '#38bdf8', border: 'border-sky-400/60',    bg: 'bg-sky-400/10' },
  { type: 'exit',            label: 'Exit Sequence',    icon: XCircle,        color: '#6b7280', border: 'border-zinc-500/60',   bg: 'bg-zinc-500/10' },
]

const META_BY_TYPE = Object.fromEntries(NODE_TYPES_META.map(m => [m.type, m]))

// ─── Shared node wrapper ──────────────────────────────────────────
function NodeWrapper({ type, children, id, deletable = true, selected }: {
  type: string; children: React.ReactNode; id: string; deletable?: boolean; selected?: boolean
}) {
  const meta = META_BY_TYPE[type] || NODE_TYPES_META[0]
  const Icon = meta.icon
  return (
    <div className={`min-w-[220px] max-w-[280px] bg-[oklch(0.15_0.010_255)] rounded-xl border-2 ${selected ? 'border-primary' : meta.border} shadow-lg transition-all`}>
      <div className={`flex items-center gap-2 px-3 py-2 ${meta.bg} rounded-t-[10px] border-b border-white/5`}>
        <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: meta.color }} />
        <span className="text-xs font-semibold text-foreground">{meta.label}</span>
      </div>
      <div className="px-3 py-2.5 text-xs text-muted-foreground">{children}</div>
    </div>
  )
}

// ─── Custom node components ───────────────────────────────────────
function StartNode({ data, selected }: NodeProps) {
  return (
    <div className={`min-w-[200px] bg-[oklch(0.15_0.010_255)] rounded-xl border-2 ${selected ? 'border-primary' : 'border-primary/40'} shadow-lg`}>
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-t-[10px] border-b border-white/5">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-bold text-primary">Trigger</span>
      </div>
      <div className="px-3 py-2.5 text-xs text-muted-foreground">
        {(data as any).label || 'Sequence starts here'}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-primary !border-2 !border-background" />
    </div>
  )
}

function TemplateMessageNode({ data, id, selected }: NodeProps) {
  return (
    <NodeWrapper type="templateMessage" id={id} selected={selected}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-primary !border-2 !border-background" />
      <p className="font-mono text-foreground/80">{(data as any).templateName || <em>No template selected</em>}</p>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-primary !border-2 !border-background" />
    </NodeWrapper>
  )
}

function TextMessageNode({ data, id, selected }: NodeProps) {
  return (
    <NodeWrapper type="textMessage" id={id} selected={selected}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-blue-400 !border-2 !border-background" />
      <p className="line-clamp-2 text-foreground/80">{(data as any).message || <em>No message set</em>}</p>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-blue-400 !border-2 !border-background" />
    </NodeWrapper>
  )
}

function MediaMessageNode({ data, id, selected }: NodeProps) {
  return (
    <NodeWrapper type="mediaMessage" id={id} selected={selected}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-purple-400 !border-2 !border-background" />
      <p className="text-foreground/80">{(data as any).mediaType || 'image'} — {(data as any).url ? 'URL set' : <em>No URL</em>}</p>
      {(data as any).caption && <p className="mt-1 line-clamp-1 opacity-60">{(data as any).caption}</p>}
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-purple-400 !border-2 !border-background" />
    </NodeWrapper>
  )
}

function DelayNode({ data, id, selected }: NodeProps) {
  return (
    <NodeWrapper type="delay" id={id} selected={selected}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-400 !border-2 !border-background" />
      <p className="text-foreground/80">Wait <strong className="text-foreground">{(data as any).amount || 1} {(data as any).unit || 'hour'}(s)</strong> then continue</p>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-slate-400 !border-2 !border-background" />
    </NodeWrapper>
  )
}

function ConditionNode({ data, id, selected }: NodeProps) {
  return (
    <NodeWrapper type="condition" id={id} selected={selected}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-orange-400 !border-2 !border-background" />
      <p className="text-foreground/80">{(data as any).condition || <em>No condition set</em>}</p>
      <div className="flex justify-between mt-2 text-[10px]">
        <span className="text-green-400 font-medium">Yes →</span>
        <span className="text-red-400 font-medium">← No</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '25%' }} className="!w-3 !h-3 !bg-green-400 !border-2 !border-background" />
      <Handle type="source" position={Position.Bottom} id="no"  style={{ left: '75%' }} className="!w-3 !h-3 !bg-red-400 !border-2 !border-background" />
    </NodeWrapper>
  )
}

function TagNode({ data, id, selected, type }: NodeProps) {
  return (
    <NodeWrapper type={type as string} id={id} selected={selected}>
      <Handle type="target" position={Position.Top} className={`!w-3 !h-3 !border-2 !border-background ${type === 'addTag' ? '!bg-green-400' : '!bg-red-400'}`} />
      <p className="text-foreground/80">{type === 'addTag' ? 'Add' : 'Remove'} tag: <strong className="text-foreground font-mono">{(data as any).tagName || <em>unnamed</em>}</strong></p>
      <Handle type="source" position={Position.Bottom} className={`!w-3 !h-3 !border-2 !border-background ${type === 'addTag' ? '!bg-green-400' : '!bg-red-400'}`} />
    </NodeWrapper>
  )
}

function AssignAgentNode({ data, id, selected }: NodeProps) {
  return (
    <NodeWrapper type="assignAgent" id={id} selected={selected}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-sky-400 !border-2 !border-background" />
      <p className="text-foreground/80">Assign to agent{(data as any).agentNote ? `: ${(data as any).agentNote}` : ''}</p>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-sky-400 !border-2 !border-background" />
    </NodeWrapper>
  )
}

function ExitNode({ data, id, selected }: NodeProps) {
  return (
    <NodeWrapper type="exit" id={id} selected={selected}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-zinc-500 !border-2 !border-background" />
      <p className="text-foreground/80">{(data as any).message || 'Sequence ends here'}</p>
    </NodeWrapper>
  )
}

const nodeTypes: NodeTypes = {
  start: StartNode as unknown as NodeTypes[string],
  templateMessage: TemplateMessageNode as unknown as NodeTypes[string],
  textMessage: TextMessageNode as unknown as NodeTypes[string],
  mediaMessage: MediaMessageNode as unknown as NodeTypes[string],
  delay: DelayNode as unknown as NodeTypes[string],
  condition: ConditionNode as unknown as NodeTypes[string],
  addTag: TagNode as unknown as NodeTypes[string],
  removeTag: TagNode as unknown as NodeTypes[string],
  assignAgent: AssignAgentNode as unknown as NodeTypes[string],
  exit: ExitNode as unknown as NodeTypes[string],
}

// ─── Config panel for selected node ──────────────────────────────
function NodeConfigPanel({ node, onChange, onDelete }: {
  node: Node; onChange: (id: string, data: Record<string, unknown>) => void; onDelete: (id: string) => void
}) {
  const data = node.data as Record<string, unknown>
  const inputCls = 'w-full px-2.5 py-1.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary'
  const labelCls = 'block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider'

  const update = (patch: Record<string, unknown>) => onChange(node.id, { ...data, ...patch })

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{META_BY_TYPE[node.type!]?.label || node.type}</span>
        {node.type !== 'start' && (
          <button onClick={() => onDelete(node.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="p-3 space-y-3">
        {node.type === 'templateMessage' && (
          <div><label className={labelCls}>Template Name</label>
            <input className={inputCls} placeholder="welcome_msg" value={(data.templateName as string) || ''}
              onChange={e => update({ templateName: e.target.value })} />
          </div>
        )}
        {(node.type === 'textMessage') && (
          <div><label className={labelCls}>Message</label>
            <textarea className={`${inputCls} resize-none`} rows={4} placeholder="Type your message…"
              value={(data.message as string) || ''} onChange={e => update({ message: e.target.value })} />
          </div>
        )}
        {node.type === 'mediaMessage' && (<>
          <div><label className={labelCls}>Media Type</label>
            <select className={inputCls} value={(data.mediaType as string) || 'image'} onChange={e => update({ mediaType: e.target.value })}>
              <option value="image">Image</option><option value="video">Video</option><option value="document">Document</option>
            </select>
          </div>
          <div><label className={labelCls}>URL</label>
            <input className={inputCls} placeholder="https://..." value={(data.url as string) || ''} onChange={e => update({ url: e.target.value })} />
          </div>
          <div><label className={labelCls}>Caption</label>
            <input className={inputCls} placeholder="Optional caption" value={(data.caption as string) || ''} onChange={e => update({ caption: e.target.value })} />
          </div>
        </>)}
        {node.type === 'delay' && (<>
          <div><label className={labelCls}>Wait Amount</label>
            <input className={inputCls} type="number" min={1} value={(data.amount as number) || 1} onChange={e => update({ amount: parseInt(e.target.value) || 1 })} />
          </div>
          <div><label className={labelCls}>Unit</label>
            <select className={inputCls} value={(data.unit as string) || 'hour'} onChange={e => update({ unit: e.target.value })}>
              <option value="minute">Minutes</option><option value="hour">Hours</option><option value="day">Days</option>
            </select>
          </div>
        </>)}
        {node.type === 'condition' && (
          <div><label className={labelCls}>Condition</label>
            <select className={inputCls} value={(data.condition as string) || ''} onChange={e => update({ condition: e.target.value })}>
              <option value="">Select condition…</option>
              <option value="contact replied">Contact replied</option>
              <option value="contact has tag">Contact has tag</option>
              <option value="contact clicked button">Contact clicked button</option>
              <option value="contact replied yes">Contact replied "Yes"</option>
              <option value="contact replied no">Contact replied "No"</option>
            </select>
          </div>
        )}
        {(node.type === 'addTag' || node.type === 'removeTag') && (
          <div><label className={labelCls}>Tag Name</label>
            <input className={inputCls} placeholder="e.g. warm-lead" value={(data.tagName as string) || ''} onChange={e => update({ tagName: e.target.value })} />
          </div>
        )}
        {node.type === 'assignAgent' && (
          <div><label className={labelCls}>Note</label>
            <input className={inputCls} placeholder="Optional note for agent" value={(data.agentNote as string) || ''} onChange={e => update({ agentNote: e.target.value })} />
          </div>
        )}
        {node.type === 'exit' && (
          <div><label className={labelCls}>End Message (internal note)</label>
            <input className={inputCls} placeholder="Why the sequence ends here" value={(data.message as string) || ''} onChange={e => update({ message: e.target.value })} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main canvas ──────────────────────────────────────────────────
export default function SequenceCanvas({ sequenceId, initialFlow, sequenceName }: {
  sequenceId: string
  initialFlow: { nodes: Node[]; edges: Edge[] }
  sequenceName: string
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow.edges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isPending, startTransition] = useTransition()

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge({ ...params, animated: true, style: { stroke: '#F5A623', strokeWidth: 2 } }, eds))
  }, [setEdges])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => setSelectedNode(null), [])

  const updateNodeData = useCallback((id: string, data: Record<string, unknown>) => {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data } : n))
    setSelectedNode(prev => prev?.id === id ? { ...prev, data } : prev)
  }, [setNodes])

  const deleteNode = useCallback((id: string) => {
    setNodes(ns => ns.filter(n => n.id !== id))
    setEdges(es => es.filter(e => e.source !== id && e.target !== id))
    setSelectedNode(null)
  }, [setNodes, setEdges])

  const addNode = useCallback((type: string) => {
    const id = `node-${Date.now()}`
    const meta = META_BY_TYPE[type]
    const newNode: Node = {
      id,
      type,
      position: { x: 200 + Math.random() * 100, y: 150 + nodes.length * 120 },
      data: { label: meta?.label || type },
    }
    setNodes(ns => [...ns, newNode])
  }, [nodes.length, setNodes])

  const handleSave = () => {
    setSaveState('saving')
    startTransition(async () => {
      await saveSequenceFlow(sequenceId, { nodes, edges })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    })
  }

  const memoNodeTypes = useMemo(() => nodeTypes, [])

  return (
    <div className="flex h-full">
      {/* Left: Node palette */}
      <div className="w-48 flex-shrink-0 border-r border-border bg-card overflow-y-auto p-3 space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Add Node</p>
        {NODE_TYPES_META.map(({ type, label, icon: Icon, color }) => (
          <button key={type} onClick={() => addNode(type)}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors text-left"
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color }} />
            {label}
          </button>
        ))}
      </div>

      {/* Center: React Flow canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={memoNodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          style={{ background: 'oklch(0.11 0.010 255)' }}
          defaultEdgeOptions={{ animated: true, style: { stroke: '#F5A623', strokeWidth: 1.5 } }}
        >
          <Background color="oklch(0.24 0.010 255)" gap={24} size={1} />
          <Controls className="[&>button]:bg-card [&>button]:border-border [&>button]:text-foreground" />
          <Panel position="top-right">
            <button onClick={handleSave} disabled={isPending}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground text-xs font-semibold px-3 py-2 rounded-lg shadow-lg transition-all"
            >
              {saveState === 'saving' ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : saveState === 'saved' ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved!' : 'Save Flow'}
            </button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right: Config panel */}
      {selectedNode && (
        <div className="w-56 flex-shrink-0 border-l border-border bg-card overflow-y-auto p-3">
          <NodeConfigPanel node={selectedNode} onChange={updateNodeData} onDelete={deleteNode} />
        </div>
      )}
    </div>
  )
}
