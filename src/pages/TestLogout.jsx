import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function TestLogout() {
  const navigate = useNavigate()

  useEffect(() => {
    const testLogout = async () => {
      console.log('Testing logout...')
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Logout error:', error)
      } else {
        console.log('Logout successful')
        navigate('/login')
      }
    }
    testLogout()
  }, [navigate])

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#0a0f1e',
      color: 'white'
    }}>
      <div>Logging out...</div>
    </div>
  )
}
