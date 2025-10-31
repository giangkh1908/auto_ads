import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App.jsx'
import './i18n.js'

createRoot(document.getElementById('root')).render(
  // Tạm thời tắt StrictMode để tránh toast hiển thị 2 lần trong development
  // <StrictMode>
    <App />
  // </StrictMode>,
)
