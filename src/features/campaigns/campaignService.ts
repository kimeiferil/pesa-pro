import { supabase } from '@/lib/supabase';

export interface Campaign {
  id?: number;
  title: string;
  category: string;
  description: string;
  target_amount: number;
  current_amount?: number;
  start_date?: string;
  end_date?: string;
  beneficiary_name?: string;
  beneficiary_contact?: string;
  payment_details?: string;
  paybill_number?: string;
  account_number?: string;
  status?: string;
  is_urgent?: boolean;
}

export async function createCampaign(campaign: Campaign) {
  // Use getUser() instead of getSession() — getSession() can return a stale/null
  // session even when the user is logged in, causing silent insert failures.
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) throw new Error('You must be logged in');

  const campaignData = {
    title: campaign.title,
    category: campaign.category,
    description: campaign.description,
    target_amount: campaign.target_amount,
    current_amount: 0,
    end_date: campaign.end_date || null,
    beneficiary_name: campaign.beneficiary_name || null,
    beneficiary_contact: campaign.beneficiary_contact || null,
    payment_details: campaign.payment_details || null,
    status: 'active',
    user_id: user.id, // always from getUser(), never from stale session
  };

  const { data, error } = await supabase
    .from('campaigns')
    .insert([campaignData])
    .select()
    .single();

  if (error) {
    console.error('[createCampaign] Supabase insert error:', error);
    throw error;
  }

  return data;
}

export async function getCampaigns() {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getActiveCampaigns() {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getCampaign(id: number) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function addContributionToCampaign(
  campaignId: number,
  amount: number,
  donorName: string,
  donorPhone: string,
  transactionCode?: string
) {
  // Any authenticated user can contribute — user_id is optional (donors may be anonymous)
  const { data: { user } } = await supabase.auth.getUser();

  const { data: contrib, error } = await supabase
    .from('campaign_contributions')
    .insert([{
      campaign_id: campaignId,
      amount,
      donor_name: donorName || 'Anonymous',
      donor_phone: donorPhone || '',
      transaction_code: transactionCode || `TXN-${Date.now()}`,
      status: 'confirmed',
      // Only attach user_id if the contributor is logged in
      ...(user ? { user_id: user.id } : {}),
      created_at: new Date().toISOString(),
    }])
    .select();

  if (error) {
    console.error('[addContributionToCampaign] Supabase error:', error);
    throw error;
  }

  // Update the campaign's current_amount
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('current_amount')
    .eq('id', campaignId)
    .single();

  await supabase
    .from('campaigns')
    .update({ current_amount: (campaign?.current_amount || 0) + amount })
    .eq('id', campaignId);

  return contrib;
}

export async function getCampaignContributions(campaignId: number) {
  const { data, error } = await supabase
    .from('campaign_contributions')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export function generateShareTemplate(campaign: any): string {
  const progress = ((campaign.current_amount || 0) / campaign.target_amount) * 100;
  return (
    `*${campaign.title.toUpperCase()}*\n` +
    `Raised: KES ${campaign.current_amount?.toLocaleString()} (${progress.toFixed(0)}%)\n` +
    `Goal: KES ${campaign.target_amount.toLocaleString()}\n\n` +
    `${campaign.description}\n\n` +
    `Pay: ${campaign.payment_details}\n\n` +
    `_Powered by Pesa Pro_`
  );
}

// 🛡️ SUPER AGGRESSIVE ORDERED DELETE
export async function deleteCampaign(id: number) {
  console.log(`Starting deep cleanup for campaign ${id}...`);
  try {
    // 1. Unlink from transactions first (removes foreign key reference)
    const { error: unlinkError } = await supabase
      .from('transactions')
      .update({ event_id: null })
      .eq('event_id', id);
    if (unlinkError) console.warn('Unlink transactions warn:', unlinkError);

    // 2. Delete from user_contributions (references campaign_contributions)
    const { error: userContribError } = await supabase
      .from('user_contributions')
      .delete()
      .eq('campaign_id', id);
    if (userContribError) console.warn('User contributions delete warn:', userContribError);

    // 3. Delete from campaign_contributions
    const { error: contribError } = await supabase
      .from('campaign_contributions')
      .delete()
      .eq('campaign_id', id);
    if (contribError) console.warn('Campaign contributions delete warn:', contribError);

    // 4. Delete from campaign_updates
    const { error: updateError } = await supabase
      .from('campaign_updates')
      .delete()
      .eq('campaign_id', id);
    if (updateError) console.warn('Updates delete warn:', updateError);

    // 5. Finally delete the campaign itself
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Final campaign delete failed:', error);
      throw error;
    }

    return true;
  } catch (err: any) {
    console.error('Delete flow failed:', err);
    throw new Error(err.message || 'Check database constraints');
  }
}