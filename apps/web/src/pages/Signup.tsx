import '@/styles/newsreader.css'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { PasswordRequirements } from '@/components/PasswordRequirements'
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { BRAND } from '@/constants'
import { LogoCube } from '@/components/LogoCube'
import { validatePassword } from '@/utils/password'
import { usePageTitle } from '@/hooks/use-page-title'

export const Signup = () => {
  usePageTitle('Sign Up')
  const { signup, signInWithGoogle, signInWithMicrosoft } = useAuth()
  const { addToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [microsoftLoading, setMicrosoftLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)

  // Reset OAuth loading states when page is restored from bfcache (user hit back)
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setGoogleLoading(false)
        setMicrosoftLoading(false)
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      addToast('error', 'Passwords do not match')
      return
    }

    const validation = validatePassword(password)
    if (!validation.isValid) {
      addToast('error', validation.errors[0])
      return
    }

    setLoading(true)
    const result = await signup(email, password)
    setLoading(false)

    if (result.success) {
      // Show confirmation message instead of auto-navigating since email confirmation is required
      setSignupSuccess(true)
    } else {
      addToast('error', result.error || 'Failed to create account')
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    const success = await signInWithGoogle()
    if (!success) {
      setGoogleLoading(false)
      addToast('error', 'Failed to initiate Google sign-up. Please try again.')
    }
  }

  const handleMicrosoftSignIn = async () => {
    setMicrosoftLoading(true)
    const success = await signInWithMicrosoft()
    if (!success) {
      setMicrosoftLoading(false)
      addToast('error', 'Failed to initiate Microsoft sign-up. Please try again.')
    }
  }

  // Show success message if signup was successful
  if (signupSuccess) {
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
                <p className="text-muted-foreground mb-4">We've sent a confirmation link to:</p>
                <p className="font-medium text-foreground mb-6">{email}</p>
                <p className="text-sm text-muted-foreground mb-6">Click the confirmation link to activate your account.</p>
                <p className="text-sm text-muted-foreground mb-6">
                  Didn't receive the email? Check your spam folder or wait a few minutes.
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

        {/* Right side - Decorative */}
        <div className="hidden lg:flex lg:w-1/2 bg-[oklch(0.25_0.06_265)] relative overflow-hidden landing-noise-bg">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[oklch(0.35_0.10_275/0.3)] rounded-full filter blur-xl animate-blob" />
          <div className="absolute top-40 right-10 w-72 h-72 bg-[oklch(0.30_0.08_260/0.25)] rounded-full filter blur-xl animate-blob animation-delay-2000" />
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-[oklch(0.32_0.09_270/0.2)] rounded-full filter blur-xl animate-blob animation-delay-4000" />

          <div className="relative z-10 flex flex-col justify-center px-16 text-white">
            <h3 className="landing-serif text-4xl font-semibold mb-6">Almost There!</h3>
            <p className="text-lg text-white/80">Confirm your email to unlock your dashboard. It only takes a second.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Signup Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 py-8 lg:px-16 xl:px-24">
        <div className="max-w-md w-full mx-auto">
          {/* Back to home link */}
          <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-all mb-8">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to home
          </Link>

          {/* Logo */}
          <div className="flex items-center mb-8">
            <LogoCube />
            <h1 className="text-xl font-semibold text-foreground ml-3">{BRAND.name}</h1>
          </div>

          {/* Welcome text */}
          <div className="mb-8">
            <h2 className="landing-serif text-3xl font-semibold text-foreground mb-2">Create your account</h2>
            <p className="text-muted-foreground">Get started with Baileys Analytics.</p>
          </div>

          {/* Signup form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-11"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-12 h-11"
                  placeholder="Password"
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
                  required
                  className="pl-10 pr-12 h-11"
                  placeholder="Confirm password"
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

            <p className="text-sm text-muted-foreground text-center">
              By clicking to continue, you agree to our{' '}
              <Link to="/terms" className="text-primary hover:text-primary/90">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-primary hover:text-primary/90">
                Privacy Policy
              </Link>
            </p>

            <Button
              type="submit"
              loading={loading}
              loadingText="Creating account..."
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium cursor-pointer hover:opacity-90 transition-opacity"
            >
              Create Account
            </Button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted-foreground">OR CONTINUE WITH</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleGoogleSignIn} loading={googleLoading} className="flex-1 h-11">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </Button>

              <Button type="button" variant="outline" onClick={handleMicrosoftSignIn} loading={microsoftLoading} className="flex-1 h-11">
                <svg className="w-5 h-5" viewBox="0 0 21 21">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                Microsoft
              </Button>
            </div>
          </form>

          {/* Sign in link */}
          <p className="mt-8 text-center text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:text-primary/90">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-[oklch(0.25_0.06_265)] relative overflow-hidden landing-noise-bg">
        {/* Floating shapes */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-[oklch(0.35_0.10_275/0.3)] rounded-full filter blur-xl animate-blob" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-[oklch(0.30_0.08_260/0.25)] rounded-full filter blur-xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-[oklch(0.32_0.09_270/0.2)] rounded-full filter blur-xl animate-blob animation-delay-4000" />

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <h3 className="landing-serif text-4xl font-semibold mb-6">What Happens After You Sign Up</h3>
          <p className="text-lg text-white/80 mb-8">You'll be up and running in under 5 minutes.</p>

          {/* Feature list */}
          <div className="space-y-6">
            <div className="flex items-start">
              <div className="w-8 h-8 bg-white/15 rounded-full flex items-center justify-center mr-3 flex-shrink-0 font-bold">1</div>
              <div>
                <h4 className="font-semibold mb-1">Connect OwnerRez (30 seconds)</h4>
                <p className="text-white/80 text-sm">Secure OAuth connection - we never see your password</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-8 h-8 bg-white/15 rounded-full flex items-center justify-center mr-3 flex-shrink-0 font-bold">2</div>
              <div>
                <h4 className="font-semibold mb-1">Automatic sync (~2 minutes)</h4>
                <p className="text-white/80 text-sm">We pull 4 years of bookings, properties, and guest data</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-8 h-8 bg-white/15 rounded-full flex items-center justify-center mr-3 flex-shrink-0 font-bold">3</div>
              <div>
                <h4 className="font-semibold mb-1">See your insights instantly</h4>
                <p className="text-white/80 text-sm">P&L, pacing, occupancy, and guest data. Ready to explore.</p>
              </div>
            </div>
          </div>

          {/* Trust badge */}
          <div className="mt-12 pt-8 border-t border-white/15">
            <p className="text-sm text-white/80 mb-2">Cancel anytime from settings - No hassle</p>
            <p className="text-sm text-white/60">Made with 🧀 in Wisconsin</p>
          </div>
        </div>
      </div>
    </div>
  )
}
