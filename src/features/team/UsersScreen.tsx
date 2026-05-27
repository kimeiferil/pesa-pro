import React from 'react';
import { useTeamMembers } from '../../hooks/useTeamMembers';

export default function UsersScreen({ businessId }: { businessId: string | null }) {
  const { members, loading, error, refetch } = useTeamMembers(businessId);

  if (loading) return <div>Loading members...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!members.length) return <div>No team members yet. Use + New User to invite.</div>;

  return (
    <div style={{ padding: 16, color: '#e6eef6', background: '#0b1120', minHeight: '100vh' }}>
      <h3 style={{ color: '#00C851' }}>Team Members</h3>
      <div style={{ marginTop: 12 }}>
        {members.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: '#0f1724', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa6b2' }}>{m.name.split(' ').map(s => s[0]).slice(0,2).join('')}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{m.name}</div>
              <div style={{ color: '#9aa6b2', fontSize: 13 }}>{m.email} • {m.job_title ?? '—'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: m.status === 'active' ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{m.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
