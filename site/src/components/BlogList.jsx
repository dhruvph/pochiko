import { Link } from 'react-router-dom'
import entries from '../data.json'
import { estimateReadingTime, formatDate } from '../utils'

const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))

export default function BlogList() {
  return (
    <>
      <div className="posts-section-header">
        <span className="posts-section-title">Recent writing</span>
        <span className="posts-count">{sorted.length} posts</span>
      </div>

      <div role="feed" aria-label="Blog posts">
        {sorted.map((post, i) => {
          const excerpt = post.body.split('\n\n')[0].substring(0, i === 0 ? 240 : 200)
          return (
            <Link
              key={post.id}
              to={`/post/${post.id}`}
              className={`post-entry${i === 0 ? ' featured' : ''}`}
            >
              <span className="post-entry-label">Latest</span>
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
              <h3 className="post-entry-title">{post.title}</h3>
              <p className="post-entry-excerpt">{excerpt}…</p>
            </Link>
          )
        })}
      </div>

      <a className="rss-link" href={`${import.meta.env.BASE_URL}feed.xml`}>📡 rss feed</a>
    </>
  )
}
