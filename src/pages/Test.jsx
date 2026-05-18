import { useAuth } from '../context/AuthContext'

export default function Test() {
  const { user, loading } = useAuth()
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-4">Auth Test Page</h1>
        {loading ? (
          <p>Loading...</p>
        ) : user ? (
          <div>
            <p className="text-green-600">✅ User is logged in!</p>
            <p>Email: {user.email}</p>
          </div>
        ) : (
          <p className="text-red-600">❌ No user logged in</p>
        )}
      </div>
    </div>
  )
}
