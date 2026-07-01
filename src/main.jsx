import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import SpendSight from './SpendSight.jsx'
import { Analytics } from "@vercel/analytics/react"

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SpendSight />
  </StrictMode>
)