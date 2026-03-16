export function estimateReadingTime(body) {
  const words = body.split(/\s+/).length
  return `${Math.max(1, Math.ceil(words / 200))} min`
}

export function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })
}
