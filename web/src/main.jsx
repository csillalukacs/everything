import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import App from './App.jsx'
import ProfilePage from './screens/ProfilePage.jsx'
import CollagesPage from './screens/CollagesPage.jsx'
import StatsPage from './screens/StatsPage.jsx'
import SettingsPage from './screens/SettingsPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/u/:slug" element={<ProfilePage />} />
        <Route path="/u/:slug/collages" element={<CollagesPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
