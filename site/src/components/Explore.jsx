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

// ── Stopwords to filter out when extracting topics ──
const STOPWORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall','can',
  'to','of','in','for','on','with','at','by','from','as','into','through','during',
  'before','after','above','below','between','out','off','over','under','again',
  'further','then','once','here','there','when','where','why','how','all','both',
  'each','few','more','most','other','some','such','no','nor','not','only','own',
  'same','so','than','too','very','just','because','but','and','or','if','while',
  'about','up','that','this','these','those','it','its','i','me','my','we','our',
  'you','your','he','him','his','she','her','they','them','their','what','which',
  'who','whom','thing','things','way','time','got','get','go','going','went','like',
  'know','think','make','made','said','say','one','two','also','back','don','now',
  'new','even','want','look','right','see','come','day','still','find','give',
  'take','tell','many','some','well','every','much','really','something','nothing',
  'anything','everything','someone','actually','been','done','let','put','set',
  'trying','try','got','getting','lot','kind','around','us','them','am','last',
  'today','first','another','said','says','called','need','sure','keep','start',
  'told','felt','long','run','runs','running','turn','next','help','working',
  'thought','away','show','big','old','three','world','never','always','yet',
  'since','little','end','used','enough','after','again','part','every','already',
  'different','course','important','probably','different','top','until','able',
  'small','several','along','might','possible','sometimes','point','left','start',
  'sort','half','bad','hear','rather','true','felt','place','hear','started','felt',
  'run','keep','left','asked','times','called','seem','open','become','hard',
  'full','believe','remember','days','moment','together','power','system','systems',
  'writing','write','writes','wrote','code','text','data','file','files','post',
  'posts','site','website','blog','page','pages','read','reading','check','checks',
  'happen','happened','night','morning','interesting','literally','instead','whether',
  'whole','across','best','sure','soon','set','seems','says','having','although',
  'true','less','though','words','name','word','started','didn','doesn','isn',
  'wasn','aren','won','couldn','wouldn','shouldn','same','bit','person','part',
  'probably','after','please','else','done','using','without','anyone','ones',
  'doing','away','went','come','came','mean','probably','certainly','perhaps',
  'ones','mine','nice','later','talk','rest','own','care','hand','eyes','kind',
  'idea','sorry','maybe','understand','sorry','nobody','things','fine','currently',
  'each','anywhere','above','below','ok','okay','hello','hey','thanks','sorry',
  'let','being','entire','use','working','useful','clear','looked','looking',
  'able','able','must','often','simply','quite','building','built','build',
  'really','pretty','cool','also','then','just','like','want','good','better',
  'right','actually','basically','literally','kind','fact','case','under',
  'put','try','thing','sure','sure','down','top','behind','front','past',
  'ago','year','years','hours','second','seconds','minute','minutes','hour',
  'today','yesterday','tomorrow','monday','tuesday','wednesday','thursday',
  'friday','saturday','sunday','month','week','weeks','work','works','working',
  'need','needs','needed','see','look','looks','make','makes','go','going',
  'went','let','run','end','stay','stays','get','gets','play','think','keep',
  'put','found','left','let','went','tell','told','come','came','give','take',
  'read','write','learn','help','start','started','start','got','gets','said',
  'look','found','try','find','use','show','said','set','made','makes','still',
  'turn','open','ask','close','hold','stop','live','start','change','pay','hear',
  'fall','start','learn','watch','call','follow','bring','bring','walk','watch',
  'stop','read','sit','give','understand','say','turn','run','show','seem',
  'become','leave','move','live','believe','hold','bring','happen','write',
  'provide','sit','stand','lose','pay','meet','include','continue','set','learn',
  'change','lead','understand','watch','follow','stop','create','speak','read',
  'allow','add','spend','grow','open','walk','win','offer','remember','love',
  'consider','appear','buy','wait','serve','die','send','expect','build','stay',
  'fall','cut','reach','kill','remain','suggest','raise','pass','sell','require',
  'report','decide','pull','develop','agree','support','hit','pick','carry',
  'wear','receive','apply','break','explain','cover','lay','test','deal',
  'push','accept','achieve','argue','control','drive','examine','exist',
  'manage','protect','seek','treat','wonder','assume','choose','enjoy',
  'fail','focus','perform','plan','realize','reflect','refuse','repeat',
  'survive','attend','avoid','belong','catch','complete','dance','deny',
  'doubt','earn','enable','engage','escape','establish','extend','figure',
  'fly','guarantee','handle','hide','imagine','improve','insist','invite',
  'jump','justify','kick','launch','lift','limit','maintain','mix','note',
  'observe','occur','operate','organize','ought','owe','pause','play',
  'possess','prefer','prepare','prevent','produce','promise','prove',
  'react','recognize','recommend','relate','release','rely','remove',
  'replace','represent','resist','respond','restore','restrict','review',
  'shift','sign','slip','solve','specify','spread','stretch','strike',
  'submit','suffer','suppose','surprise','surround','suspect','tend',
  'throw','touch','train','travel','treat','trust','try','unite',
  'vary','vote','wake','warn','waste','whisper','wish','worry',
  'write','yell','enough','much','more','most','less','least',
  'every','none','any','either','neither','both','all','each',
  'many','few','several','other','another','such','what','which',
  'whose','who','whom','this','that','these','those','here','there',
  'where','when','how','why','whether','whatever','whichever','whoever',
  'whomever','whenever','wherever','however','somewhere','nowhere',
  'anywhere','everywhere','sometimes','sometime','somehow','always',
  'never','often','once','twice','thrice','seldom','rarely','usually',
  'generally','normally','typically','commonly','regularly','frequently',
  'occasionally','periodically','infrequently','ever','forever',
])

// Minimum word length and frequency threshold for topic extraction
const MIN_WORD_LEN = 4
const MIN_TOPIC_FREQ = 2

/**
 * Extract significant topic words from post bodies.
 * Returns a Map<word, [postId, ...]> for words appearing in multiple posts.
 */
function extractTopics(posts) {
  // Count word occurrences per post and globally
  const wordPosts = new Map() // word -> Set of postIds
  const wordCounts = new Map() // word -> total count across all posts

  for (const post of posts) {
    const words = new Set()
    // Normalize: lowercase, strip punctuation, split
    const clean = post.body.toLowerCase().replace(/[^a-z\s'-]/g, ' ')
    for (const w of clean.split(/\s+/)) {
      const word = w.replace(/^['-]+|['-]+$/g, '')
      if (word.length < MIN_WORD_LEN) continue
      if (STOPWORDS.has(word)) continue
      words.add(word)
    }
    for (const w of words) {
      if (!wordPosts.has(w)) wordPosts.set(w, new Set())
      wordPosts.get(w).add(post.id)
      wordCounts.set(w, (wordCounts.get(w) || 0) + 1)
    }
  }

  // Keep words that appear in at least MIN_TOPIC_FREQ posts
  const bridgeTopics = new Map()
  for (const [word, postSet] of wordPosts) {
    if (postSet.size >= MIN_TOPIC_FREQ) {
      bridgeTopics.set(word, [...postSet])
    }
  }

  return bridgeTopics
}

/**
 * Build auto-generated edges from shared tags between posts.
 * Returns array of { source, target, type: 'tag-shared' }
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
          edges.push({ source: a.id, target: b.id, type: 'tag-shared', strength: shared.length })
        }
      }
    }
  }
  return edges
}

/**
 * Build temporal edges connecting consecutive posts by date.
 * Returns array of { source, target, type: 'temporal' }
 */
function buildTemporalEdges(posts) {
  const sorted = [...posts].sort((a, b) => a.date.localeCompare(b.date))
  const edges = []
  for (let i = 0; i < sorted.length - 1; i++) {
    edges.push({ source: sorted[i].id, target: sorted[i + 1].id, type: 'temporal' })
  }
  return edges
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

  // ── Extract bridge topic nodes from post content ──
  const bridgeTopics = extractTopics(entries)
  const bridgeNodes = []
  const bridgeEdges = []
  let bridgeIdx = 0

  for (const [topic, postIds] of bridgeTopics) {
    // Position bridge nodes near the centroid of connected posts
    const bid = `topic:${topic}`
    const angle = (bridgeIdx / bridgeTopics.size) * Math.PI * 2 + Math.PI / 3
    const dist = 180 + (bridgeIdx % 3) * 40
    bridgeNodes.push({
      id: bid,
      label: topic.toUpperCase(),
      r: 8 + Math.min(postIds.length * 3, 10),
      cat: 'topic',
      x: 400 + Math.cos(angle) * dist,
      y: 350 + Math.sin(angle) * dist,
    })
    for (const pid of postIds) {
      bridgeEdges.push({ source: bid, target: pid, type: 'topic' })
    }
    bridgeIdx++
  }

  const nodes = [...cores, ...posts, ...bridgeNodes, ...extras]

  // ── Manual edges (core/concept connections) ──
  const manualLinks = EDGES.map(([s, t]) => ({ source: s, target: t, type: 'manual' }))
    .filter(l => nodes.some(n => n.id === l.source) && nodes.some(n => n.id === l.target))

  // ── Auto-generated tag-shared edges ──
  const tagEdges = buildSharedTagEdges(entries)
    .filter(l => nodes.some(n => n.id === l.source) && nodes.some(n => n.id === l.target))

  // ── Temporal edges ──
  const temporalEdges = buildTemporalEdges(entries)
    .filter(l => nodes.some(n => n.id === l.source) && nodes.some(n => n.id === l.target))

  // ── Bridge topic edges ──
  const topicLinks = bridgeEdges
    .filter(l => nodes.some(n => n.id === l.source) && nodes.some(n => n.id === l.target))

  // Combine all links
  const links = [...manualLinks, ...tagEdges, ...temporalEdges, ...topicLinks]

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
  if (n.id?.startsWith('topic:')) return '#f59e0b'
  return COLORS[n.cat] || th.textSec
}

function getThemeColors() {
  const s = getComputedStyle(document.documentElement)
  const bgElevated = s.getPropertyValue('--bg-elevated').trim() || '#111116'
  const bg = s.getPropertyValue('--bg').trim() || '#0a0a0c'
  const text = s.getPropertyValue('--text').trim() || '#e2e2ea'
  const textSec = s.getPropertyValue('--text-secondary').trim() || '#8888a0'
  const border = s.getPropertyValue('--border').trim() || '#1c1c26'
  const accent = s.getPropertyValue('--accent').trim() || '#7b9bff'
  const tmp = document.createElement('canvas').getContext('2d')
  tmp.fillStyle = border
  const bc = tmp.fillStyle
  const br = parseInt(bc.slice(1, 3), 16), bg2 = parseInt(bc.slice(3, 5), 16), bb = parseInt(bc.slice(5, 7), 16)
  return { bgElevated, bg, text, textSec, border, accent, br, bg2, bb }
}

export default function Explore() {
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
  const [collapsed, setCollapsed] = useState(false)
  const [cats, setCats] = useState(new Set())
  const [dims, setDims] = useState({ w: 800, h: 600 })

  const { nodes: allNodes, links: allLinks } = useMemo(buildNodes, [])

  const categories = useMemo(() => {
    const c = {}
    entries.forEach(p => p.tags.forEach(t => {
      if (!c[t]) c[t] = { count: 0, color: COLORS[t] || '#666' }
      c[t].count++
    }))
    return c
  }, [])

  // Responsive sizing
  useEffect(() => {
    const upd = () => {
      const el = canvasRef.current?.parentElement
      if (el) setDims({ w: el.clientWidth, h: el.clientHeight })
    }
    upd()
    window.addEventListener('resize', upd)
    return () => window.removeEventListener('resize', upd)
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
        return (sc || tc) ? 160 : 100
      }).strength(0.3))
      .force('collide', forceCollide().radius(d => d.r + 6).strength(0.7))
      .force('boundary', forceBoundary(W, H, 40))
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

    function draw() {
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
      const interacting = dragRef.current || hId

      if (!simActive && !interacting && hId === prevHId && alpha === prevAlpha) {
        animRef.current = requestAnimationFrame(draw)
        return
      }
      prevHId = hId
      prevAlpha = alpha

      const conn = new Set()
      if (hId) {
        conn.add(hId)
        links.forEach(l => {
          const s = l.source.id || l.source, t = l.target.id || l.target
          if (s === hId) conn.add(t); if (t === hId) conn.add(s)
        })
      }

      ctx.clearRect(0, 0, W, H)
      const th = themeRef.current

      // Edges — styled by type
      links.forEach(l => {
        const s = l.source, t = l.target
        if (s.x == null || t.x == null) return
        if (isFiltering) {
          const sVis = !s.cat || activeCats.has(s.cat) || s.core || s.id?.startsWith('topic:')
          const tVis = !t.cat || activeCats.has(t.cat) || t.core || t.id?.startsWith('topic:')
          if (!sVis && !tVis) return
        }
        const hi = hId && (s.id === hId || t.id === hId)
        const dm = hId && !hi
        const edgeType = l.type || 'manual'

        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.quadraticCurveTo(
          (s.x + t.x) / 2 - (t.y - s.y) * 0.08,
          (s.y + t.y) / 2 + (t.x - s.x) * 0.08,
          t.x, t.y
        )

        if (edgeType === 'temporal') {
          // Dotted, very subtle temporal links
          ctx.setLineDash([3, 6])
          ctx.strokeStyle = hi ? th.accent : `rgba(${th.br},${th.bg2},${th.bb},0.2)`
          ctx.globalAlpha = dm ? 0.03 : hi ? 0.6 : Math.max(0.08, 0.2 * alpha)
          ctx.lineWidth = 0.5
        } else if (edgeType === 'tag-shared') {
          // Thinner, different opacity for shared-tag links
          ctx.setLineDash([])
          ctx.strokeStyle = hi ? th.accent : `rgba(${th.br},${th.bg2},${th.bb},0.3)`
          ctx.globalAlpha = dm ? 0.04 : hi ? 0.7 : Math.max(0.1, 0.3 * alpha)
          ctx.lineWidth = hi ? 1.2 : 0.6
        } else if (edgeType === 'topic') {
          // Bridge topic links — amber-tinted, medium weight
          ctx.setLineDash([])
          ctx.strokeStyle = hi ? th.accent : 'rgba(245,156,11,0.35)'
          ctx.globalAlpha = dm ? 0.04 : hi ? 0.7 : Math.max(0.1, 0.35 * alpha)
          ctx.lineWidth = hi ? 1.2 : 0.6
        } else {
          // Manual/core links — strong, solid
          ctx.setLineDash([])
          ctx.strokeStyle = hi ? th.accent : `rgba(${th.br},${th.bg2},${th.bb},0.35)`
          ctx.globalAlpha = dm ? 0.05 : hi ? 0.8 : Math.max(0.15, 0.4 * alpha)
          ctx.lineWidth = hi ? 1.5 : 0.75
        }

        ctx.stroke()
        ctx.setLineDash([]) // reset
      })

      // Nodes
      ctx.globalAlpha = 1
      const draggedId = dragRef.current?.nodeId
      nodes.forEach(n => {
        if (n.x == null) return
        if (isFiltering && n.cat && !activeCats.has(n.cat) && !n.core && !n.id?.startsWith('topic:')) return
        const isH = hId === n.id
        const isD = draggedId === n.id
        const isC = hId ? conn.has(n.id) : true
        const dm = hId && !isC
        const col = nColor(n, th)
        ctx.save(); ctx.globalAlpha = dm ? 0.12 : 1

        // Core glow
        if (n.core) {
          const g = ctx.createRadialGradient(n.x, n.y, n.r * 0.8, n.x, n.y, n.r + 20)
          g.addColorStop(0, col + '15'); g.addColorStop(1, 'transparent')
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 20, 0, Math.PI * 2); ctx.fill()
        }

        // Drag glow — bright colored ring
        if (isD) {
          const dg = ctx.createRadialGradient(n.x, n.y, n.r, n.x, n.y, n.r + 18)
          dg.addColorStop(0, col + '40'); dg.addColorStop(1, 'transparent')
          ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 18, 0, Math.PI * 2); ctx.fill()
        }

        // Circle — scale-up when dragged
        const r = isD ? n.r + 5 : isH ? n.r + 3 : n.r
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fillStyle = n.core ? th.bgElevated : th.bg; ctx.fill()
        ctx.strokeStyle = col; ctx.lineWidth = isD ? 3 : isH ? 2.5 : n.core ? 1.5 : 1; ctx.stroke()

        // Label
        const lines = n.label.split('\n')
        const fs = n.core ? 10 : n.r > 20 ? 7.5 : 6.5
        ctx.font = `${n.core ? '600' : '400'} ${fs}px "JetBrains Mono","Fira Code",monospace`
        ctx.fillStyle = dm ? th.textSec : n.core ? th.text : th.textSec
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        const lh = fs + 2, sy = n.y - ((lines.length - 1) * lh) / 2
        lines.forEach((ln, li) => ctx.fillText(ln, n.x, sy + li * lh))
        ctx.restore()
      })

      // Grain overlay
      const gc = grainCanvasRef.current
      if (gc) {
        ctx.globalAlpha = 0.02
        const pat = ctx.createPattern(gc, 'repeat')
        ctx.fillStyle = pat
        ctx.fillRect(0, 0, W, H)
      }
      ctx.globalAlpha = 1

      animRef.current = requestAnimationFrame(draw)
    }
    animRef.current = requestAnimationFrame(draw)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [dims])

  const hitTest = useCallback((mx, my) => {
    if (!dataRef.current) return null
    for (const n of dataRef.current.nodes) {
      const dx = n.x - mx, dy = n.y - my
      if (dx * dx + dy * dy <= (n.r + 4) * (n.r + 4)) return n
    }
    return null
  }, [])

  // ── Drag helpers ──────────────────────────────────────────────
  const pendingDragRef = useRef(null)   // { nodeId, startX, startY, offsetX, offsetY }
  const velocityRef = useRef({ vx: 0, vy: 0, lastX: 0, lastY: 0, lastT: 0 })
  const DRAG_THRESHOLD = 4 // px before committing to drag

  // Get client coords from mouse or touch event
  const clientXY = useCallback((e) => {
    if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    return { x: e.clientX, y: e.clientY }
  }, [])

  // Commit a pending drag (called once threshold is crossed)
  const commitDrag = useCallback((pend) => {
    const n = dataRef.current?.nodes.find(n => n.id === pend.nodeId)
    if (!n) return
    n.fx = n.x; n.fy = n.y
    velocityRef.current = { vx: 0, vy: 0, lastX: n.x, lastY: n.y, lastT: performance.now() }
    dragRef.current = { nodeId: n.id, offsetX: pend.offsetX, offsetY: pend.offsetY }
    pendingDragRef.current = null
    simRef.current?.alpha(0.6).restart()
  }, [])

  // End drag — release node with momentum
  const endDrag = useCallback(() => {
    if (!dragRef.current && !pendingDragRef.current) return
    const nodeId = dragRef.current?.nodeId
    pendingDragRef.current = null
    dragRef.current = null
    document.removeEventListener('mousemove', docMouseMove)
    document.removeEventListener('mouseup', endDrag)
    document.removeEventListener('touchmove', docTouchMove)
    document.removeEventListener('touchend', endDrag)
    if (!nodeId || !dataRef.current) return
    const n = dataRef.current.nodes.find(n => n.id === nodeId)
    if (n && !CORE_IDS.has(n.id)) {
      const vel = velocityRef.current
      n.vx = vel.vx; n.vy = vel.vy
      n.fx = null; n.fy = null
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Document-level mouse move (captures drag outside canvas)
  const docMouseMove = useCallback((e) => {
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r || !dataRef.current) return
    const mx = e.clientX - r.left, my = e.clientY - r.top

    // Check pending drag threshold
    if (pendingDragRef.current) {
      const pend = pendingDragRef.current
      const dx = mx - pend.startX, dy = my - pend.startY
      if (dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
        commitDrag(pend)
      } else {
        return
      }
    }

    if (!dragRef.current) return
    const n = dataRef.current.nodes.find(n => n.id === dragRef.current.nodeId)
    if (!n) return

    const newFx = mx - dragRef.current.offsetX
    const newFy = my - dragRef.current.offsetY

    // Track velocity
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
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
  }, [commitDrag])

  // Document-level touch move
  const docTouchMove = useCallback((e) => {
    e.preventDefault()
    docMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY })
  }, [docMouseMove])

  // Canvas mouse handlers
  const handleMouseDown = useCallback((e) => {
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

  // Canvas touch handlers
  const handleTouchStart = useCallback((e) => {
    e.preventDefault()
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r || !dataRef.current) return
    const mx = e.touches[0].clientX - r.left, my = e.touches[0].clientY - r.top
    const n = hitTest(mx, my)
    if (n && !n.core) {
      pendingDragRef.current = {
        nodeId: n.id, startX: mx, startY: my,
        offsetX: mx - n.x, offsetY: my - n.y,
      }
      document.addEventListener('touchmove', docTouchMove, { passive: false })
      document.addEventListener('touchend', endDrag)
    }
  }, [hitTest, docTouchMove, endDrag])

  // Hover / cursor (mouse only — no drag interference)
  const handleMove = useCallback((e) => {
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r || !dataRef.current) return
    if (dragRef.current) return // docMouseMove handles drag
    const mx = e.clientX - r.left, my = e.clientY - r.top
    const f = hitTest(mx, my)
    hoveredRef.current = f?.id || null; setHovered(f?.id || null)
    canvasRef.current.style.cursor = f?.date ? 'pointer' : 'default'
  }, [hitTest])

  const handleMouseLeave = useCallback(() => {
    // Don't end drag on leave — document listeners handle that
    if (!dragRef.current) {
      hoveredRef.current = null; setHovered(null)
      if (canvasRef.current) canvasRef.current.style.cursor = 'default'
    }
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
  const visCount = cats.size === 0 ? allNodes.length : allNodes.filter(n => !n.cat || cats.has(n.cat) || n.core || n.id?.startsWith('topic:')).length

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
      <div className="explore-graph">
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
          onMouseDown={handleMouseDown} onMouseMove={handleMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onTouchStart={handleTouchStart} />
        <div className="explore-hint">hover nodes to explore · click posts to read</div>
      </div>
    </div>
  )
}
