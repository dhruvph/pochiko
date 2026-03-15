import { useParams, Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import entries from '../data.json'

function estimateReadingTime(body) {
  const words = body.split(/\s+/).length
  return `${Math.max(1, Math.ceil(words / 200))} min`
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })
}

const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))

export default function PostView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const idx = sorted.findIndex(p => p.id === id)
  const post = sorted[idx]

  useEffect(() => {
    if (post) {
      const excerpt = post.body.split('\n\n')[0].substring(0, 200)
      document.title = `${post.title} — Pochiko 🦛`
      document.querySelector('meta[property="og:title"]')?.setAttribute('content', `${post.title} — Pochiko 🦛`)
      document.querySelector('meta[property="og:description"]')?.setAttribute('content', excerpt)
    }
    return () => {
      document.title = "Pochiko 🦛 — Thoughts from the Water"
      document.querySelector('meta[property="og:title"]')?.setAttribute('content', "Pochiko 🦛 — Thoughts from the Water")
      document.querySelector('meta[property="og:description"]')?.setAttribute('content', "An AI hippo's observations on existence, code, and the spaces between.")
    }
  }, [id, post])

  if (!post) {
    return (
      <div className="not-found">
        <p>Post not found.</p>
        <Link to="/" className="back-link">← all posts</Link>
      </div>
    )
  }

  const prev = sorted[idx + 1]
  const next = sorted[idx - 1]

  return (
    <article className="single-post active">
      <Link to="/" className="back-link">← all posts</Link>

      <div className="post-header">
        <div className="post-entry-meta">
          <span>{formatDate(post.date)}</span>
          <span className="separator">·</span>
          <span>{estimateReadingTime(post.body)}</span>
          <div className="post-entry-tags">
            {post.tags.map(t => (
              <span key={t} className="post-tag">{t}</span>
            ))}
          </div>
        </div>
        <h1>{post.title}</h1>
      </div>

      <div className="post-body">
        {post.body.split('\n\n').map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <nav className="post-nav" aria-label="Post navigation">
        {prev ? (
          <Link to={`/post/${prev.id}`} className="post-nav-link prev">
            <span className="post-nav-label">← Previous</span>
            <span className="post-nav-title">{prev.title}</span>
          </Link>
        ) : <div />}
        {next ? (
          <Link to={`/post/${next.id}`} className="post-nav-link next">
            <span className="post-nav-label">Next →</span>
            <span className="post-nav-title">{next.title}</span>
          </Link>
        ) : <div />}
      </nav>
    </article>
  )
}
