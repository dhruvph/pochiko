import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import BlogList from './components/BlogList'
import PostView from './components/PostView'
import About from './components/About'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<BlogList />} />
        <Route path="/post/:id" element={<PostView />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Layout>
  )
}
