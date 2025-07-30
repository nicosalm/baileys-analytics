import { useAuth } from '@/contexts/auth'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useState } from 'react'

export const Dashboard = () => {
  const { state, logout } = useAuth()
  const navigate = useNavigate()
  const [connecting, setConnecting] = useState(false)

  if (state.status !== 'authenticated') return null

  const { user } = state

  const handleConnectOwnerRez = async () => {
    setConnecting(true)
    const result = await api.initiateOAuth()

    if (result.success) {
      window.location.href = result.data.authUrl
    } else {
      alert('Failed to start OwnerRez connection')
      setConnecting(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen">
      <nav className="p-4 border-b">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Baileys Analytics</h1>
          <div className="flex items-center space-x-4">
            <span>{user.email}</span>
            <button onClick={handleLogout} className="text-blue-600">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-4">
        {!user.hasOwnerRezConnection ? (
          <div className="mt-8 p-8 border rounded text-center">
            <h2 className="text-2xl font-bold mb-4">Connect Your OwnerRez Account</h2>
            <p className="text-gray-600 mb-6">
              To start generating tax reports, connect your OwnerRez account
            </p>
            <button
              onClick={handleConnectOwnerRez}
              disabled={connecting}
              className="px-6 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {connecting ? 'Connecting...' : 'Connect OwnerRez'}
            </button>
          </div>
        ) : (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <Link to="/dashboard/tax-report" className="p-6 border rounded hover:border-blue-600">
                <h3 className="text-xl font-bold mb-2">Tax Reports</h3>
                <p className="text-gray-600">
                  Generate and download tax reports by property and month
                </p>
              </Link>

              <Link to="/dashboard/settings" className="p-6 border rounded hover:border-blue-600">
                <h3 className="text-xl font-bold mb-2">Settings</h3>
                <p className="text-gray-600">
                  Manage your account and tax configurations
                </p>
              </Link>
            </div>

            <div className="mt-8 p-4 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">
                Connected to: {user.companyName || 'OwnerRez Account'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
