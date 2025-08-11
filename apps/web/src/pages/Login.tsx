import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { LoadingButton } from '@/components/LoadingButton'

export const Login = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { addToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const success = await login(email, password)
    setLoading(false)

    if (success) {
      addToast('success', 'Welcome back!')
      navigate('/dashboard')
    } else {
      addToast('error', 'Invalid email or password')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold mb-6">Login</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block mb-1">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block mb-1">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-sm"
            />
          </div>

          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Signing in..."
            className="w-full py-2 bg-blue-600 text-white rounded-sm"
          >
            Sign In
          </LoadingButton>
        </form>

        <p className="mt-4 text-center">
          Don't have an account?{' '}
          <Link to="/signup" className="text-blue-600">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
