#!/usr/bin/env node

/**
 * Backfill script for guest contact details
 *
 * This script updates bookings that are missing email/phone by copying data from the guests table.
 *
 * NOTE: As of Oct 2025, this script typically finds no data to backfill because OTA platforms
 * (Airbnb, VRBO, etc.) don't share guest contact information with property managers.
 * The initial sync and webhooks now properly extract email/phone when available from OwnerRez.
 *
 * When to run this script:
 * - If you suspect the guests table has contact info that's not in the bookings table
 * - After manual data imports or corrections
 *
 * Usage:
 *   npx tsx scripts/backfill-guest-details.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Parse .dev.vars file
function loadDevVars(): Record<string, string> {
  const devVarsPath = path.join(__dirname, '../apps/workers/.dev.vars')
  const content = fs.readFileSync(devVarsPath, 'utf-8')
  const vars: Record<string, string> = {}

  content.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key) {
        vars[key.trim()] = valueParts.join('=').trim()
      }
    }
  })

  return vars
}

async function main() {
  console.log('🔄 Starting guest details backfill from guests table...\n')

  // Load environment variables
  const env = loadDevVars()
  const supabaseUrl = env.SUPABASE_URL
  const supabaseKey = env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .dev.vars')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Get all tenants with OwnerRez connected
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id')
    .eq('ownerrez_connected', true)

  if (tenantsError) {
    console.error('❌ Failed to fetch tenants:', tenantsError)
    process.exit(1)
  }

  console.log(`📊 Found ${tenants?.length || 0} tenants with OwnerRez connected\n`)

  let totalBookings = 0
  let totalUpdated = 0
  let totalFailed = 0

  for (const tenant of tenants || []) {
    console.log(`\n🏢 Processing tenant: ${tenant.id}`)

    // Get all bookings missing email or phone
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, guest_name, guest_email, guest_phone, arrival')
      .eq('tenant_id', tenant.id)
      .neq('status', 'canceled')
      .order('arrival', { ascending: false })

    if (bookingsError) {
      console.error('  ❌ Failed to fetch bookings:', bookingsError)
      continue
    }

    // Filter bookings that are missing email or phone
    const bookingsMissingDetails = (bookings || []).filter(
      (b: any) => (!b.guest_email || !b.guest_phone) && b.guest_name
    )

    console.log(`  📋 Found ${bookings?.length || 0} bookings`)
    console.log(`  🔍 ${bookingsMissingDetails.length} bookings missing email/phone`)
    totalBookings += bookingsMissingDetails.length

    // Get all guests for this tenant
    const { data: guests, error: guestsError } = await supabase
      .from('guests')
      .select('full_name, email, phone')
      .eq('tenant_id', tenant.id)

    if (guestsError) {
      console.error('  ❌ Failed to fetch guests:', guestsError)
      continue
    }

    console.log(`  👥 Found ${guests?.length || 0} guests in database`)

    // Create a map of guest name to contact info
    const guestMap = new Map<string, { email?: string; phone?: string }>()
    for (const guest of guests || []) {
      if (guest.full_name) {
        const normalizedName = guest.full_name.toLowerCase().trim()
        guestMap.set(normalizedName, {
          email: guest.email || undefined,
          phone: guest.phone || undefined
        })
      }
    }

    // Process each booking
    for (const booking of bookingsMissingDetails) {
      try {
        const normalizedGuestName = booking.guest_name.toLowerCase().trim()
        const guestInfo = guestMap.get(normalizedGuestName)

        if (!guestInfo) {
          console.log(`    ⚠️  No guest found for "${booking.guest_name}"`)
          continue
        }

        // Determine what needs to be updated
        const updates: any = {}
        const updated: string[] = []

        if (!booking.guest_email && guestInfo.email) {
          updates.guest_email = guestInfo.email
          updated.push('email')
        }

        if (!booking.guest_phone && guestInfo.phone) {
          updates.guest_phone = guestInfo.phone
          updated.push('phone')
        }

        // Update booking if we have new data
        if (updated.length > 0) {
          updates.updated_at = new Date().toISOString()

          const { error: updateError } = await supabase
            .from('bookings')
            .update(updates)
            .eq('id', booking.id)

          if (updateError) {
            console.error(`    ❌ Failed to update booking for "${booking.guest_name}":`, updateError)
            totalFailed++
          } else {
            console.log(`    ✅ Updated ${updated.join(' & ')} for "${booking.guest_name}"`)
            totalUpdated++
          }
        } else {
          console.log(`    ℹ️  No additional details available for "${booking.guest_name}"`)
        }

      } catch (error: any) {
        console.error(`    ❌ Failed to process booking:`, error.message)
        totalFailed++
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Backfill Summary:')
  console.log('='.repeat(60))
  console.log(`Total bookings checked:       ${totalBookings}`)
  console.log(`Total bookings updated:       ${totalUpdated}`)
  console.log(`Failed:                       ${totalFailed}`)
  console.log('='.repeat(60))
  console.log('\n✅ Backfill complete!')
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})
