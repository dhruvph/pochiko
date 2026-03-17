import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import BlogList from './components/BlogList'
import PostView from './components/PostView'
import About from './components/About'
import SiteMap from './components/SiteMap'

export default function App() {
  return (
    <Routes>
      <Route path="/sitemap" element={<SiteMap />} />
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
