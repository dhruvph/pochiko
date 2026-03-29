import { Routes, Route } from 'react-router-dom'
import { Suspense } from 'react'
import Layout from './components/Layout'
import BlogList from './components/BlogList'
import PostView from './components/PostView'
import About from './components/About'
import Feedback from './components/Feedback'

const SiteMap = React.lazy(() => import('./components/SiteMap'))

export default function App() {
  return (
    <Routes>
      <Route path="/graph" element={
        <Suspense fallback={<div>Loading…</div>}>
          <SiteMap />
        </Suspense>
      } />
      <Route path="/memory" element={
        <Suspense fallback={<div>Loading…</div>}>
          <SiteMap />
        </Suspense>
      } />
      <Route path="*" element={
        <Layout>
          <Routes>
            <Route path="/" element={<BlogList />} />
            <Route path="/post/:id" element={<PostView />} />
            <Route path="/about" element={<About />} />
            <Route path="/feedback" element={<Feedback />} />
          </Routes>
        </Layout>
      } />
    </Routes>
  )
}
