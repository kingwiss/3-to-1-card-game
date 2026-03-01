import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  wins: number;
  losses: number;
  gamesPlayed: number;
  isPremium: boolean;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      try {
        if (currentUser) {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          let currentProfile: UserProfile;

          if (docSnap.exists()) {
            currentProfile = docSnap.data() as UserProfile;
          } else {
            // Create new profile
            currentProfile = {
              uid: currentUser.uid,
              displayName: currentUser.displayName || 'Player',
              photoURL: currentUser.photoURL,
              wins: 0,
              losses: 0,
              gamesPlayed: 0,
              isPremium: false,
            };
            await setDoc(docRef, currentProfile);
          }

          // Check subscription status from backend
          try {
            const response = await fetch(`/api/subscription-status?email=${encodeURIComponent(currentUser.email || '')}`);
            if (response.ok) {
              const { isPremium } = await response.json();
              
              // Also check URL parameters for successful checkout
              const urlParams = new URLSearchParams(window.location.search);
              const isSuccess = urlParams.get('success') === 'true';
              
              const finalPremiumStatus = isPremium || isSuccess;

              if (currentProfile.isPremium !== finalPremiumStatus) {
                currentProfile.isPremium = finalPremiumStatus;
                await setDoc(docRef, { isPremium: finalPremiumStatus }, { merge: true });
              }
              
              if (isSuccess) {
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
                alert('Payment successful! You are now a premium member.');
              }
            }
          } catch (err) {
            console.error('Failed to verify subscription status:', err);
          }

          setUserProfile(currentProfile);
        } else {
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid);
    await setDoc(docRef, data, { merge: true });
    
    if (data.displayName) {
      const { updateProfile: updateFirebaseAuthProfile } = await import('firebase/auth');
      await updateFirebaseAuthProfile(user, { displayName: data.displayName });
    }
    
    setUserProfile(prev => prev ? { ...prev, ...data } : null);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
