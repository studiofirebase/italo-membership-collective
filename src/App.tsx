import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { Hero } from './components/Hero'
import { HomeCatalog } from './components/HomeCatalog'
import { Footer } from './components/Footer'
import { WhatsAppBubble } from './components/WhatsAppBubble'
import { useXMediaFeed } from './hooks/useXMediaFeed'

const Auth = lazy(() => import('./pages/Auth'))
const Members = lazy(() => import('./pages/Members'))
const Admin = lazy(() => import('./pages/Admin'))

function Landing() {
  const feed = useXMediaFeed()
  const media = feed.posts.flatMap((post) => post.media)
  const heroMedia = media.find((item) => item.type === 'video' || item.type === 'animated_gif') ?? media[0]

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ overflow: 'visible' }}>
      <main className="relative" role="main" style={{ overflow: 'visible' }}>
        <section id="hero" aria-label="Seção inicial">
          <Hero backgroundMedia={heroMedia} />
        </section>
        <HomeCatalog feed={feed} />
      </main>
      <Footer />
      <WhatsAppBubble />
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/entrar" element={<Auth />} />
          <Route path="/membros" element={<Members />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
