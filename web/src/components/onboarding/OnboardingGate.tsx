import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { billingClient, BillingError } from '@/lib/stripe'
import { getOnboardingStep } from '@/lib/onboarding'
import { cn } from '@/lib/utils'
import { AppHeader } from '@/components/AppHeader'
import { Footer } from '@/components/Footer'
import { LoadingState } from '@/components/LoadingState'
import { OwnerRezLogo } from '@/components/OwnerRezLogo'
import { Button } from '@/components/ui/button'
import { PlanStep } from './PlanStep'
import { useConnectOwnerRez } from './use-connect-ownerrez'

const STEPS = [
  { id: 'connect', label: 'Connect OwnerRez' },
  { id: 'plan', label: 'Choose billing' },
  { id: 'import', label: 'Import your data' },
] as const

const CONFIRM_ATTEMPTS = 4
const CONFIRM_DELAY_MS = 2000

const cardClass = 'rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8'

const SetupSteps = ({ current }: { current: (typeof STEPS)[number]['id'] }) => {
  const currentIndex = STEPS.findIndex((s) => s.id === current)
  return (
    <ol className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Setup steps">
      {STEPS.map((step, index) => {
        const done = index < currentIndex
        const active = index === currentIndex
        return (
          <li
            key={step.id}
            aria-current={active ? 'step' : undefined}
            className={cn('flex items-center gap-1.5', active && 'font-medium text-foreground')}
          >
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full border text-[11px] tabular-nums',
                active ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
              )}
            >
              {done ? <Check className="h-3 w-3" aria-hidden /> : index + 1}
            </span>
            {step.label}
          </li>
        )
      })}
    </ol>
  )
}

const OnboardingShell = ({ step, children }: { step: (typeof STEPS)[number]['id'] | null; children: React.ReactNode }) => (
  <div className="min-h-screen bg-background flex flex-col">
    <AppHeader subtitle={null} />
    <main className="flex-1 flex items-start justify-center px-4 py-12 sm:items-center">
      <div className="w-full max-w-md">
        {step && <SetupSteps current={step} />}
        {children}
      </div>
    </main>
    <Footer />
  </div>
)

const ConnectStep = () => {
  const { connect, connecting } = useConnectOwnerRez()
  return (
    <div className={cardClass}>
      <OwnerRezLogo className="-ml-1" imgClassName="h-7 brightness-0 dark:invert group-hover:opacity-75" />
      <h2 className="mt-5 text-xl font-semibold text-foreground">Connect OwnerRez</h2>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        Baileys counts your active properties to price your plan, then imports four years of bookings and guests once you subscribe. You
        sign in on OwnerRez, so Baileys never sees your password.
      </p>
      <Button onClick={connect} loading={connecting} loadingText="Connecting..." className="mt-6 w-full">
        Connect OwnerRez
      </Button>
    </div>
  )
}

// walks a new account through connect, plan and payment before the dashboard mounts.
// the dashboard's own sync check then runs the full import.
export const OnboardingGate = ({ children }: { children: React.ReactNode }) => {
  const { state, refreshUser } = useAuth()
  const { addToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const checkoutSession = searchParams.get('checkout_session')
  const [confirmState, setConfirmState] = useState<'idle' | 'confirming' | 'delayed'>(checkoutSession ? 'confirming' : 'idle')
  const [retryingProfile, setRetryingProfile] = useState(false)
  const handledReturn = useRef(false)

  const dropParam = useCallback(
    (key: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete(key)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const confirmPayment = useCallback(
    async (sessionId: string) => {
      setConfirmState('confirming')
      for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt++) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, CONFIRM_DELAY_MS))
        try {
          if (await billingClient.confirmCheckout(sessionId)) {
            await refreshUser()
            dropParam('checkout_session')
            setConfirmState('idle')
            return
          }
        } catch (err) {
          // a stale or foreign session id: fall back to whatever the account's state is
          if (err instanceof BillingError && err.code === 'CHECKOUT_NOT_FOUND') {
            dropParam('checkout_session')
            setConfirmState('idle')
            return
          }
        }
      }
      setConfirmState('delayed')
    },
    [refreshUser, dropParam],
  )

  // runs once per return from Stripe, StrictMode included
  useEffect(() => {
    if (handledReturn.current) return
    handledReturn.current = true
    if (checkoutSession) confirmPayment(checkoutSession)
    if (searchParams.get('checkout') === 'cancel') {
      addToast('info', 'Checkout canceled')
      dropParam('checkout')
    }
  }, [checkoutSession, confirmPayment, searchParams, addToast, dropParam])

  if (state.status !== 'authenticated') return null

  if (confirmState === 'confirming') {
    return (
      <OnboardingShell step="plan">
        <div className={cardClass}>
          <LoadingState message="Confirming your payment" />
        </div>
      </OnboardingShell>
    )
  }

  if (confirmState === 'delayed' && checkoutSession) {
    return (
      <OnboardingShell step="plan">
        <div className={cardClass}>
          <h2 className="text-xl font-semibold text-foreground">Payment received</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Stripe is still confirming it. This usually takes a few seconds.
          </p>
          <Button onClick={() => confirmPayment(checkoutSession)} className="mt-6 w-full">
            Check again
          </Button>
        </div>
      </OnboardingShell>
    )
  }

  const step = getOnboardingStep(state.user)

  if (step === 'unknown') {
    const retry = async () => {
      setRetryingProfile(true)
      await refreshUser()
      setRetryingProfile(false)
    }
    return (
      <OnboardingShell step={null}>
        <div className={cardClass}>
          <h2 className="text-xl font-semibold text-foreground">We couldn't load your account</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">This is usually a brief connection problem.</p>
          <Button onClick={retry} loading={retryingProfile} loadingText="Retrying..." className="mt-6 w-full">
            Try again
          </Button>
        </div>
      </OnboardingShell>
    )
  }

  if (step === 'connect') {
    return (
      <OnboardingShell step="connect">
        <ConnectStep />
      </OnboardingShell>
    )
  }

  if (step === 'plan') {
    return (
      <OnboardingShell step="plan">
        <PlanStep />
      </OnboardingShell>
    )
  }

  return <>{children}</>
}
