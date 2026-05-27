import React, { useState } from 'react';
import { useTeamMembers } from '../../hooks/useTeamMembers';

export default function NewUserScreen({ businessId }: { businessId: string | null }) {
  const { inviteMember, roles, createRole } = useTeamMembers(businessId);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '+254', job_title: '', supervisor_id: '' });

  const submit = async () => {
    if (!form.first_name || !form.last_name || !form.email) return alert('Please fill required fields');
    try {
      const member = await inviteMember({
        business_id: businessId!,
        invited_by: '',
        user_id: null,
        email: form.email,
        name: `${form.first_name} ${form.last_name}`,
        phone: form.phone,
        job_title: form.job_title,
      } as any);
      if (member) window.location.href = '#/chama';
    } catch (e: any) {
      alert(e.message || 'Unable to invite');
    }
  };

  return (
    <div style={{ padding: 16, color: '#e6eef6', background: '#0b1120', minHeight: '100vh' }}>
      <h3 style={{ color: '#00C851' }}>Invite New User</h3>
      <div style={{ maxWidth: 720 }}>
        <label>First name*</label>
        <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
        <label>Last name*</label>
        <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
        <label>Email*</label>
        <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <label>Phone</label>
        <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <label>Job title</label>
        <input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} />
        <div style={{ marginTop: 12 }}>
          <button onClick={submit} style={{ background: '#00C851', color: '#021' }}>Send invite</button>
        </div>
      </div>
    </div>
  );
}
