import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

const SessionContext = createContext();

export function SessionProvider({ children, onLogout }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const BASE_URL = 'https://shiv-bandhan-testing.vercel.app/';

  useEffect(() => {
    async function loadUser() {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          const response = await fetch(`${BASE_URL}api/session`, {
            headers: { 'Content-Type': 'application/json' },
          });
          const result = await response.json();
          if (result.user) {
            setUser(result.user);
            await AsyncStorage.setItem('user', JSON.stringify(result.user));
          }
        }
      } catch (error) {
        console.error('Failed to load session:', error);
        Toast.show({ type: 'error', text1: 'Failed to load session' });
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const login = async (userId) => {
    try {
      const response = await fetch(`${BASE_URL}api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        return true;
      }
      Toast.show({ type: 'error', text1: 'Login failed' });
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      Toast.show({ type: 'error', text1: 'Login failed' });
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch(`${BASE_URL}api/logout`, { method: 'POST' });
      setUser(null);
      await AsyncStorage.removeItem('user');
      if (onLogout) onLogout(); // Call the onLogout callback to handle navigation
    } catch (error) {
      console.error('Logout failed:', error);
      Toast.show({ type: 'error', text1: 'Logout failed' });
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    isPhoneVerified: user?.phoneIsVerified || false,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
      <Toast />
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}