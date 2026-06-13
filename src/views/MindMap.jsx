import { useMemo, useCallback } from 'react'
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useDashboard } from '../context/DashboardContext'
import { Brain } from 'lucide-react'

const STATUS_COLORS = {
  done: '#22c55e',
  in_progress: '#f59e0b',
  review: '#8b5cf6',
  todo: '#3b82f6',
  backlog: '#6b7280',
}

const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }

function ProjectNode({ data }) {
  return (
    <div
      className="px-4 py-3 rounded-xl border-2 font-bold text-sm text-white shadow-lg min-w-[120px] text-center"
      style={{ backgroundColor: data.color + '33', borderColor: data.color }}
    >
      <div className="text-base">{data.label}</div>
      <div className="text-xs opacity-70 font-normal mt-0.5">{data.taskCount} tareas</div>
    </div>
  )
}

function TaskNode({ data }) {
  return (
    <div
      className="px-3 py-2 rounded-lg border text-xs text-zinc-200 shadow-md max-w-[160px]"
      style={{ backgroundColor: '#18181b', borderColor: data.statusColor + '60' }}
    >
      <div className="font-medium truncate">{data.label}</div>
      <div className="flex items-center gap-1 mt-1">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: data.priorityColor }} />
        <span className="opacity-50">{data.status}</span>
      </div>
    </div>
  )
}

const nodeTypes = { project: ProjectNode, task: TaskNode }

export default function MindMap() {
  const { projects, tasks } = useDashboard()

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes = []
    const edges = []

    // Center node
    nodes.push({
      id: 'root',
      type: 'default',
      position: { x: 0, y: 0 },
      data: { label: '⚡ Dashboard' },
      style: {
        background: '#7c3aed',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontWeight: 'bold',
        padding: '10px 20px',
      },
    })

    const projectsToShow = projects.slice(0, 8)
    const angleStep = (2 * Math.PI) / Math.max(projectsToShow.length, 1)
    const radius = 320

    projectsToShow.forEach((project, pi) => {
      const angle = pi * angleStep - Math.PI / 2
      const px = Math.cos(angle) * radius
      const py = Math.sin(angle) * radius

      const projectTasks = tasks.filter(t => t.project_id === project.id)

      nodes.push({
        id: project.id,
        type: 'project',
        position: { x: px - 60, y: py - 30 },
        data: {
          label: project.name,
          color: project.color || '#7c3aed',
          taskCount: projectTasks.length,
        },
      })

      edges.push({
        id: `root-${project.id}`,
        source: 'root',
        target: project.id,
        style: { stroke: project.color || '#7c3aed', strokeWidth: 2, opacity: 0.6 },
        markerEnd: { type: MarkerType.ArrowClosed, color: project.color || '#7c3aed' },
      })

      // Task nodes (show up to 5 per project)
      const visibleTasks = projectTasks.slice(0, 5)
      const taskAngleStep = Math.PI / (Math.max(visibleTasks.length, 1) + 1)
      const taskStartAngle = angle - (visibleTasks.length - 1) * taskAngleStep / 2
      const taskRadius = 200

      visibleTasks.forEach((task, ti) => {
        const taskAngle = taskStartAngle + ti * taskAngleStep
        const tx = px + Math.cos(taskAngle) * taskRadius
        const ty = py + Math.sin(taskAngle) * taskRadius

        nodes.push({
          id: task.id,
          type: 'task',
          position: { x: tx - 80, y: ty - 25 },
          data: {
            label: task.title,
            status: task.status,
            statusColor: STATUS_COLORS[task.status] || '#6b7280',
            priorityColor: PRIORITY_COLORS[task.priority] || '#6b7280',
          },
        })

        edges.push({
          id: `${project.id}-${task.id}`,
          source: project.id,
          target: task.id,
          style: { stroke: STATUS_COLORS[task.status] || '#6b7280', strokeWidth: 1, opacity: 0.4 },
          type: 'smoothstep',
        })
      })

      if (projectTasks.length > 5) {
        const moreId = `${project.id}-more`
        const moreAngle = taskStartAngle + visibleTasks.length * taskAngleStep
        nodes.push({
          id: moreId,
          position: {
            x: px + Math.cos(moreAngle) * taskRadius - 40,
            y: py + Math.sin(moreAngle) * taskRadius - 15,
          },
          data: { label: `+${projectTasks.length - 5} más` },
          style: { background: '#27272a', color: '#a1a1aa', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '11px', padding: '4px 10px' },
        })
        edges.push({ id: `${project.id}-${moreId}`, source: project.id, target: moreId, style: { stroke: '#3f3f46', strokeWidth: 1, opacity: 0.4 } })
      }
    })

    // Tasks without project
    const orphanTasks = tasks.filter(t => !t.project_id).slice(0, 6)
    if (orphanTasks.length > 0) {
      nodes.push({
        id: 'no-project',
        type: 'project',
        position: { x: 0, y: radius + 120 },
        data: { label: 'Sin proyecto', color: '#6b7280', taskCount: orphanTasks.length },
      })
      edges.push({ id: 'root-no-project', source: 'root', target: 'no-project', style: { stroke: '#6b7280', strokeWidth: 1, opacity: 0.4 } })
    }

    return { initialNodes: nodes, initialEdges: edges }
  }, [projects, tasks])

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <Brain size={20} className="text-zinc-400" /> Mapa Mental
        </h1>
        <div className="text-xs text-zinc-500">{projects.length} proyectos · {tasks.length} tareas</div>
      </div>
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#27272a" gap={24} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(n) => n.data?.color || '#7c3aed'}
            maskColor="rgba(9,9,11,0.8)"
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-6 py-3 border-t border-zinc-800 flex-shrink-0">
        <div className="text-xs text-zinc-600 font-medium">Estado:</div>
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <span key={s} className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
            {s.replace('_', ' ')}
          </span>
        ))}
      </div>
    </div>
  )
}
