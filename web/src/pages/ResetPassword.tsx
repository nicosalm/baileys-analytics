import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Lock, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordRequirements } from '@/components/PasswordRequirements'
import { BRAND } from '@/constants'
import { LogoCube } from '@/components/LogoCube'
import { validatePassword } from '@/utils/password'

export const ResetPassword = () => {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [checkingToken, setCheckingToken] = useState(true)

  // check if we have a valid recovery session
  useEffect(() => {
    const checkRecoverySession = async () => {
      try {
        // validate user via server-side check (getUser validates the JWT
        // against the Auth server, unlike getSession which only reads local storage)
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        // check if we're in password recovery mode
        // only trust recovery_sent_at - don't accept any authenticated session
        if (!userError && user) {
          const isRecoverySession = !!user.recovery_sent_at

          if (isRecoverySession) {
            setTokenValid(true)
          } else {
            // we have a session but it's not a recovery session
            setTokenValid(false)
            setError('This link is for password recovery only. Please use the link from your email.')
          }
        } else {
          // no valid user, the link may have expired or been invalid
          setTokenValid(false)
          setError('Invalid or expired reset link. Please request a new one.')
        }
      } catch {
        setTokenValid(false)
        setError('Invalid reset link')
      } finally {
        setCheckingToken(false)
      }
    }

    checkRecoverySession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // client-side validation
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    const validation = validatePassword(password)
    if (!validation.isValid) {
      setError(validation.errors[0])
      return
    }

    // show warnings but don't block submission
    if (validation.warnings.length > 0) {
      console.warn('Password warnings:', validation.warnings)
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        // handle specific error cases
        if (updateError.message.includes('expired')) {
          setError('Your reset link has expired. Please request a new one.')
          setTimeout(() => navigate('/forgot-password'), 3000)
        } else {
          setError(updateError.message)
        }
        return
      }

      setSuccess(true)

      // sign out to ensure clean state
      await supabase.auth.signOut()

      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError('Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex">
        <div className="w-full flex flex-col justify-center px-8 py-8 lg:px-16 xl:px-24">
          <div className="max-w-md w-full mx-auto">
            <div className="bg-card rounded-xl shadow-sm border border-border p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-success-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-success" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Password Reset Successfully</h2>
                <p className="text-muted-foreground">Redirecting to login...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // show loading state while checking token
  if (checkingToken) {
    return (
      <div className="min-h-screen bg-background flex">
        <div className="w-full flex flex-col justify-center px-8 py-8 lg:px-16 xl:px-24">
          <div className="max-w-md w-full mx-auto">
            <div className="bg-card rounded-xl shadow-sm border p-8">
              <div className="flex flex-col items-center text-center">
                <LogoCube className="w-10 h-10 mb-4" />
                <Button loading loadingText="Verifying reset link..." variant="ghost" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // show error if token is invalid
  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-background flex">
        <div className="w-full flex flex-col justify-center px-8 py-8 lg:px-16 xl:px-24">
          <div className="max-w-md w-full mx-auto">
            <div className="bg-card rounded-xl shadow-sm border p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-danger-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-danger" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Invalid Reset Link</h2>
                <p className="text-muted-foreground mb-6">{error}</p>
                <Button asChild>
                  <Link to="/forgot-password">Request New Link</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="w-full flex flex-col justify-center px-8 py-8 lg:px-16 xl:px-24">
        <div className="max-w-md w-full mx-auto">
          {/* Back to login link */}
          <Link to="/login" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-all mb-8">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to login
          </Link>

          {/* Logo */}
          <div className="flex items-center mb-8">
            <LogoCube />
            <h1 className="text-xl font-semibold text-foreground ml-3">{BRAND.name}</h1>
          </div>

          {/* Welcome text */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">Create new password</h2>
            <p className="text-muted-foreground">Choose a strong password to secure your account.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-12 h-11"
                  placeholder="New password"
                  required
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {password && (
                <div className="mt-3 p-3 bg-muted/40 rounded-lg border border-border">
                  <PasswordRequirements password={password} />
                </div>
              )}
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-12 h-11"
                  placeholder="Confirm new password"
                  required
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {error && <div className="bg-danger-subtle border border-danger/30 text-danger px-4 py-3 rounded-lg text-sm">{error}</div>}

            <Button
              type="submit"
              loading={loading}
              loadingText="Resetting..."
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Reset password
            </Button>
          </form>
        </div>
      </div>

      {/* Right side - Decorative */}
    </div>
  )
}
