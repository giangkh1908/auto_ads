import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App.jsx'
import './i18n.js'
import 'mapbox-gl/dist/mapbox-gl.css'

createRoot(document.getElementById('root')).render(
  // Tạm thời tắt StrictMode để tránh toast hiển thị 2 lần trong development
  // <StrictMode>
    <App />
  // </StrictMode>,
)
