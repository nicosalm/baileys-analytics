#!/usr/bin/env node

/**
 * Backfill script for tax charges
 *
 * This script fetches charges for all bookings that don't have charges in the database.
 * It uses the OwnerRez API to fetch full booking details including charges.
 *
 * When to run this script:
 * - After fixing the initial sync or webhook charge capture bugs (one-time)
 * - For any user that signed up before charge capture was added to initial sync
 * - If you suspect charges are missing from the database
 *
 * Note: As of the latest updates, both initial sync and webhooks now properly
 * capture charges, so this should rarely be needed for new users.
 *
 * Usage:
 *   npx tsx scripts/backfill-tax-charges.ts
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

// Simple OwnerRez API client
class OwnerRezClient {
  private baseUrl = 'https://api.ownerreservations.com/v2'
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  async fetchBookingDetail(bookingId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/bookings/${bookingId}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Baileys-Analytics/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch booking ${bookingId}: ${response.statusText}`)
    }

    return await response.json()
  }
}

async function main() {
  console.log('🔄 Starting tax charges backfill...\n')

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
  let totalProcessed = 0
  let totalFailed = 0
  let totalChargesAdded = 0

  for (const tenant of tenants || []) {
    console.log(`\n🏢 Processing tenant: ${tenant.id}`)

    // Get OAuth token for this tenant
    const { data: token } = await supabase
      .from('oauth_tokens')
      .select('access_token')
      .eq('tenant_id', tenant.id)
      .eq('provider', 'ownerrez')
      .single()

    if (!token?.access_token) {
      console.log('  ⚠️  No OAuth token found, skipping...')
      continue
    }

    const ownerRez = new OwnerRezClient(token.access_token)

    // Get all bookings without charges
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        ownerrez_booking_id,
        guest_name,
        arrival,
        status
      `)
      .eq('tenant_id', tenant.id)
      .neq('status', 'canceled')
      .order('arrival', { ascending: false })

    if (bookingsError) {
      console.error('  ❌ Failed to fetch bookings:', bookingsError)
      continue
    }

    console.log(`  📋 Found ${bookings?.length || 0} bookings`)

    // Filter bookings that don't have charges
    const bookingsWithoutCharges = []
    for (const booking of bookings || []) {
      const { data: existingCharges } = await supabase
        .from('booking_charges')
        .select('id')
        .eq('booking_id', booking.id)
        .limit(1)

      if (!existingCharges || existingCharges.length === 0) {
        bookingsWithoutCharges.push(booking)
      }
    }

    console.log(`  🔍 ${bookingsWithoutCharges.length} bookings missing charges`)
    totalBookings += bookingsWithoutCharges.length

    // Process each booking
    for (const booking of bookingsWithoutCharges) {
      try {
        console.log(`    📥 Fetching charges for booking ${booking.ownerrez_booking_id} (${booking.guest_name})...`)

        const fullBooking = await ownerRez.fetchBookingDetail(String(booking.ownerrez_booking_id))

        if (fullBooking?.charges && Array.isArray(fullBooking.charges)) {
          // Delete any existing charges first
          await supabase
            .from('booking_charges')
            .delete()
            .eq('booking_id', booking.id)

          // Insert charges
          const charges = fullBooking.charges.map((charge: any, index: number) => ({
            booking_id: booking.id,
            type: charge.type,
            amount: charge.amount,
            description: charge.description,
            position: index
          }))

          if (charges.length > 0) {
            const { error: insertError } = await supabase
              .from('booking_charges')
              .insert(charges)

            if (insertError) {
              console.error(`      ❌ Failed to insert charges:`, insertError)
              totalFailed++
            } else {
              console.log(`      ✅ Added ${charges.length} charges`)
              totalProcessed++
              totalChargesAdded += charges.length
            }
          } else {
            console.log(`      ℹ️  No charges found`)
            totalProcessed++
          }
        } else {
          console.log(`      ℹ️  No charges in API response`)
          totalProcessed++
        }

        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error: any) {
        console.error(`      ❌ Failed to process booking:`, error.message)
        totalFailed++
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Backfill Summary:')
  console.log('='.repeat(60))
  console.log(`Total bookings processed:     ${totalProcessed}`)
  console.log(`Total charges added:          ${totalChargesAdded}`)
  console.log(`Failed:                       ${totalFailed}`)
  console.log('='.repeat(60))
  console.log('\n✅ Backfill complete!')
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})
