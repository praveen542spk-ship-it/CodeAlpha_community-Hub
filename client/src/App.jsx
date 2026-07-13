import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Lobby from './pages/Lobby';
import MeetingRoom from './pages/MeetingRoom';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import API from './utils/api';
import { ChunkyProgressBar, PageTransition } from './components/BrutalistAnim';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await API.get('/auth/user');
        setUser(res.data);
      } catch (err) {
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#040209]">
        <ChunkyProgressBar label="Initializing Hub" />
      </div>
    );
  }

  // Protected Route Helper
  const ProtectedRoute = ({ children }) => {
    return user ? children : <Navigate to="/login" replace />;
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-[#040209] flex flex-col justify-start">
      {/* Background ambient floating orbs */}
      <div className="bg-orb bg-orb-purple"></div>
      <div className="bg-orb bg-orb-blue"></div>

      <Routes>
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <PageTransition>
                <Lobby user={user} logout={logout} />
              </PageTransition>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/login" 
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <PageTransition>
                <Login setUser={setUser} />
              </PageTransition>
            )
          } 
        />
        <Route 
          path="/register" 
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <PageTransition>
                <Register setUser={setUser} />
              </PageTransition>
            )
          } 
        />
        <Route 
          path="/room/:roomId" 
          element={
            <ProtectedRoute>
              <PageTransition>
                <MeetingRoom user={user} />
              </PageTransition>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/analytics" 
          element={
            <ProtectedRoute>
              <PageTransition>
                <AnalyticsDashboard user={user} logout={logout} />
              </PageTransition>
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
