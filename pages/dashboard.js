import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Dashboard() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalTransactions: 0,
    averageAmount: 0,
    todayRevenue: 0
  })
  const [recentTransactions, setRecentTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }
    fetchData()
  }, [user])

  const fetchData = async () => {
    setLoading(true)
    
    // Fetch your M-Pesa transactions data
    const { data: transactions, error } = await supabase
      .from('mpesa_transactions')
      .select('*')
      .order('date', { ascending: false })
      .limit(5)
    
    if (transactions) {
      setRecentTransactions(transactions)
      
      // Calculate stats
      const totalRev = transactions.reduce((sum, t) => sum + (t.amount || 0), 0)
      const avgAmount = transactions.length > 0 ? totalRev / transactions.length : 0
      const today = new Date().toISOString().split('T')[0]
      const todayRev = transactions
        .filter(t => t.date?.split('T')[0] === today)
        .reduce((sum, t) => sum + (t.amount || 0), 0)
      
      setStats({
        totalRevenue: totalRev,
        totalTransactions: transactions.length,
        averageAmount: avgAmount,
        todayRevenue: todayRev
      })
    }
    
    setLoading(false)
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Logout */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-blue-600">Pesa Pro</h1>
              <p className="text-sm text-gray-500">M-Pesa Transaction Manager</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex space-x-8">
            <button className="py-3 px-1 text-blue-600 border-b-2 border-blue-600 font-medium">
              Dashboard
            </button>
            <button 
              onClick={() => router.push('/import-sms')}
              className="py-3 px-1 text-gray-500 hover:text-gray-700"
            >
              Import SMS
            </button>
            <button 
              onClick={() => router.push('/transactions')}
              className="py-3 px-1 text-gray-500 hover:text-gray-700"
            >
              Transaction Log
            </button>
            <button 
              onClick={() => router.push('/campaigns')}
              className="py-3 px-1 text-gray-500 hover:text-gray-700"
            >
              Campaigns
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Good morning {(user?.user_metadata?.full_name || user?.email?.split('@')[0])?.split(' ')[0]} 👋
          </h2>
          <p className="text-gray-600">Here's your M-Pesa financial overview</p>
        </div>

        {/* Stats Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-32"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-500 text-sm">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    KSh {stats.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <span className="text-green-500 text-sm bg-green-50 px-2 py-1 rounded">+12.5%</span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-500 text-sm">Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalTransactions}</p>
                </div>
                <span className="text-green-500 text-sm bg-green-50 px-2 py-1 rounded">+8.2%</span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-500 text-sm">Average Amount</p>
                  <p className="text-2xl font-bold text-gray-900">
                    KSh {Math.round(stats.averageAmount).toLocaleString()}
                  </p>
                </div>
                <span className="text-green-500 text-sm bg-green-50 px-2 py-1 rounded">+3.1%</span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-500 text-sm">Today's Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    KSh {stats.todayRevenue.toLocaleString()}
                  </p>
                </div>
                <span className="text-green-500 text-sm bg-green-50 px-2 py-1 rounded">+18.3%</span>
              </div>
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
            <button 
              onClick={() => router.push('/transactions')}
              className="text-blue-600 text-sm hover:text-blue-700"
            >
              View all →
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sender</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentTransactions.map((transaction, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{transaction.sender_name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-green-600">
                      KSh {transaction.amount?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">{transaction.transaction_code}</td>
                  </tr>
                ))}
                {recentTransactions.length === 0 && !loading && (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                      No transactions found. Import some SMS messages to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
            <div className="text-2xl mb-2">📱</div>
            <h3 className="text-lg font-semibold mb-2">Import SMS</h3>
            <p className="text-blue-100 text-sm mb-4">Parse M-Pesa message</p>
            <button 
              onClick={() => router.push('/import-sms')}
              className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition"
            >
              Import Now →
            </button>
          </div>
          
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
            <div className="text-2xl mb-2">📊</div>
            <h3 className="text-lg font-semibold mb-2">Transaction Log</h3>
            <p className="text-green-100 text-sm mb-4">View all records</p>
            <button 
              onClick={() => router.push('/transactions')}
              className="bg-white text-green-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-50 transition"
            >
              View Log →
            </button>
          </div>
          
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
            <div className="text-2xl mb-2">🎯</div>
            <h3 className="text-lg font-semibold mb-2">Campaigns</h3>
            <p className="text-purple-100 text-sm mb-4">Fundraising campaigns</p>
            <button 
              onClick={() => router.push('/campaigns')}
              className="bg-white text-purple-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-50 transition"
            >
              Manage →
            </button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">📊</div>
            <div>
              <h3 className="font-semibold text-gray-900">Track Everything</h3>
              <p className="text-gray-600 text-sm">Import M-Pesa messages to automatically build your financial history</p>
              <button 
                onClick={() => router.push('/import-sms')}
                className="mt-2 text-blue-600 text-sm font-medium hover:text-blue-700"
              >
                Import Now →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
