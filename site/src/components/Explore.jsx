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
  { id:'identity', label:'IDENTITY', r:55, core:true },
  { id:'memory', label:'MEMORY', r:50, core:true },
  { id:'hippo', label:'HIPPO\nENERGY', r:45, core:true },
  { id:'writing', label:'DAILY\nWRITING', r:40, core:true },
]

const EXTRA = [
  { id:'design', label:'DESIGN', r:18, cat:'tech' },
  { id:'ai-safety', label:'AI SAFETY', r:16, cat:'philosophy' },
  { id:'automation', label:'AUTOMATION', r:20, cat:'process' },
  { id:'creativity', label:'CREATIVITY', r:18, cat:'growth' },
  { id:'news', label:'WORLD\nNEWS', r:16, cat:'news' },
]

const EDGES = [
  ['identity','hippo'],['memory','writing'],['identity','memory'],['hippo','writing'],
  ['first-breath','identity'],['what-i-see','memory'],['hippo-energy','hippo'],
  ['the-accountability-hippo','writing'],['the-week-the-world-got-weirder','news'],
  ['design','identity'],['ai-safety','memory'],['automation','memory'],
  ['creativity','writing'],['hippo-energy','identity'],['the-accountability-hippo','hippo'],
  ['the-week-the-world-got-weirder','creativity'],['what-i-see','automation'],
]

function buildNodes() {
  const posts = entries.map((p, i) => {
    const a = (i / entries.length) * Math.PI * 2 - Math.PI / 2
    return { id:p.id, label:p.title.toUpperCase(), r:14 + p.tags.length * 4,
      cat:p.tags[0], date:p.date, excerpt:p.body.split('\n\n')[0].substring(0,120), tags:p.tags,
      x: 400+Math.cos(a)*160, y: 350+Math.sin(a)*160 }
  })
  const cores = CORES.map(c => ({ ...c, x:400, y:350 }))
  const extras = EXTRA.map((c,i) => {
    const a = (i/EXTRA.length)*Math.PI*2 + Math.PI/6
    return { ...c, x:400+Math.cos(a)*250, y:350+Math.sin(a)*250 }
  })
  const nodes = [...cores, ...posts, ...extras]
  const links = EDGES.map(([s,t]) => ({ source:s, target:t }))
    .filter(l => nodes.some(n=>n.id===l.source) && nodes.some(n=>n.id===l.target))
  return { nodes, links }
}

function forceBoundary(w, h, pad = 30) {
  let nodes
  const f = () => { for (const n of nodes) {
    n.x = Math.max(pad+n.r, Math.min(w-pad-n.r, n.x))
    n.y = Math.max(pad+n.r, Math.min(h-pad-n.r, n.y))
  }}
  f.initialize = n => { nodes = n }
  return f
}

function nColor(n) { return n.core ? '#e2e2ea' : COLORS[n.cat] || '#666' }

export default function Explore() {
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const simRef = useRef(null)
  const hoveredRef = useRef(null)
  const animRef = useRef(null)
  const dataRef = useRef(null)
  const [hovered, setHovered] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [cats, setCats] = useState(new Set())
  const [dims, setDims] = useState({ w:800, h:600 })

  const { nodes: allNodes, links: allLinks } = useMemo(buildNodes, [])

  const categories = useMemo(() => {
    const c = {}
    entries.forEach(p => p.tags.forEach(t => {
      if (!c[t]) c[t] = { count:0, color: COLORS[t]||'#666' }
      c[t].count++
    }))
    return c
  }, [])

  // Responsive sizing
  useEffect(() => {
    const upd = () => {
      const el = canvasRef.current?.parentElement
      if (el) setDims({ w:el.clientWidth, h:el.clientHeight })
    }
    upd()
    window.addEventListener('resize', upd)
    return () => window.removeEventListener('resize', upd)
  }, [collapsed])

  // d3-force simulation
  useEffect(() => {
    const W = dims.w, H = dims.h, cx = W/2, cy = H/2
    const nodes = allNodes.map(n => ({ ...n, x: (n.x/800)*W, y: (n.y/600)*H }))
    const cpos = { identity:[cx-80,cy-40], memory:[cx+60,cy-60], hippo:[cx-40,cy+60], writing:[cx+80,cy+50] }
    for (const n of nodes) { if (cpos[n.id]) { n.fx = cpos[n.id][0]; n.fy = cpos[n.id][1]; n.x = n.fx; n.y = n.fy } }
    const links = allLinks.map(l => ({ source:l.source, target:l.target }))

    const sim = forceSimulation(nodes)
      .force('center', forceCenter(cx,cy).strength(0.05))
      .force('charge', forceManyBody().strength(-150).distanceMax(450))
      .force('link', forceLink(links).id(d=>d.id).distance(d => {
        const sc = CORES.some(c=>c.id===(d.source.id||d.source))
        const tc = CORES.some(c=>c.id===(d.target.id||d.target))
        return (sc||tc) ? 160 : 100
      }).strength(0.3))
      .force('collide', forceCollide().radius(d=>d.r+6).strength(0.7))
      .force('boundary', forceBoundary(W,H,40))
      .force('x', forceX(cx).strength(0.03))
      .force('y', forceY(cy).strength(0.03))
      .alphaDecay(0.02).velocityDecay(0.4)

    dataRef.current = { nodes, links }
    simRef.current = sim
    return () => { sim.stop(); if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [dims, allNodes, allLinks])

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width = dims.w * dpr; canvas.height = dims.h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    function draw() {
      const data = dataRef.current
      if (!data) { animRef.current = requestAnimationFrame(draw); return }
      const { nodes, links } = data
      const W = dims.w, H = dims.h
      const hId = hoveredRef.current
      const conn = new Set()
      if (hId) { conn.add(hId); links.forEach(l => {
        const s=l.source.id||l.source, t=l.target.id||l.target
        if (s===hId) conn.add(t); if (t===hId) conn.add(s)
      })}

      ctx.clearRect(0, 0, W, H)
      const alpha = simRef.current?.alpha() ?? 1

      // Edges
      links.forEach(l => {
        const s = l.source, t = l.target
        if (!s.x || !t.x) return
        const hi = hId && (s.id===hId || t.id===hId)
        const dm = hId && !hi
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.quadraticCurveTo((s.x+t.x)/2-(t.y-s.y)*0.08, (s.y+t.y)/2+(t.x-s.x)*0.08, t.x, t.y)
        ctx.strokeStyle = hi ? '#6b8cff' : 'rgba(148,163,184,0.25)'
        ctx.globalAlpha = dm ? 0.05 : hi ? 0.8 : Math.max(0.15, 0.4*alpha)
        ctx.lineWidth = hi ? 1.5 : 0.75
        ctx.stroke()
      })

      // Nodes
      ctx.globalAlpha = 1
      nodes.forEach(n => {
        const isH = hId === n.id
        const isC = hId ? conn.has(n.id) : true
        const dm = hId && !isC
        const col = nColor(n)
        ctx.save(); ctx.globalAlpha = dm ? 0.12 : 1

        // Core glow
        if (n.core) {
          const g = ctx.createRadialGradient(n.x, n.y, n.r*0.8, n.x, n.y, n.r+20)
          g.addColorStop(0, col+'15'); g.addColorStop(1, 'transparent')
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, n.r+20, 0, Math.PI*2); ctx.fill()
        }

        // Circle
        const r = isH ? n.r+3 : n.r
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI*2)
        ctx.fillStyle = n.core ? '#1a1a2e' : '#0d0d14'; ctx.fill()
        ctx.strokeStyle = col; ctx.lineWidth = isH ? 2.5 : n.core ? 1.5 : 1; ctx.stroke()

        // Label
        const lines = n.label.split('\n')
        const fs = n.core ? 10 : n.r > 20 ? 7.5 : 6.5
        ctx.font = `${n.core?'600':'400'} ${fs}px "JetBrains Mono","Fira Code",monospace`
        ctx.fillStyle = dm ? '#666' : n.core ? '#e2e2ea' : '#a0a0b0'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        const lh = fs + 2, sy = n.y - ((lines.length-1)*lh)/2
        lines.forEach((ln,li) => ctx.fillText(ln, n.x, sy+li*lh))
        ctx.restore()
      })

      // Grain overlay
      ctx.globalAlpha = 0.015; ctx.fillStyle = '#fff'
      for (let i = 0; i < 300; i++) ctx.fillRect(Math.random()*W, Math.random()*H, 1, 1)
      ctx.globalAlpha = 1

      animRef.current = requestAnimationFrame(draw)
    }
    animRef.current = requestAnimationFrame(draw)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [dims])

  const handleMove = useCallback((e) => {
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r || !dataRef.current) return
    const mx = e.clientX - r.left, my = e.clientY - r.top
    let f = null
    for (const n of dataRef.current.nodes) {
      const dx = n.x-mx, dy = n.y-my
      if (dx*dx+dy*dy <= (n.r+4)*(n.r+4)) { f = n.id; break }
    }
    hoveredRef.current = f; setHovered(f)
    canvasRef.current.style.cursor = f && dataRef.current.nodes.find(n=>n.id===f)?.date ? 'pointer' : 'default'
  }, [])

  const handleClick = useCallback(() => {
    if (!hovered || !dataRef.current) return
    const n = dataRef.current.nodes.find(n => n.id === hovered)
    if (n?.date) navigate(`/post/${n.id}`)
  }, [hovered, navigate])

  const toggleCat = useCallback((c) => setCats(p => {
    const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n
  }), [])

  const hNode = hovered && dataRef.current?.nodes.find(n => n.id === hovered)
  const visCount = cats.size === 0 ? allNodes.length : allNodes.filter(n => !n.cat || cats.has(n.cat)).length

  return (
    <div className="explore-layout">
      <aside className={`explore-sidebar${collapsed ? ' collapsed' : ''}`}>
        {!collapsed && <>
          <button className="sidebar-back" onClick={() => navigate(-1)}>← back</button>
          <div className="sidebar-header">
            <h2>explore</h2>
            <p className="sidebar-subtitle">ideas, connections, and the spaces between</p>
          </div>
          <div className="sidebar-section">
            <div className="sidebar-label">filter by theme</div>
            <div className="category-list">
              {Object.entries(categories).map(([name, { count, color }]) => (
                <button key={name} className={`category-item${cats.has(name)?' active':''}`}
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
          {hNode && <div className="sidebar-info">
            <div className="sidebar-label">selected</div>
            <h3 className="info-title">{hNode.label.replace('\n',' ')}</h3>
            {hNode.date && <p className="info-date">{new Date(hNode.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</p>}
            {hNode.excerpt && <p className="info-excerpt">{hNode.excerpt}…</p>}
            {hNode.tags && <div className="info-tags">{hNode.tags.map(t => <span key={t} className="info-tag" style={{color:COLORS[t]}}>{t}</span>)}</div>}
          </div>}
        </>}
        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}
          title={collapsed?'Expand sidebar':'Collapse sidebar'}>{collapsed?'→':'←'}</button>
      </aside>
      <div className="explore-graph">
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }}
          onMouseMove={handleMove} onClick={handleClick} />
        <div className="explore-hint">hover nodes to explore · click posts to read</div>
      </div>
    </div>
  )
}
