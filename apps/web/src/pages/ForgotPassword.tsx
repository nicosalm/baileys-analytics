import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Mail, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BRAND } from '@/constants'
import { LogoCube } from '@/components/LogoCube'

export const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })

      if (resetError) {
        if (resetError.message.includes('rate') || resetError.message.includes('limit')) {
          setError('Too many requests. Please try again in a few minutes.')
        } else {
          // always show success for security (don't reveal if email exists)
          setSuccess(true)
        }
        return
      }

      setSuccess(true)
    } catch (err) {
      setError('Failed to send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex">
        <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 py-8 lg:px-16 xl:px-24">
          <div className="max-w-md w-full mx-auto">
            <div className="bg-card rounded-xl shadow-sm border border-border p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-success-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-success" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Check Your Email</h2>
                <p className="text-muted-foreground mb-4">
                  We've sent a password reset link to
                </p>
                <p className="font-medium text-foreground mb-6">{email}</p>
                <p className="text-sm text-muted-foreground mb-6">
                  Click the link in the email to reset your password. If you don't see it, check your spam folder.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center text-sm text-primary hover:text-primary/90 font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to login
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex lg:w-1/2 bg-[oklch(0.25_0.06_265)] relative overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[oklch(0.35_0.10_275/0.3)] rounded-full filter blur-xl animate-blob" />
          <div className="absolute top-40 right-10 w-72 h-72 bg-[oklch(0.30_0.08_260/0.25)] rounded-full filter blur-xl animate-blob animation-delay-2000" />
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-[oklch(0.32_0.09_270/0.2)] rounded-full filter blur-xl animate-blob animation-delay-4000" />
          <div className="relative z-10 flex flex-col justify-center px-16 text-white">
            <h3 className="text-4xl font-bold mb-6">We've Got You</h3>
            <p className="text-lg text-white/80 mb-8">
              Check your inbox for a link to reset your password and get back to your data.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 py-8 lg:px-16 xl:px-24">
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
            <h2 className="text-3xl font-bold text-foreground mb-2">Reset your password</h2>
            <p className="text-muted-foreground">Enter your email and we'll send you a reset link.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11"
                  placeholder="name@example.com"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="bg-danger-subtle border border-danger/30 text-danger px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              loadingText="Sending..."
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Send reset link
            </Button>
          </form>

          {/* Sign in link */}
          <p className="mt-8 text-center text-muted-foreground">
            Remember your password?{' '}
            <Link to="/login" className="font-medium text-primary hover:text-primary/90">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-[oklch(0.25_0.06_265)] relative overflow-hidden">
        {/* Floating shapes */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-[oklch(0.35_0.10_275/0.3)] rounded-full filter blur-xl animate-blob" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-[oklch(0.30_0.08_260/0.25)] rounded-full filter blur-xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-[oklch(0.32_0.09_270/0.2)] rounded-full filter blur-xl animate-blob animation-delay-4000" />

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <h3 className="text-4xl font-bold mb-6">Account Recovery</h3>
          <p className="text-lg text-white/80 mb-8">
            Happens to the best of us. We'll have you back in no time.
          </p>

          {/* Info highlights */}
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="w-2 h-2 bg-white rounded-full mt-2 mr-3 flex-shrink-0" />
              <p className="text-white/80">Check your email for a secure reset link</p>
            </div>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-white rounded-full mt-2 mr-3 flex-shrink-0" />
              <p className="text-white/80">Link expires after 1 hour for security</p>
            </div>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-white rounded-full mt-2 mr-3 flex-shrink-0" />
              <p className="text-white/80">Your data stays safe and untouched</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
