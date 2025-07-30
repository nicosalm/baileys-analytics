import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'

export const Settings = () => {
  const { state } = useAuth()

  if (state.status !== 'authenticated') return null

  const { user } = state

  return (
    <div className="min-h-screen">
      <nav className="p-4 border-b">
        <div className="max-w-6xl mx-auto">
          <Link to="/dashboard" className="text-blue-600">← Back to Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        <div className="space-y-6">
          <div className="p-4 border rounded">
            <h2 className="text-xl font-bold mb-4">Account Information</h2>
            <div className="space-y-2">
              <div>
                <span className="text-gray-600">Email:</span> {user.email}
              </div>
              <div>
                <span className="text-gray-600">Account Created:</span> {new Date(user.createdAt).toLocaleDateString()}
              </div>
              {user.companyName && (
                <div>
                  <span className="text-gray-600">Company:</span> {user.companyName}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border rounded">
            <h2 className="text-xl font-bold mb-4">OwnerRez Connection</h2>
            {user.hasOwnerRezConnection ? (
              <p className="text-green-600">Connected</p>
            ) : (
              <p className="text-gray-600">Not connected</p>
            )}
          </div>

          <div className="p-4 border rounded">
            <h2 className="text-xl font-bold mb-4">Tax Configuration</h2>
            <p className="text-gray-600">
              Custom tax rates coming soon. Currently using rates from OwnerRez.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
