import React, { useState } from 'react';
import { useProfile } from '../../hooks/useProfile';
import { useBusinesses } from '../../hooks/useBusinesses';

// OnboardingFlow: 3-step wizard to complete profile, create business, and select goals.
export default function OnboardingFlow() {
  const { profile, saveProfile } = useProfile();
  const { createBusiness, switchBusiness } = useBusinesses();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<any>({
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    phone: profile?.phone ?? '+254',
    whatsapp_same_as_phone: true,
    whatsapp_phone: profile?.whatsapp_phone ?? '',
    gender: profile?.gender ?? 'male',
    business_name: '',
    business_type: 'Kiosk',
    country: 'Kenya',
    currency: 'KES',
    timezone: 'Africa/Nairobi',
    referral_code: '',
    goals: [] as string[],
  });

  const next = async () => {
    if (step === 1) {
      // validate
      if (!form.first_name || !form.last_name || !form.phone) return alert('Please complete required fields');
      setLoading(true);
      await saveProfile({
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        whatsapp_phone: form.whatsapp_same_as_phone ? form.phone : form.whatsapp_phone,
        whatsapp_same_as_phone: form.whatsapp_same_as_phone,
        gender: form.gender,
      });
      setLoading(false);
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!form.business_name) return alert('Please provide a business name');
      setLoading(true);
      const biz = await createBusiness(form.business_name, form.business_type);
      if (biz) switchBusiness(biz.id);
      setLoading(false);
      setStep(3);
      return;
    }

    if (step === 3) {
      setLoading(true);
      await saveProfile({ goals: form.goals });
      setLoading(false);
      // navigate to dashboard
      window.location.href = '#/dashboard';
      return;
    }
  };

  const toggleGoal = (g: string) => {
    setForm((prev: any) => {
      const exists = prev.goals.includes(g);
      return { ...prev, goals: exists ? prev.goals.filter((x: string) => x !== g) : [...prev.goals, g] };
    });
  };

  return (
    <div style={{ padding: 20, color: '#e6eef6', background: '#0b1120', minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h2 style={{ color: '#00C851' }}>Get started with PesaPro</h2>
        <div style={{ margin: '12px 0', color: '#9aa6b2' }}>Step {step}/3</div>

        {step === 1 && (
          <section>
            <label>First Name*</label>
            <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
            <label>Last Name*</label>
            <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
            <label>Phone*</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <label>WhatsApp same as phone</label>
            <input type="checkbox" checked={form.whatsapp_same_as_phone} onChange={e => setForm({ ...form, whatsapp_same_as_phone: e.target.checked })} />
            {!form.whatsapp_same_as_phone && (
              <>
                <label>WhatsApp Phone</label>
                <input value={form.whatsapp_phone} onChange={e => setForm({ ...form, whatsapp_phone: e.target.value })} />
              </>
            )}
            <label>Gender</label>
            <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </section>
        )}

        {step === 2 && (
          <section>
            <label>Business Name*</label>
            <input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} />
            <label>Business Type*</label>
            <select value={form.business_type} onChange={e => setForm({ ...form, business_type: e.target.value })}>
              <option>Salon</option>
              <option>Kiosk</option>
              <option>Bodaboda</option>
              <option>Agri Shop</option>
              <option>Online Reselling</option>
              <option>Other</option>
            </select>
            <label>Country</label>
            <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
            <label>Currency</label>
            <input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
            <label>Timezone</label>
            <input value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} />
            <label>Referral Code (optional)</label>
            <input value={form.referral_code} onChange={e => setForm({ ...form, referral_code: e.target.value })} />
          </section>
        )}

        {step === 3 && (
          <section>
            <div>What do you want to use PesaPro for?</div>
            <label><input type="checkbox" checked={form.goals.includes('sales')} onChange={() => toggleGoal('sales')} /> Track sales and customers</label>
            <label><input type="checkbox" checked={form.goals.includes('inventory')} onChange={() => toggleGoal('inventory')} /> Manage inventory and purchases</label>
            <label><input type="checkbox" checked={form.goals.includes('expenses')} onChange={() => toggleGoal('expenses')} /> Track expenses and reports</label>
            <label><input type="checkbox" checked={form.goals.includes('online')} onChange={() => toggleGoal('online')} /> Sell online</label>
            <label><input type="checkbox" checked={form.goals.includes('debts')} onChange={() => toggleGoal('debts')} /> Manage debt/credit</label>
            <label><input type="checkbox" checked={form.goals.includes('explore')} onChange={() => toggleGoal('explore')} /> Just exploring</label>
          </section>
        )}

        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          {step > 1 && <button onClick={() => setStep(step - 1)}>Back</button>}
          <button onClick={next} disabled={loading} style={{ background: '#00C851', color: '#021'} }>{step === 3 ? 'Finish' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
