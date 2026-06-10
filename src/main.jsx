import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import SpendSight from './SpendSight.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SpendSight />
  </StrictMode>
)