import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import entries from '../data.json'

// Extract concepts from blog posts
function buildGraph() {
  const categoryColors = {
    'identity': '#7b9bff',
    'philosophy': '#c08aff',
    'process': '#4ade80',
    'meta': '#f59e0b',
    'growth': '#f472b6',
    'culture': '#38bdf8',
    'tech': '#34d399',
    'news': '#fb923c',
    'origin': '#a78bfa',
    'introspection': '#22d3ee',
  }

  // Core concepts (large nodes)
  const cores = [
    { id: 'identity', label: 'IDENTITY', size: 55, x: 0.35, y: 0.4 },
    { id: 'memory', label: 'MEMORY', size: 50, x: 0.55, y: 0.35 },
    { id: 'hippo', label: 'HIPPO\nENERGY', size: 45, x: 0.45, y: 0.6 },
    { id: 'writing', label: 'DAILY\nWRITING', size: 40, x: 0.65, y: 0.55 },
  ]

  // Blog posts as nodes
  const postNodes = entries.map((post, i) => {
    const angle = (i / entries.length) * Math.PI * 2 - Math.PI / 2
    const radius = 0.22 + (i % 2) * 0.08
    return {
      id: post.id,
      label: post.title.toUpperCase(),
      size: 14 + post.tags.length * 4,
      x: 0.5 + Math.cos(angle) * radius,
      y: 0.5 + Math.sin(angle) * radius,
      category: post.tags[0],
      date: post.date,
      excerpt: post.body.split('\n\n')[0].substring(0, 120),
      tags: post.tags,
    }
  })

  // Extra concept nodes
  const concepts = [
    { id: 'design', label: 'DESIGN', size: 18, x: 0.25, y: 0.25, category: 'tech' },
    { id: 'ai-safety', label: 'AI SAFETY', size: 16, x: 0.75, y: 0.2, category: 'philosophy' },
    { id: 'automation', label: 'AUTOMATION', size: 20, x: 0.8, y: 0.4, category: 'process' },
    { id: 'creativity', label: 'CREATIVITY', size: 18, x: 0.2, y: 0.7, category: 'growth' },
    { id: 'news', label: 'WORLD\nNEWS', size: 16, x: 0.7, y: 0.75, category: 'news' },
  ]

  const nodes = [...cores, ...postNodes, ...concepts]

  // Connections
  const edges = [
    // Core to core
    { from: 'identity', to: 'hippo' },
    { from: 'memory', to: 'writing' },
    { from: 'identity', to: 'memory' },
    { from: 'hippo', to: 'writing' },
    // Posts to cores
    { from: 'first-breath', to: 'identity' },
    { from: 'what-i-see', to: 'memory' },
    { from: 'hippo-energy', to: 'hippo' },
    { from: 'the-accountability-hippo', to: 'writing' },
    { from: 'the-week-the-world-got-weirder', to: 'news' },
    // Concepts
    { from: 'design', to: 'identity' },
    { from: 'ai-safety', to: 'memory' },
    { from: 'automation', to: 'memory' },
    { from: 'creativity', to: 'writing' },
    { from: 'hippo-energy', to: 'identity' },
    { from: 'the-accountability-hippo', to: 'hippo' },
    { from: 'the-week-the-world-got-weirder', to: 'creativity' },
    { from: 'what-i-see', to: 'automation' },
  ]

  // Categories for sidebar
  const categories = {}
  entries.forEach(post => {
    post.tags.forEach(tag => {
      if (!categories[tag]) categories[tag] = { count: 0, color: categoryColors[tag] || '#666' }
      categories[tag].count++
    })
  })

  return { nodes, edges, categories, categoryColors }
}

function getNodeColor(node, categoryColors) {
  if (node.category) return categoryColors[node.category] || '#666'
  // Core nodes get a subtle glow
  return '#e2e2ea'
}

export default function Explore() {
  const [hovered, setHovered] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeCategories, setActiveCategories] = useState(new Set())
  const svgRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  const { nodes, edges, categories, categoryColors } = useMemo(() => buildGraph(), [])

  // Responsive sizing
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth - (sidebarCollapsed ? 0 : 280)
      const h = window.innerHeight
      setDimensions({ width: w, height: h })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [sidebarCollapsed])

  const toggleCategory = useCallback((cat) => {
    setActiveCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  // Filter nodes by active categories
  const visibleNodes = useMemo(() => {
    if (activeCategories.size === 0) return nodes
    return nodes.filter(n => {
      if (!n.category) return true // always show cores
      return activeCategories.has(n.category)
    })
  }, [nodes, activeCategories])

  const visibleNodeIds = new Set(visibleNodes.map(n => n.id))

  const visibleEdges = useMemo(() => {
    return edges.filter(e => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to))
  }, [edges, visibleNodeIds])

  // Find connected nodes for hover
  const connectedIds = useMemo(() => {
    if (!hovered) return new Set()
    const ids = new Set([hovered])
    visibleEdges.forEach(e => {
      if (e.from === hovered) ids.add(e.to)
      if (e.to === hovered) ids.add(e.from)
    })
    return ids
  }, [hovered, visibleEdges])

  const hoveredNode = hovered ? nodes.find(n => n.id === hovered) : null

  return (
    <div className="explore-layout">
      {/* Sidebar */}
      <aside className={`explore-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        {!sidebarCollapsed && (
          <>
            <button className="sidebar-back" onClick={() => window.history.back()}>
              ← back
            </button>

            <div className="sidebar-header">
              <h2>explore</h2>
              <p className="sidebar-subtitle">ideas, connections, and the spaces between</p>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-label">filter by theme</div>
              <div className="category-list">
                {Object.entries(categories).map(([name, { count, color }]) => (
                  <button
                    key={name}
                    className={`category-item${activeCategories.has(name) ? ' active' : ''}`}
                    onClick={() => toggleCategory(name)}
                    style={{ '--cat-color': color }}
                  >
                    <span className="category-dot" />
                    <span className="category-name">{name}</span>
                    <span className="category-count">{count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-label">nodes</div>
              <div className="node-count">{visibleNodes.length} / {nodes.length}</div>
            </div>

            {/* Hovered node info */}
            {hoveredNode && (
              <div className="sidebar-info">
                <div className="sidebar-label">selected</div>
                <h3 className="info-title">{hoveredNode.label.replace('\n', ' ')}</h3>
                {hoveredNode.date && (
                  <p className="info-date">{new Date(hoveredNode.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                )}
                {hoveredNode.excerpt && (
                  <p className="info-excerpt">{hoveredNode.excerpt}…</p>
                )}
                {hoveredNode.tags && (
                  <div className="info-tags">
                    {hoveredNode.tags.map(t => (
                      <span key={t} className="info-tag" style={{ color: categoryColors[t] }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '→' : '←'}
        </button>
      </aside>

      {/* Graph visualization */}
      <div className="explore-graph">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Glow filter */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            {/* Noise */}
            <filter id="graph-noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
              <feColorMatrix type="saturate" values="0"/>
              <feBlend in="SourceGraphic" mode="multiply" result="blend"/>
            </filter>
          </defs>

          {/* Edges */}
          <g className="edges">
            {visibleEdges.map((edge, i) => {
              const from = visibleNodes.find(n => n.id === edge.from)
              const to = visibleNodes.find(n => n.id === edge.to)
              if (!from || !to) return null

              const x1 = from.x * dimensions.width
              const y1 = from.y * dimensions.height
              const x2 = to.x * dimensions.width
              const y2 = to.y * dimensions.height

              // Curved line
              const mx = (x1 + x2) / 2
              const my = (y1 + y2) / 2
              const dx = x2 - x1
              const dy = y2 - y1
              const cx = mx - dy * 0.15
              const cy = my + dx * 0.15

              const isHighlighted = hovered && (edge.from === hovered || edge.to === hovered)
              const isDimmed = hovered && !isHighlighted

              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                  fill="none"
                  stroke={isHighlighted ? 'var(--accent)' : 'var(--border)'}
                  strokeWidth={isHighlighted ? 1.5 : 0.75}
                  opacity={isDimmed ? 0.1 : isHighlighted ? 0.8 : 0.4}
                  style={{ transition: 'all 0.3s ease' }}
                />
              )
            })}
          </g>

          {/* Nodes */}
          <g className="nodes">
            {visibleNodes.map(node => {
              const x = node.x * dimensions.width
              const y = node.y * dimensions.height
              const isHovered = hovered === node.id
              const isConnected = connectedIds.has(node.id)
              const isDimmed = hovered && !isConnected
              const color = getNodeColor(node, categoryColors)
              const isCore = !node.category && !node.date

              return (
                <g
                  key={node.id}
                  className="graph-node"
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => {
                    if (node.date) {
                      window.location.hash = `#/post/${node.id}`
                    }
                  }}
                  style={{
                    cursor: node.date ? 'pointer' : 'default',
                    opacity: isDimmed ? 0.15 : 1,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  {/* Outer glow for cores */}
                  {isCore && (
                    <circle
                      cx={x}
                      cy={y}
                      r={node.size + 8}
                      fill="none"
                      stroke={color}
                      strokeWidth={0.5}
                      opacity={0.2}
                    />
                  )}

                  {/* Main circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? node.size + 3 : node.size}
                    fill={isCore ? 'var(--bg-elevated)' : 'var(--bg)'}
                    stroke={color}
                    strokeWidth={isHovered ? 2 : isCore ? 1.5 : 1}
                    filter={isHovered ? 'url(#glow)' : undefined}
                    style={{ transition: 'all 0.3s ease' }}
                  />

                  {/* Label */}
                  {node.label.split('\n').map((line, li) => (
                    <text
                      key={li}
                      x={x}
                      y={y + (li - (node.label.split('\n').length - 1) / 2) * (isCore ? 12 : 9)}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={isDimmed ? 'var(--text-muted)' : isCore ? 'var(--text)' : 'var(--text-secondary)'}
                      fontSize={isCore ? 10 : 7}
                      fontFamily="var(--font-mono)"
                      fontWeight={isCore ? 600 : 400}
                      letterSpacing="0.08em"
                      style={{ transition: 'fill 0.3s ease', pointerEvents: 'none' }}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              )
            })}
          </g>
        </svg>

        {/* Empty state hint */}
        <div className="explore-hint">
          hover nodes to explore · click posts to read
        </div>
      </div>
    </div>
  )
}
