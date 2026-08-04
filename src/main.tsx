import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { supabaseConfigured } from '@/lib/supabase'
import App from '@/App'
import '@/styles/index.css'

const root = document.getElementById('root')!

if (!supabaseConfigured) {
  root.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:2rem;font-family:system-ui,sans-serif;background:#f7f7f2;color:#1d1d1b">
      <div style="max-width:420px;padding:1.5rem;border:1px solid #e4e4de;border-radius:12px;background:#fff">
        <h1 style="margin:0 0 .5rem;font-size:1.15rem">Fincomer — configuración incompleta</h1>
        <p style="margin:0 0 .75rem;line-height:1.45;color:#555;font-size:.9rem">
          Faltan las variables de entorno de Supabase en el build de Vercel.
          Sin ellas la app no puede autenticar ni cargar datos.
        </p>
        <ol style="margin:0;padding-left:1.1rem;color:#333;font-size:.85rem;line-height:1.5">
          <li>Vercel → Project → Settings → Environment Variables</li>
          <li>Agrega <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code></li>
          <li>Redeploy (Build) el proyecto</li>
        </ol>
      </div>
    </div>
  `
} else {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}
