import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { transaction } = await req.json()

    // 1. Deduplication check
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('transaction_code', transaction.transactionCode)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Duplicate transaction code' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Member mapping (Find by phone)
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('phone_number', transaction.phone)
      .maybeSingle()

    // 3. Insert transaction
    const { data: newTx, error: txError } = await supabase
      .from('transactions')
      .insert({
        transaction_code: transaction.transactionCode,
        amount: transaction.amount,
        phone_number: transaction.phone,
        member_id: member?.id || null,
        event_id: transaction.eventId || null,
        status: 'approved',
        source: 'sms_share',
        timestamp: transaction.timestamp,
      })
      .select()
      .single()

    if (txError) throw txError

    return new Response(
      JSON.stringify({ success: true, data: newTx }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})