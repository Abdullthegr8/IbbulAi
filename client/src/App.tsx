import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import DocumentsPage from './pages/DocumentsPage'
import AboutPage from './pages/AboutPage'
import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import StaffLoginPage from './pages/StaffLoginPage'
import StaffRegisterPage from './pages/StaffRegisterPage'
import AdminLoginPage from './pages/AdminLoginPage'

export default function App() {
  return (
    <Routes>
      {/* Full-page routes */}
      <Route path="/"               element={<LandingPage />} />
      <Route path="/login"          element={<LoginPage />} />
      <Route path="/register"       element={<RegisterPage />} />
      <Route path="/staff/login"    element={<StaffLoginPage />} />
      <Route path="/staff/register" element={<StaffRegisterPage />} />
      <Route path="/admin/login"    element={<AdminLoginPage />} />

      {/* App shell with sidebar */}
      <Route element={<Layout />}>
        <Route path="/home"      element={<HomePage />} />
        <Route path="/chat"      element={<ChatPage />} />
        <Route path="/chat/:conversationId" element={<ChatPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/about"     element={<AboutPage />} />
        <Route path="/admin"     element={<AdminPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
