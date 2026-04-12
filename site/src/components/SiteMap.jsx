import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3-force'
import entries from '../data.json'

const COLORS = {
  identity:'#7b9bff', philosophy:'#c08aff', process:'#4ade80', meta:'#f59e0b',
  growth:'#f472b6', culture:'#38bdf8', tech:'#34d399', news:'#fb923c',
  origin:'#a78bfa', introspection:'#22d3ee', AI:'#38bdf8',
}

const CORES = [
  { id:'identity', label:'IDENTITY', r:45, core:true },
  { id:'memory', label:'MEMORY', r:40, core:true },
  { id:'hippo', label:'HIPPO\nENERGY', r:35, core:true },
  { id:'writing', label:'DAILY\nWRITING', r:30, core:true },
]

const EXTRA = [
  { id:'design', label:'DESIGN', r:14, cat:'tech' },
  { id:'ai-safety', label:'AI SAFETY', r:12, cat:'philosophy' },
  { id:'automation', label:'AUTOMATION', r:16, cat:'process' },
  { id:'creativity', label:'CREATIVITY', r:14, cat:'growth' },
  { id:'news', label:'WORLD\nNEWS', r:12, cat:'news' },
]

const EDGES = [
  ['identity','hippo'],['memory','writing'],['identity','memory'],['hippo','writing'],
  ['first-breath','identity'],['what-i-see','memory'],['hippo-energy','hippo'],
  ['the-accountability-hippo','writing'],['the-week-the-world-got-weirder','news'],
  ['design','identity'],['ai-safety','memory'],['automation','memory'],
  ['creativity','writing'],['hippo-energy','identity'],['the-accountability-hippo','hippo'],
  ['the-week-the-world-got-weirder','creativity'],['what-i-see','automation'],
]

/**
 * Build auto-generated edges from shared tags between posts.
 */
function buildSharedTagEdges(posts) {
  const edges = []
  const seen = new Set()
  for (let i = 0; i < posts.length; i++) {
    for (let j = i + 1; j < posts.length; j++) {
      const a = posts[i], b = posts[j]
      const shared = a.tags.filter(t => b.tags.includes(t))
      if (shared.length > 0) {
        const key = [a.id, b.id].sort().join('|')
        if (!seen.has(key)) {
          seen.add(key)
          edges.push({ source: a.id, target: b.id, type: 'tag-shared' })
        }
      }
    }
  }
  return edges
}

/**
 * Build temporal edges connecting consecutive posts by date.
 */
function buildTemporalEdges(posts) {
  const sorted = [...posts].sort((a, b) => a.date.localeCompare(b.date))
  const edges = []
  for (let i = 0; i < sorted.length - 1; i++) {
    edges.push({ source: sorted[i].id, target: sorted[i + 1].id, type: 'temporal' })
  }
  return edges
}

/**
 * Create tag bridge nodes from the curated post tags.
 * Each unique tag becomes a node that connects all posts with that tag.
 */
function buildTagBridgeNodes(posts) {
  const tagPosts = new Map()
  for (const post of posts) {
    for (const tag of post.tags) {
      if (!tagPosts.has(tag)) tagPosts.set(tag, [])
      tagPosts.get(tag).push(post.id)
    }
  }

  const nodes = []
  const edges = []
  let i = 0
  for (const [tag, postIds] of tagPosts) {
    // Only create bridge nodes for tags shared by 2+ posts
    if (postIds.length < 2) continue
    const bid = `tag:${tag}`
    const angle = (i / tagPosts.size) * Math.PI * 2
    const dist = 200 + (i % 3) * 30
    nodes.push({
      id: bid,
      label: tag.toUpperCase(),
      r: 10 + postIds.length * 2,
      cat: tag,
      x: 400 + Math.cos(angle) * dist,
      y: 350 + Math.sin(angle) * dist,
    })
    for (const pid of postIds) {
      edges.push({ source: bid, target: pid, type: 'tag-bridge' })
    }
    i++
  }
  return { nodes, edges }
}

function buildNodes() {
  const posts = entries.map((p, i) => {
    const a = (i / entries.length) * Math.PI * 2 - Math.PI / 2
    return {
      id: p.id, label: p.title.toUpperCase(), r: 14 + p.tags.length * 4,
      cat: p.tags[0], date: p.date,
      excerpt: p.body.split('\n\n')[0].substring(0, 120),
      tags: p.tags,
      x: 400 + Math.cos(a) * 160, y: 350 + Math.sin(a) * 160,
    }
  })

  const cores = CORES.map(c => ({ ...c, x: 400, y: 350 }))
  const extras = EXTRA.map((c, i) => {
    const a = (i / EXTRA.length) * Math.PI * 2 + Math.PI / 6
    return { ...c, x: 400 + Math.cos(a) * 250, y: 350 + Math.sin(a) * 250 }
  })

  // Tag bridge nodes from curated tags
  const { nodes: tagNodes, edges: tagBridgeEdges } = buildTagBridgeNodes(entries)

  const nodes = [...cores, ...posts, ...tagNodes, ...extras]

  const manualLinks = EDGES.map(([s, t]) => ({ source: s, target: t, type: 'manual' }))
    .filter(l => nodes.some(n => n.id === l.source) && nodes.some(n => n.id === l.target))

  const tagEdges = buildSharedTagEdges(entries)
    .filter(l => nodes.some(n => n.id === l.source) && nodes.some(n => n.id === l.target))

  const temporalEdges = buildTemporalEdges(entries)
    .filter(l => nodes.some(n => n.id === l.source) && nodes.some(n => n.id === l.target))

  const bridgeLinks = tagBridgeEdges
    .filter(l => nodes.some(n => n.id === l.source) && nodes.some(n => n.id === l.target))

  const links = [...manualLinks, ...tagEdges, ...temporalEdges, ...bridgeLinks]
  return { nodes, links }
}

function forceBoundary(w, h, pad = 30) {
  let nodes
  const f = () => {
    for (const n of nodes) {
      n.x = Math.max(pad + n.r, Math.min(w - pad - n.r, n.x))
      n.y = Math.max(pad + n.r, Math.min(h - pad - n.r, n.y))
    }
  }
  f.initialize = n => { nodes = n }
  return f
}

const CORE_IDS = new Set(CORES.map(c => c.id))

function nColor(n, th) {
  if (n.core) return th.text
  if (n.id?.startsWith('tag:')) return COLORS[n.cat] || th.accent
  return COLORS[n.cat] || th.textSec
}

// Reusable canvas for color parsing
const _colorCanvas = document.createElement('canvas')
const _colorCtx = _colorCanvas.getContext('2d')

function getThemeColors() {
  const s = getComputedStyle(document.documentElement)
  const bgElevated = s.getPropertyValue('--bg-elevated').trim() || '#111116'
  const bg = s.getPropertyValue('--bg').trim() || '#0a0a0c'
  const text = s.getPropertyValue('--text').trim() || '#e2e2ea'
  const textSec = s.getPropertyValue('--text-secondary').trim() || '#8888a0'
  const border = s.getPropertyValue('--border').trim() || '#1c1c26'
  const accent = s.getPropertyValue('--accent').trim() || '#7b9bff'
  _colorCtx.fillStyle = border
  const bc = _colorCtx.fillStyle
  const br = parseInt(bc.slice(1, 3), 16), bg2 = parseInt(bc.slice(3, 5), 16), bb = parseInt(bc.slice(5, 7), 16)
  return { bgElevated, bg, text, textSec, border, accent, br, bg2, bb }
}

export default function SiteMap() {
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const simRef = useRef(null)
  const hoveredRef = useRef(null)
  const animRef = useRef(null)
  const dataRef = useRef(null)
  const dragRef = useRef(null)
  const themeRef = useRef(getThemeColors())
  const catsRef = useRef(new Set())
  const grainCanvasRef = useRef(null)
  const [hovered, setHovered] = useState(null)
  // Track if navigation was triggered by touch to prevent ghost click
  const touchNavRef = useRef(false)
  const [collapsed, setCollapsed] = useState(false)
  const [dims, setDims] = useState({ w: 800, h: 600 })
  // Zoom/pan state
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 })
  const transformRef = useRef({ k: 1, x: 0, y: 0 })
  // Focus mode state
  const [focusedNode, setFocusedNode] = useState(null)
  const focusedRef = useRef(null)
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  // Edge filter state
  const [edgeFilters, setEdgeFilters] = useState({
    manual: true,
    'tag-shared': true,
    temporal: true,
    'tag-bridge': true
  })
  // Category filter state
  const [cats, setCats] = useState(new Set())
  // Minimap state
  const minimapRef = useRef(null)
  const [showMinimap, setShowMinimap] = useState(true)

  const { nodes: allNodes, links: allLinks } = useMemo(buildNodes, [])

  const categories = useMemo(() => {
    const c = {}
    entries.forEach(p => p.tags.forEach(t => {
      if (!c[t]) c[t] = { count: 0, color: COLORS[t] || '#666' }
      c[t].count++
    }))
    return c
  }, [])

  // Responsive sizing using ResizeObserver on the graph container
  useEffect(() => {
    const container = canvasRef.current?.parentElement
    if (!container) return

    const updateDims = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w > 0 && h > 0) {
        setDims({ w, h })
      }
    }

    // Initial measurement after layout
    updateDims()

    const observer = new ResizeObserver(updateDims)
    observer.observe(container)

    return () => observer.disconnect()
  }, [collapsed])

  // d3-force simulation
  useEffect(() => {
    const W = dims.w, H = dims.h, cx = W / 2, cy = H / 2
    const nodes = allNodes.map(n => ({ ...n, x: (n.x / 800) * W, y: (n.y / 600) * H }))
    const cpos = {
      identity: [cx - 80, cy - 40], memory: [cx + 60, cy - 60],
      hippo: [cx - 40, cy + 60], writing: [cx + 80, cy + 50],
    }
    for (const n of nodes) {
      if (cpos[n.id]) { n.fx = cpos[n.id][0]; n.fy = cpos[n.id][1]; n.x = n.fx; n.y = n.fy }
    }
    const links = allLinks.map(l => ({ source: l.source, target: l.target }))

    const sim = forceSimulation(nodes)
      .force('center', forceCenter(cx, cy).strength(0.05))
      .force('charge', forceManyBody().strength(-150).distanceMax(450))
      .force('link', forceLink(links).id(d => d.id).distance(d => {
        const sc = CORES.some(c => c.id === (d.source.id || d.source))
        const tc = CORES.some(c => c.id === (d.target.id || d.target))
        return (sc || tc) ? 140 : 80
      }).strength(0.25))
      .force('collide', forceCollide().radius(d => d.r + 12).strength(0.8))
      .force('boundary', forceBoundary(W, H, 50))
      .force('x', forceX(cx).strength(0.03))
      .force('y', forceY(cy).strength(0.03))
      .alphaDecay(0.02).velocityDecay(0.4)

    dataRef.current = { nodes, links }
    simRef.current = sim
    return () => { sim.stop(); if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [dims, allNodes, allLinks])

  // Theme observer
  useEffect(() => {
    themeRef.current = getThemeColors()
    const observer = new MutationObserver(() => { themeRef.current = getThemeColors() })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  // Pre-render grain
  useEffect(() => {
    const gc = document.createElement('canvas')
    gc.width = 200; gc.height = 200
    const gctx = gc.getContext('2d')
    const th = themeRef.current
    gctx.fillStyle = th.text
    for (let i = 0; i < 80; i++) gctx.fillRect(Math.random() * 200, Math.random() * 200, 1, 1)
    grainCanvasRef.current = gc
  }, [])

  // Sync cats ref
  useEffect(() => { catsRef.current = cats }, [cats])

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width = dims.w * dpr; canvas.height = dims.h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    let prevHId = null
    let prevAlpha = -1

    let running = true
    function draw() {
      if (!running) return
      const data = dataRef.current
      if (!data) { animRef.current = requestAnimationFrame(draw); return }
      const { nodes, links } = data
      const W = dims.w, H = dims.h
      const hId = hoveredRef.current
      const sim = simRef.current
      const alpha = sim?.alpha() ?? 0
      const simActive = alpha > 0.001
      const activeCats = catsRef.current
      const isFiltering = activeCats.size > 0
      const interacting = dragRef.current || hId || isPanning.current

      if (!simActive && !interacting && hId === prevHId && alpha === prevAlpha) {
        running = false
        animRef.current = null
        return
      }
      prevHId = hId
      prevAlpha = alpha

      // Get current transform
      const tr = transformRef.current
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // Apply zoom/pan
      ctx.translate(tr.x, tr.y)
      ctx.scale(tr.k, tr.k)

      // Determine which nodes are connected to focus or hover
      const fId = focusedRef.current
      const connectedToFocus = new Set()
      const connectedToHover = new Set()

      if (fId) {
        connectedToFocus.add(fId)
        links.forEach(l => {
          const s = l.source.id || l.source, t = l.target.id || l.target
          if (s === fId) connectedToFocus.add(t)
          if (t === fId) connectedToFocus.add(s)
        })
      }

      if (hId) {
        connectedToHover.add(hId)
        links.forEach(l => {
          const s = l.source.id || l.source, t = l.target.id || l.target
          if (s === hId) connectedToHover.add(t)
          if (t === hId) connectedToHover.add(s)
        })
      }

      // Search match nodes
      const searchMatches = new Set()
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        nodes.forEach(n => {
          if (n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) {
            searchMatches.add(n.id)
          }
        })
      }

      // Draw edges
      const th = themeRef.current
      links.forEach(l => {
        const s = l.source, t = l.target
        if (s.x == null || t.x == null) return

        // Edge type filtering
        const edgeType = l.type || 'manual'
        if (!edgeFilters[edgeType]) return

        // Category filtering
        if (isFiltering) {
          const sVis = !s.cat || activeCats.has(s.cat) || s.core || s.id?.startsWith('tag:')
          const tVis = !t.cat || activeCats.has(t.cat) || t.core || t.id?.startsWith('tag:')
          if (!sVis && !tVis) return
        }

        // Focus mode - dim edges not connected to focus
        let edgeDim = false
        if (fId) {
          if (!connectedToFocus.has(s.id) && !connectedToFocus.has(t.id)) {
            edgeDim = true
          }
        }

        // Hover highlight
        const hi = hId && (s.id === hId || t.id === hId)
        const dm = hId && !hi

        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.quadraticCurveTo(
          (s.x + t.x) / 2 - (t.y - s.y) * 0.08,
          (s.y + t.y) / 2 + (t.x - s.x) * 0.08,
          t.x, t.y
        )

        if (edgeType === 'temporal') {
          ctx.setLineDash([3, 6])
          ctx.strokeStyle = hi ? th.accent : th.textSec
          ctx.globalAlpha = dm || edgeDim ? 0.08 : hi ? 0.9 : 0.25
          ctx.lineWidth = 0.8
        } else if (edgeType === 'tag-shared') {
          ctx.setLineDash([])
          ctx.strokeStyle = hi ? th.accent : th.textSec
          ctx.globalAlpha = dm || edgeDim ? 0.08 : hi ? 0.9 : 0.35
          ctx.lineWidth = hi ? 2 : 1
        } else if (edgeType === 'tag-bridge') {
          ctx.setLineDash([])
          const col = COLORS[s.cat] || COLORS[t.cat] || th.accent
          ctx.strokeStyle = hi ? th.accent : col
          ctx.globalAlpha = dm || edgeDim ? 0.08 : hi ? 0.9 : 0.4
          ctx.lineWidth = hi ? 2 : 1
        } else {
          ctx.setLineDash([])
          ctx.strokeStyle = hi ? th.accent : th.textSec
          ctx.globalAlpha = dm || edgeDim ? 0.08 : hi ? 0.9 : 0.4
          ctx.lineWidth = hi ? 2 : 1.2
        }

        ctx.stroke()
        ctx.setLineDash([])
      })

      // Draw nodes
      ctx.globalAlpha = 1
      const draggedId = dragRef.current?.nodeId

      // Sort nodes: core/nodes first (background), then others (foreground) for proper layering
      const sortedNodes = [...nodes].sort((a, b) => {
        const aPriority = (a.core ? 2 : 0) + (a.id === draggedId ? 1 : 0)
        const bPriority = (b.core ? 2 : 0) + (b.id === draggedId ? 1 : 0)
        return aPriority - bPriority
      })

      sortedNodes.forEach(n => {
        if (n.x == null) return
        if (isFiltering && n.cat && !activeCats.has(n.cat) && !n.core && !n.id?.startsWith('tag:')) return

        // Focus mode dimming
        let isDimmed = false
        if (fId && !connectedToFocus.has(n.id) && !n.core) {
          isDimmed = true
        }

        const isH = hId === n.id
        const isD = draggedId === n.id
        const isC = hId ? connectedToHover.has(n.id) : true
        const dm = hId && !isC
        const col = nColor(n, th)

        ctx.save()
        ctx.globalAlpha = isDimmed ? 0.15 : (dm ? 0.12 : 1)

        // Core glow
        if (n.core) {
          const g = ctx.createRadialGradient(n.x, n.y, n.r * 0.8, n.x, n.y, n.r + 20)
          g.addColorStop(0, col + '15')
          g.addColorStop(1, 'transparent')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.r + 20, 0, Math.PI * 2)
          ctx.fill()
        }

        // Search highlight - subtle ring
        if (searchMatches.has(n.id) && !isH) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2)
          ctx.strokeStyle = th.accent
          ctx.lineWidth = 1.5
          ctx.stroke()
        }

        // Drag glow
        if (isD) {
          const dg = ctx.createRadialGradient(n.x, n.y, n.r, n.x, n.y, n.r + 18)
          dg.addColorStop(0, col + '40')
          dg.addColorStop(1, 'transparent')
          ctx.fillStyle = dg
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.r + 18, 0, Math.PI * 2)
          ctx.fill()
        }

        // Focus highlight - outer ring
        if (fId && connectedToFocus.has(n.id) && !n.core) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2)
          ctx.strokeStyle = th.accent
          ctx.lineWidth = 2
          ctx.globalAlpha = isDimmed ? 0.3 : 0.6
          ctx.stroke()
        }

        const r = isD ? n.r + 5 : isH ? n.r + 3 : n.r
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fillStyle = th.text
        ctx.fill()
        const showBorder = n.core || isD || isH;
        ctx.strokeStyle = showBorder ? col : 'transparent';
        ctx.lineWidth = showBorder ? (isD ? 3 : isH ? 2.5 : n.core ? 1.5 : 1) : 0
        ctx.stroke()

        const lines = n.label.split('\n')
        const fs = n.core ? 10 : n.r > 20 ? 7.5 : 6.5
        ctx.font = `${n.core ? '600' : '400'} ${fs}px "JetBrains Mono","Fira Code",monospace`
        ctx.fillStyle = th.bg
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const lh = fs + 2
        const sy = n.y - ((lines.length - 1) * lh) / 2
        lines.forEach((ln, li) => ctx.fillText(ln, n.x, sy + li * lh))
        ctx.restore()
      })

      // Grain overlay (still in screen space)
      const gc = grainCanvasRef.current
      if (gc) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.globalAlpha = 0.02
        const pat = ctx.createPattern(gc, 'repeat')
        ctx.fillStyle = pat
        ctx.fillRect(0, 0, W, H)
      }
      ctx.globalAlpha = 1

      animRef.current = requestAnimationFrame(draw)
    }

    // Expose loop starter for event handlers
    const startLoop = () => {
      if (!running) {
        running = true
        animRef.current = requestAnimationFrame(draw)
      }
    }
    dataRef.current = { ...dataRef.current, startLoop }
    animRef.current = requestAnimationFrame(draw)
    return () => {
      running = false
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [dims])

  // ── Minimap Rendering ──
  useEffect(() => {
    const canvas = minimapRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const mmSize = 180
    canvas.width = mmSize
    canvas.height = mmSize

    const data = dataRef.current
    if (!data) return

    const { nodes, links } = data
    const activeCats = catsRef.current
    const isFiltering = activeCats.size > 0
    const searchMatches = new Set()
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      nodes.forEach(n => {
        if (n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) {
          searchMatches.add(n.id)
        }
      })
    }

    const scale = 1.5 // Minimal additional scaling
    const offsetX = 20
    const offsetY = 20
    const bg = themeRef.current.bg
    const border = themeRef.current.border
    const accent = themeRef.current.accent
    const textSec = themeRef.current.textSecondary

    ctx.fillStyle = bg
    ctx.fillRect(0, 0, mmSize, mmSize)
    ctx.strokeStyle = border
    ctx.strokeRect(0, 0, mmSize, mmSize)

    // Get bounds of ALL nodes (unfiltered) to auto-scale minimap
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    nodes.forEach(n => {
      if (n.x < minX) minX = n.x
      if (n.x > maxX) maxX = n.x
      if (n.y < minY) minY = n.y
      if (n.y > maxY) maxY = n.y
    })
    const padding = 40
    const graphW = maxX - minX + padding * 2
    const graphH = maxY - minY + padding * 2
    const mmScale = Math.min((mmSize - 20) / graphW, (mmSize - 20) / graphH, 1)
    const mmCenterX = mmSize / 2
    const mmCenterY = mmSize / 2
    const graphCenterX = (minX + maxX) / 2
    const graphCenterY = (minY + maxY) / 2

    // Draw links (simplified)
    ctx.strokeStyle = border
    ctx.lineWidth = 0.3
    links.forEach(l => {
      const s = l.source, t = l.target
      if (s.x == null || t.x == null) return
      // Dim links if nodes are filtered out
      if (isFiltering) {
        const sVis = !s.cat || activeCats.has(s.cat) || s.core || s.id?.startsWith('tag:')
        const tVis = !t.cat || activeCats.has(t.cat) || t.core || t.id?.startsWith('tag:')
        if (!sVis && !tVis) return
      }
      ctx.beginPath()
      ctx.moveTo((s.x - graphCenterX) * mmScale + mmCenterX, (s.y - graphCenterY) * mmScale + mmCenterY)
      ctx.lineTo((t.x - graphCenterX) * mmScale + mmCenterX, (t.y - graphCenterY) * mmScale + mmCenterY)
      ctx.globalAlpha = 0.4
      ctx.stroke()
      ctx.globalAlpha = 1
    })

    // Draw nodes (dots)
    nodes.forEach(n => {
      if (n.x == null) return
      if (isFiltering && n.cat && !activeCats.has(n.cat) && !n.core && !n.id?.startsWith('tag:')) {
        return // skip filtered nodes
      }
      const x = (n.x - graphCenterX) * mmScale + mmCenterX
      const y = (n.y - graphCenterY) * mmScale + mmCenterY
      const r = Math.max(1.5, n.r * mmScale * 0.2)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      // Highlight search matches
      if (searchMatches.has(n.id)) {
        ctx.fillStyle = accent
        ctx.globalAlpha = 1
      } else {
        ctx.fillStyle = n.core ? accent : (COLORS[n.cat] || textSec)
        ctx.globalAlpha = 0.7
      }
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // Draw viewport rectangle
    const tr = transformRef.current
    // Determine visible world bounds based on transform
    const visibleWorldW = dims.w / tr.k
    const visibleWorldH = dims.h / tr.k
    const vpHalfW = visibleWorldW / 2
    const vpHalfH = visibleWorldH / 2
    const centerWorldX = (dims.w / 2 - tr.x) / tr.k
    const centerWorldY = (dims.h / 2 - tr.y) / tr.k

    const vpX = (centerWorldX - graphCenterX) * mmScale + mmCenterX
    const vpY = (centerWorldY - graphCenterY) * mmScale + mmCenterY
    const vpW = visibleWorldW * mmScale
    const vpH = visibleWorldH * mmScale

    ctx.strokeStyle = accent
    ctx.lineWidth = 1.5
    ctx.strokeRect(vpX - vpW/2, vpY - vpH/2, vpW, vpH)
  }, [dims, transform, focusedNode, hovered, searchQuery, cats, edgeFilters])

  const hitTest = useCallback((mx, my) => {
    if (!dataRef.current) return null
    // Convert screen coordinates to world coordinates
    const tr = transformRef.current
    const worldX = (mx - tr.x) / tr.k
    const worldY = (my - tr.y) / tr.k

    // Consider active category filters
    const activeCats = catsRef.current
    const isFiltering = activeCats.size > 0

    for (const n of dataRef.current.nodes) {
      if (isFiltering && n.cat && !activeCats.has(n.cat) && !n.core && !n.id?.startsWith('tag:')) {
        continue
      }
      const dx = n.x - worldX, dy = n.y - worldY
      if (dx * dx + dy * dy <= (n.r + 4) * (n.r + 4)) return n
    }
    return null
  }, [])

  // ── Drag ──
  const pendingDragRef = useRef(null)
  const velocityRef = useRef({ vx: 0, vy: 0, lastX: 0, lastY: 0, lastT: 0 })
  const DRAG_THRESHOLD = 4

  const commitDrag = useCallback((pend) => {
    const n = dataRef.current?.nodes.find(n => n.id === pend.nodeId)
    if (!n) return
    n.fx = n.x; n.fy = n.y
    velocityRef.current = { vx: 0, vy: 0, lastX: n.x, lastY: n.y, lastT: performance.now() }
    dragRef.current = { nodeId: n.id, offsetX: pend.offsetX, offsetY: pend.offsetY }
    pendingDragRef.current = null
    simRef.current?.alpha(0.6).restart()
    dataRef.current?.startLoop?.()
  }, [])

  const endDrag = useCallback(() => {
    if (!dragRef.current && !pendingDragRef.current && !isPanning.current) return
    const nodeId = dragRef.current?.nodeId
    pendingDragRef.current = null
    dragRef.current = null
    isPanning.current = false
    document.removeEventListener('mousemove', docMouseMove)
    document.removeEventListener('mouseup', endDrag)
    document.removeEventListener('touchmove', docTouchMove)
    document.removeEventListener('touchend', endDrag)
    if (canvasRef.current) canvasRef.current.style.cursor = 'default'
    if (!nodeId || !dataRef.current) return
    const n = dataRef.current.nodes.find(n => n.id === nodeId)
    if (n && !CORE_IDS.has(n.id)) {
      const vel = velocityRef.current
      n.vx = vel.vx; n.vy = vel.vy
      n.fx = null; n.fy = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const docMouseMove = useCallback((e) => {
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r || !dataRef.current) return

    // Handle panning
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      const newX = lastPanPos.current.x + dx
      const newY = lastPanPos.current.y + dy
      const newTransform = { ...transformRef.current, x: newX, y: newY }
      transformRef.current = newTransform
      setTransform(newTransform)
      dataRef.current?.startLoop?.()
      return
    }

    const mx = e.clientX - r.left, my = e.clientY - r.top

    if (pendingDragRef.current) {
      const pend = pendingDragRef.current
      const dx = mx - pend.startX, dy = my - pend.startY
      if (dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
        commitDrag(pend)
      } else { return }
    }

    if (!dragRef.current) return
    const n = dataRef.current.nodes.find(n => n.id === dragRef.current.nodeId)
    if (!n) return

    const newFx = mx - dragRef.current.offsetX
    const newFy = my - dragRef.current.offsetY

    const now = performance.now()
    const dt = now - velocityRef.current.lastT
    if (dt > 0) {
      velocityRef.current.vx = (newFx - velocityRef.current.lastX) / dt * 16
      velocityRef.current.vy = (newFy - velocityRef.current.lastY) / dt * 16
      velocityRef.current.lastX = newFx
      velocityRef.current.lastY = newFy
      velocityRef.current.lastT = now
    }

    n.fx = newFx; n.fy = newFy
    simRef.current?.alpha(0.6).restart()
    dataRef.current?.startLoop?.()
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
  }, [commitDrag])

  const docTouchMove = useCallback((e) => {
    e.preventDefault()
    docMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY })
  }, [docMouseMove])

  // ── Zoom/Pan Handlers ──
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newK = Math.max(0.2, Math.min(3, transformRef.current.k * zoomFactor))

    // Zoom toward mouse position
    const worldX = (mouseX - transformRef.current.x) / transformRef.current.k
    const worldY = (mouseY - transformRef.current.y) / transformRef.current.k

    const newX = mouseX - worldX * newK
    const newY = mouseY - worldY * newK

    const newTransform = { k: newK, x: newX, y: newY }
    transformRef.current = newTransform
    setTransform(newTransform)
    dataRef.current?.startLoop?.()
  }, [])

  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const lastPanPos = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e) => {
    // Middle mouse button or shift+click for pan
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault()
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY }
      lastPanPos.current = { x: transformRef.current.x, y: transformRef.current.y }
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
      return
    }

    // Left click for node dragging
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r || !dataRef.current) return
    const mx = e.clientX - r.left, my = e.clientY - r.top
    const n = hitTest(mx, my)
    if (n && !n.core) {
      pendingDragRef.current = {
        nodeId: n.id, startX: mx, startY: my,
        offsetX: mx - n.x, offsetY: my - n.y,
      }
      document.addEventListener('mousemove', docMouseMove)
      document.addEventListener('mouseup', endDrag)
    }
  }, [hitTest, docMouseMove, endDrag])

  const handleTouchStart = useCallback((e) => {
    e.preventDefault()
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r || !dataRef.current) return
    const touch = e.touches[0]
    const mx = touch.clientX - r.left, my = touch.clientY - r.top
    // Update hovered for immediate visual feedback
    const f = hitTest(mx, my)
    if (f?.id !== hoveredRef.current) {
      hoveredRef.current = f?.id || null
      setHovered(hoveredRef.current)
      dataRef.current?.startLoop?.()
    }
    if (f && !f.core) {
      pendingDragRef.current = {
        nodeId: f.id, startX: mx, startY: my,
        offsetX: mx - f.x, offsetY: my - f.y,
      }
      document.addEventListener('touchmove', docTouchMove, { passive: false })
      document.addEventListener('touchend', endDrag)
    }
  }, [hitTest, docTouchMove, endDrag])

  const handleMove = useCallback((e) => {
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r || !dataRef.current) return
    if (dragRef.current) return
    const mx = e.clientX - r.left, my = e.clientY - r.top
    const f = hitTest(mx, my)
    const newH = f?.id || null
    if (newH !== hoveredRef.current) {
      hoveredRef.current = newH; setHovered(newH)
      dataRef.current?.startLoop?.()
    }
    canvasRef.current.style.cursor = f?.date ? 'pointer' : 'default'
  }, [hitTest])

  const handleTouchMove = useCallback((e) => {
    e.preventDefault()
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r || !dataRef.current) return
    if (dragRef.current || pendingDragRef.current) return
    const touch = e.touches[0]
    const mx = touch.clientX - r.left, my = touch.clientY - r.top
    const f = hitTest(mx, my)
    if (f?.id !== hoveredRef.current) {
      hoveredRef.current = f?.id || null
      setHovered(hoveredRef.current)
      dataRef.current?.startLoop?.()
    }
  }, [hitTest])

  const handleTouchEnd = useCallback((e) => {
    if (dragRef.current) return
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r || !dataRef.current) return
    const touch = e.changedTouches[0]
    const mx = touch.clientX - r.left, my = touch.clientY - r.top
    const n = hitTest(mx, my)
    if (n?.date) {
      navigate(`/post/${n.id}`)
      touchNavRef.current = true // mark to prevent subsequent click
    }
  }, [hitTest, navigate])

  const handleMouseLeave = useCallback(() => {
    if (!dragRef.current) {
      hoveredRef.current = null; setHovered(null)
      if (canvasRef.current) canvasRef.current.style.cursor = 'default'
      dataRef.current?.startLoop?.()
    }
  }, [])

  const handleClick = useCallback(() => {
    if (touchNavRef.current) {
      touchNavRef.current = false
      return
    }
    if (!hovered || !dataRef.current) return
    const n = dataRef.current.nodes.find(n => n.id === hovered)
    if (n?.date) navigate(`/post/${n.id}`)
  }, [hovered, navigate])

  const handleDoubleClick = useCallback((e) => {
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r || !dataRef.current) return
    const mx = e.clientX - r.left, my = e.clientY - r.top
    const n = hitTest(mx, my)
    if (n) {
      focusedRef.current = n.id
      setFocusedNode(n.id)
      // Auto-zoom to fit the focused node's connected component
      const connected = new Set()
      connected.add(n.id)
      dataRef.current.links.forEach(l => {
        const s = l.source.id || l.source, t = l.target.id || l.target
        if (s === n.id) connected.add(t)
        if (t === n.id) connected.add(s)
      })
      const connectedNodes = dataRef.current.nodes.filter(n => connected.has(n.id))
      if (connectedNodes.length > 1) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        connectedNodes.forEach(n => {
          if (n.x < minX) minX = n.x
          if (n.x > maxX) maxX = n.x
          if (n.y < minY) minY = n.y
          if (n.y > maxY) maxY = n.y
        })
        const padding = 60
        const compW = maxX - minX + padding * 2
        const compH = maxY - minY + padding * 2
        const centerX = (minX + maxX) / 2
        const centerY = (minY + maxY) / 2
        const scale = Math.min(dims.w / compW, dims.h / compH, 1.5)
        const newK = scale
        const newX = dims.w / 2 - centerX * scale
        const newY = dims.h / 2 - centerY * scale
        setTransform({ k: newK, x: newX, y: newY })
      }
    } else {
      // Double-click on empty space clears focus
      focusedRef.current = null
      setFocusedNode(null)
    }
    dataRef.current?.startLoop?.()
  }, [hitTest, dims])

  const clearFocus = useCallback(() => {
    focusedRef.current = null
    setFocusedNode(null)
    dataRef.current?.startLoop?.()
  }, [])

  // Fit all nodes to view
  const fitToView = useCallback(() => {
    if (!dataRef.current) return
    const nodes = dataRef.current.nodes
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    nodes.forEach(n => {
      if (n.x < minX) minX = n.x
      if (n.x > maxX) maxX = n.x
      if (n.y < minY) minY = n.y
      if (n.y > maxY) maxY = n.y
    })
    const padding = 80
    const graphW = maxX - minX + padding * 2
    const graphH = maxY - minY + padding * 2
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const scale = Math.min(dims.w / graphW, dims.h / graphH, 1)
    const newX = dims.w / 2 - centerX * scale
    const newY = dims.h / 2 - centerY * scale
    setTransform({ k: scale, x: newX, y: newY })
    dataRef.current?.startLoop?.()
  }, [dims])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        clearFocus()
        if (document.activeElement instanceof HTMLInputElement) {
          document.activeElement.blur()
        }
      }
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        // 'f' key for fit-to-view (not interfering with browser find)
        fitToView()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearFocus, fitToView])

  // Minimap click to navigate
  const handleMinimapClick = useCallback((e) => {
    const canvas = minimapRef.current
    if (!canvas || !dataRef.current) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    // Get graph bounds
    const nodes = dataRef.current.nodes
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    nodes.forEach(n => {
      if (n.x < minX) minX = n.x
      if (n.x > maxX) maxX = n.x
      if (n.y < minY) minY = n.y
      if (n.y > maxY) maxY = n.y
    })
    const padding = 40
    const graphW = maxX - minX + padding * 2
    const graphH = maxY - minY + padding * 2
    const mmCenterX = 90
    const mmCenterY = 90
    const graphCenterX = (minX + maxX) / 2
    const graphCenterY = (minY + maxY) / 2
    const mmScale = Math.min((180 - 20) / graphW, (180 - 20) / graphH, 1)

    // Convert minimap click to world coordinates
    const worldX = (mx - mmCenterX) / mmScale + graphCenterX
    const worldY = (my - mmCenterY) / mmScale + graphCenterY

    // Center view on that world point
    const newX = dims.w / 2 - worldX * transformRef.current.k
    const newY = dims.h / 2 - worldY * transformRef.current.k
    setTransform({ k: transformRef.current.k, x: newX, y: newY })
    dataRef.current?.startLoop?.()
  }, [dims])

  const toggleCat = useCallback((c) => setCats(p => {
    const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n
  }), [])

  const hNode = hovered && dataRef.current?.nodes.find(n => n.id === hovered)
  const visCount = cats.size === 0 ? allNodes.length : allNodes.filter(n => !n.cat || cats.has(n.cat) || n.core || n.id?.startsWith('tag:')).length

  return (
    <div className="sitemap-layout">
      <aside className={`sitemap-sidebar${collapsed ? ' collapsed' : ''}`}>
        {!collapsed && <>
          <button className="sidebar-back" onClick={() => navigate(-1)}>← back</button>
          <div className="sidebar-header">
            <h2>site map</h2>
            <p className="sidebar-subtitle">ideas, connections, and the spaces between</p>
          </div>

          {/* Search */}
          <div className="sidebar-section search-section">
            <div className="sidebar-label">search nodes</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="text"
                className="search-input"
                placeholder="Type to search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search-btn" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>
          </div>

          {/* Edge Filters */}
          <div className="sidebar-section">
            <div className="sidebar-label">edge types</div>
            <div className="edge-filter-list">
              {Object.entries(edgeFilters).map(([type, enabled]) => (
                <label key={type} className="edge-filter-item">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEdgeFilters(f => ({ ...f, [type]: e.target.checked }))}
                  />
                  <span className="edge-filter-label">{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">filter by theme</div>
            <div className="category-list">
              {Object.entries(categories).map(([name, { count, color }]) => (
                <button key={name} className={`category-item${cats.has(name) ? ' active' : ''}`}
                  onClick={() => toggleCat(name)} style={{ '--cat-color': color }}>
                  <span className="category-dot" /><span className="category-name">{name}</span>
                  <span className="category-count">{count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="sidebar-section">
            <div className="sidebar-label">nodes</div>
            <div className="node-count">{visCount} / {allNodes.length}</div>
          </div>
          {focusedNode && (
            <div className="sidebar-section focus-controls">
              <button className="clear-focus-btn" onClick={clearFocus}>Clear Focus Mode</button>
            </div>
          )}
          <div className="sidebar-section">
            <div className="sidebar-label">keyboard</div>
            <div className="keyboard-shortcuts">
              <div className="shortcut"><kbd>ESC</kbd> clear focus</div>
              <div className="shortcut"><kbd>F</kbd> fit view</div>
            </div>
          </div>
          <div className="sidebar-section">
            <div className="sidebar-label">view</div>
            <button className="toggle-minimap-btn" onClick={() => setShowMinimap(s => !s)}>
              {showMinimap ? 'Hide Minimap' : 'Show Minimap'}
            </button>
          </div>
          {hNode && <div className="sidebar-info">
            <div className="sidebar-label">selected</div>
            <h3 className="info-title">{hNode.label.replace('\n', ' ')}</h3>
            {hNode.date && <p className="info-date">{new Date(hNode.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>}
            {hNode.excerpt && <p className="info-excerpt">{hNode.excerpt}…</p>}
            {hNode.tags && <div className="info-tags">{hNode.tags.map(t => <span key={t} className="info-tag" style={{ color: COLORS[t] }}>{t}</span>)}</div>}
          </div>}
        </>}
        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? '→' : '←'}</button>
      </aside>
      <div className="sitemap-graph">

        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMove}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        <div className="sitemap-hint">hover nodes to explore · click posts to read · scroll to zoom · shift+drag to pan · double-click for focus</div>
        <div className="zoom-controls">
          <button className="zoom-btn" onClick={() => {
            const newK = Math.min(3, transformRef.current.k * 1.2)
            setTransform({ ...transformRef.current, k: newK })
          }} title="Zoom In">+</button>
          <span className="zoom-level">{Math.round(transform.k * 100)}%</span>
          <button className="zoom-btn" onClick={() => {
            const newK = Math.max(0.2, transformRef.current.k * 0.8)
            setTransform({ ...transformRef.current, k: newK })
          }} title="Zoom Out">−</button>
          <button className="zoom-reset" onClick={fitToView} title="Fit to View">⛶</button>
        </div>
        {showMinimap && <div className="minimap">
          <canvas ref={minimapRef} width={180} height={180} title="Minimap (overview)" onClick={handleMinimapClick} />
        </div>}
      </div>
    </div>
  )
}
