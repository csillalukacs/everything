import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import App from './App.jsx'
import ProfilePage from './screens/ProfilePage.jsx'
import StatsPage from './screens/StatsPage.jsx'
import SettingsPage from './screens/SettingsPage.jsx'
import NotificationsPage from './screens/NotificationsPage.jsx'
import FavoritesPage from './screens/FavoritesPage.jsx'
import GraveyardPage from './screens/GraveyardPage.jsx'
import AuthErrorScreen from './screens/AuthErrorScreen.jsx'
import TermsPage from './screens/TermsPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/u/:slug" element={<ProfilePage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/graveyard" element={<GraveyardPage />} />
        <Route path="/login-error" element={<AuthErrorScreen />} />
        <Route path="/terms" element={<TermsPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
