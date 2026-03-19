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

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const cachedProfile = localStorage.getItem(`profile_${currentUser.uid}`);
        if (cachedProfile) {
          try {
            setUserProfile(JSON.parse(cachedProfile));
          } catch (e) {
            console.error('Failed to parse cached profile', e);
          }
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
      clearTimeout(loadingTimeout);
      
      try {
        if (currentUser) {
          const docRef = doc(db, 'users', currentUser.uid);
          
          // Add timeout to Firestore fetch
          const docSnapPromise = getDoc(docRef);
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Firestore timeout')), 5000)
          );
          
          const docSnap = await Promise.race([docSnapPromise, timeoutPromise])
            .catch(err => {
              console.error('Firestore fetch failed or timed out:', err);
              return null;
            });
          
          let currentProfile: UserProfile;

          if (docSnap && docSnap.exists()) {
            currentProfile = docSnap.data() as UserProfile;
          } else {
            // Create new profile or fallback if fetch failed
            currentProfile = {
              uid: currentUser.uid,
              displayName: currentUser.displayName || 'Player',
              photoURL: currentUser.photoURL,
              wins: 0,
              losses: 0,
              gamesPlayed: 0,
              isPremium: false,
              specialGamesPlayedThisWeek: 0,
              specialGameResetDate: Date.now(),
            };
            // Only try to set if we have a valid connection, otherwise just use local state
            try {
              if (!docSnap) {
                 // If we failed to fetch, we might be offline. Don't overwrite unless we are sure.
                 // But for new users, we must create.
                 // Let's assume if docSnap is null (error), we just use default profile in memory
                 // and don't write to DB to avoid overwriting existing data with defaults.
                 console.warn('Using default profile due to fetch error');
              } else {
                 await setDoc(docRef, currentProfile);
              }
            } catch (e) {
              console.error('Error creating profile:', e);
            }
          }

          // Reset special games count if a week has passed
          const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
          const now = Date.now();
          if (!currentProfile.specialGameResetDate || now - currentProfile.specialGameResetDate >= ONE_WEEK_MS) {
            currentProfile.specialGamesPlayedThisWeek = 0;
            currentProfile.specialGameResetDate = now;
            setDoc(docRef, { 
              specialGamesPlayedThisWeek: 0, 
              specialGameResetDate: now 
            }, { merge: true }).catch(console.error);
          }

          // Check subscription status from backend with timeout
          try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(`/api/subscription-status?email=${encodeURIComponent(currentUser.email || '')}`, {
              signal: controller.signal
            });
            clearTimeout(id);
            
            let isPremium = false;
            if (response.ok) {
              const data = await response.json();
              isPremium = data.isPremium;
            }
            
            // Also check URL parameters for successful checkout
            const urlParams = new URLSearchParams(window.location.search);
            const isSuccess = urlParams.get('success') === 'true';
            
            const finalPremiumStatus = isPremium || isSuccess;

            if (currentProfile.isPremium !== finalPremiumStatus) {
              currentProfile.isPremium = finalPremiumStatus;
              // Try to update Firestore, but don't block if it fails
              setDoc(docRef, { isPremium: finalPremiumStatus }, { merge: true }).catch(console.error);
            }
            
            if (isSuccess) {
              // Clean up URL
              window.history.replaceState({}, document.title, window.location.pathname);
              alert('Payment successful! You are now a premium member.');
            }
          } catch (err) {
            console.error('Failed to verify subscription status:', err);
            // Fallback to URL check if fetch fails
            const urlParams = new URLSearchParams(window.location.search);
            const isSuccess = urlParams.get('success') === 'true';
            if (isSuccess) {
              currentProfile.isPremium = true;
              setDoc(docRef, { isPremium: true }, { merge: true }).catch(console.error);
              window.history.replaceState({}, document.title, window.location.pathname);
              alert('Payment successful! You are now a premium member.');
            }
          }

          setUserProfile(currentProfile);
        } else {
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(loadingTimeout);
    };
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
