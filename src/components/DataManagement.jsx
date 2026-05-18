import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Trash2, AlertTriangle, Database, RefreshCw } from 'lucide-react';

export default function DataManagement({ onDataCleared }) {
  const [showModal, setShowModal] = useState(false);
  const [clearType, setClearType] = useState(null);
  const [clearing, setClearing] = useState(false);

  const clearData = async (type) => {
    setClearing(true);
    try {
      switch(type) {
        case 'contributions':
          await supabase.from('campaign_contributions').delete().neq('id', 0);
          await supabase.from('campaigns').update({ current_amount: 0 }).neq('id', 0);
          alert('? All contributions cleared! Campaign amounts reset to 0.');
          break;
        case 'campaigns':
          await supabase.from('campaign_contributions').delete().neq('id', 0);
          await supabase.from('campaigns').delete().neq('id', 0);
          alert('? All campaigns and contributions cleared!');
          break;
        case 'transactions':
          await supabase.from('transactions').delete().neq('id', 0);
          alert('? All transactions cleared!');
          break;
        case 'all':
          await supabase.from('campaign_contributions').delete().neq('id', 0);
          await supabase.from('transactions').delete().neq('id', 0);
          await supabase.from('campaigns').delete().neq('id', 0);
          alert('? All data cleared!');
          break;
      }
      if (onDataCleared) onDataCleared();
      setShowModal(false);
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('? Error clearing data. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  const clearOptions = [
    { type: 'contributions', label: 'All Contributions', icon: '??', color: '#f59e0b', desc: 'Remove all contributions from campaigns (resets amounts)' },
    { type: 'campaigns', label: 'All Campaigns', icon: '??', color: '#ef4444', desc: 'Delete all campaigns and their contributions' },
    { type: 'transactions', label: 'All Transactions', icon: '??', color: '#3b82f6', desc: 'Delete all transaction records' },
    { type: 'all', label: 'EVERYTHING', icon: '??', color: '#dc2626', desc: 'Delete ALL data (campaigns, contributions, transactions)' }
  ];

  const ClearModal = () => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(8px)'
    }}>
      <div style={{
        background: '#1e293b',
        borderRadius: 24,
        padding: 32,
        maxWidth: 500,
        width: '90%',
        border: '1px solid rgba(239,68,68,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 64,
            height: 64,
            background: 'rgba(239,68,68,0.15)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <AlertTriangle size={32} style={{ color: '#ef4444' }} />
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
            Clear {clearType === 'all' ? 'ALL DATA' : clearType?.toUpperCase()}
          </h3>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
            {clearType === 'all' && '?? DANGER: This will permanently delete ALL your data including campaigns, contributions, and transactions.'}
            {clearType === 'campaigns' && 'This will delete ALL campaigns and their contributions. This action cannot be undone.'}
            {clearType === 'contributions' && 'This will remove ALL contributions from ALL campaigns. Campaign amounts will be reset to 0.'}
            {clearType === 'transactions' && 'This will delete ALL transaction records. This action cannot be undone.'}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setShowModal(false)}
            style={{
              flex: 1,
              padding: '12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              cursor: 'pointer',
              color: '#94a3b8',
              fontWeight: 600
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => clearData(clearType)}
            disabled={clearing}
            style={{
              flex: 1,
              padding: '12px',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              border: 'none',
              borderRadius: 10,
              cursor: clearing ? 'not-allowed' : 'pointer',
              color: 'white',
              fontWeight: 600,
              opacity: clearing ? 0.7 : 1
            }}
          >
            {clearing ? 'Clearing...' : 'Yes, Clear All'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => {
          setClearType('contributions');
          setShowModal(true);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 20px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12,
          cursor: 'pointer',
          color: '#f87171',
          fontWeight: 600,
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
          e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
          e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
        }}
      >
        <Trash2 size={16} />
        Clear Data
      </button>
      
      {showModal && <ClearModal />}
    </div>
  );
}
