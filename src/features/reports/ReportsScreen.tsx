import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useUserPlan } from '../../hooks/useUserPlan';
import { useBusinesses } from '../../hooks/useBusinesses';

export default function ReportsScreen() {
  const { currentBusiness } = useBusinesses();
  const businessId = currentBusiness?.id ?? null;
  const { plan } = useUserPlan(currentBusiness?.id ?? undefined);
  const [reportType, setReportType] = useState('income_statement');
  const [from, setFrom] = useState(new Date().toISOString().split('T')[0]);
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!businessId) return alert('Select a business');
    setLoading(true); setError(null);
    try {
      const res = await fetch('/.netlify/functions/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}` },
        body: JSON.stringify({ business_id: businessId, report_type: reportType, date_from: from, date_to: to }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate');
      setReport(json.report);
    } catch (e: any) {
      setError(e.message || 'Error');
    } finally { setLoading(false); }
  };

  const exportCsv = () => {
    if (plan === 'basic') return alert('Upgrade to Pro to export CSV');
    // simple CSV export for report JSON
    if (!report) return;
    const rows: string[] = [];
    rows.push(Object.keys(report).join(','));
    rows.push(Object.values(report).join(','));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `report-${reportType}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 16, color: '#e6eef6', background: '#0b1120', minHeight: '100vh' }}>
      <h3 style={{ color: '#00C851' }}>Reports</h3>
      <div style={{ display: 'flex', gap: 12 }}>
        <select value={reportType} onChange={e => setReportType(e.target.value)}>
          <option value="income_statement">Income Statement</option>
          <option value="balance_sheet">Balance Sheet</option>
          <option value="cash_flow">Cash Flow</option>
          <option value="customer_statements">Customer Statements</option>
          <option value="sales_summary">Sales Summary</option>
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        <button onClick={generate} style={{ background: '#00C851', color: '#021' }}>{loading ? 'Generating...' : 'Generate'}</button>
        <button onClick={exportCsv}>Export CSV</button>
      </div>

      {error && <div style={{ color: '#ff6b6b' }}>{error}</div>}

      {report && (
        <pre style={{ marginTop: 12, background: '#071226', padding: 12, borderRadius: 8 }}>{JSON.stringify(report, null, 2)}</pre>
      )}
    </div>
  );
}
