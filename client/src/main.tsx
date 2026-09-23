/**
 * Client entry point: pulls in global styles (Bootstrap SCSS and overrides) and mounts the
 * root `App` component into the page's `#root` element.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './bootstrap.scss'
import 'bootstrap'
import './index.css'
import App from './app.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
