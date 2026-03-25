import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  isPremium: boolean;
  specialGamesPlayedThisWeek?: number;
  specialGameResetDate?: number;
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
    // Force logout if version mismatch or stuck
    const checkVersionAndLogout = async () => {
      const currentVersion = '1.0.1'; // Increment this to force logout for everyone
      const storedVersion = localStorage.getItem('app_version');
      
      if (storedVersion !== currentVersion) {
        try {
          await auth.signOut();
          localStorage.setItem('app_version', currentVersion);
          console.log('Forced logout due to version update');
        } catch (error) {
          console.error('Error signing out:', error);
        }
      }
    };

    checkVersionAndLogout();

    // Safety timeout for loading state
    const loadingTimeout = setTimeout(() => {
      setLoading((currentLoading) => {
        if (currentLoading) {
          console.warn('Auth loading timed out, forcing completion');
          return false;
        }
        return currentLoading;
      });
    }, 8000); // 8 seconds timeout

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      clearTimeout(loadingTimeout);
      if (!currentUser) {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time profile listener
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    setLoading(true);
    const docRef = doc(db, 'users', user.uid);
    
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const currentProfile = docSnap.data() as UserProfile;
        
        // Weekly reset logic
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const resetDate = currentProfile.specialGameResetDate || 0;
        if (Date.now() - resetDate >= ONE_WEEK_MS) {
          await setDoc(docRef, { 
            specialGamesPlayedThisWeek: 0, 
            specialGameResetDate: Date.now() 
          }, { merge: true }).catch(console.error);
        }
        
        setUserProfile(currentProfile);
        setLoading(false);
      } else {
        // Create new profile
        const newProfile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName || 'Player',
          photoURL: user.photoURL || '',
          wins: 0,
          losses: 0,
          draws: 0,
          gamesPlayed: 0,
          isPremium: false,
          specialGamesPlayedThisWeek: 0,
          specialGameResetDate: Date.now(),
        };
        try {
          await setDoc(docRef, newProfile);
          setUserProfile(newProfile);
        } catch (e) {
          console.error('Error creating profile:', e);
        }
        setLoading(false);
      }
    }, (error) => {
      console.error("Error listening to user profile:", error);
      setLoading(false);
    });

    // Check subscription status
    const checkSubscription = async () => {
      try {
        const response = await fetch(`/api/subscription-status?email=${encodeURIComponent(user.email || '')}`);
        if (response.ok) {
          const data = await response.json();
          if (data.isPremium) {
            await setDoc(docRef, { isPremium: true }, { merge: true }).catch(console.error);
          }
        }
      } catch (error) {
        console.error("Error checking subscription status:", error);
      }
    };
    checkSubscription();

    return () => unsubscribe();
  }, [user]);

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, data, { merge: true });
      
      if (data.displayName) {
        const { updateProfile: updateFirebaseAuthProfile } = await import('firebase/auth');
        await updateFirebaseAuthProfile(user, { displayName: data.displayName });
      }
      
      setUserProfile(prev => prev ? { ...prev, ...data } : null);
      console.log('Profile updated successfully:', data);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
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
