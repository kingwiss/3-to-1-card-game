import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { User, Edit2, Save, X, Trophy, Swords, History, CreditCard, Coins } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const Profile: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user, userProfile, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(userProfile?.displayName || user?.displayName || 'Player');
  const [localProfile, setLocalProfile] = useState(userProfile);

  useEffect(() => {
    setLocalProfile(userProfile);
  }, [userProfile]);

  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user?.email,
          returnUrl: window.location.origin,
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create portal session');
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      alert('Failed to open subscription portal.');
    }
  };

  const handleSave = async () => {
    if (newName.trim()) {
      await updateProfile({ displayName: newName });
      setIsEditing(false);
    }
  };

  if (!localProfile) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full border border-slate-700 relative max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white mb-4 shadow-lg overflow-hidden">
            {localProfile.photoURL ? (
              <img src={localProfile.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              (localProfile.displayName || 'P').charAt(0).toUpperCase()
            )}
          </div>

          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-white focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <button
                onClick={handleSave}
                className="p-2 bg-green-600 hover:bg-green-500 rounded-full text-white transition-colors"
              >
                <Save size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white">{localProfile.displayName || 'Player'}</h2>
              <button
                onClick={() => setIsEditing(true)}
                className="text-slate-400 hover:text-blue-400 transition-colors"
              >
                <Edit2 size={16} />
              </button>
            </div>
          )}
          
          {localProfile.isPremium && (
            <span className="mt-2 px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full border border-yellow-500/50 flex items-center gap-1">
              <Trophy size={12} /> PREMIUM MEMBER
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-6">
          <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center">
            <Trophy className="text-yellow-400 mb-1" size={20} />
            <span className="text-xl font-bold text-white">{localProfile.wins || 0}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Wins</span>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center">
            <Swords className="text-red-400 mb-1" size={20} />
            <span className="text-xl font-bold text-white">{localProfile.losses || 0}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Losses</span>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center">
            <History className="text-green-400 mb-1" size={20} />
            <span className="text-xl font-bold text-white">{localProfile.gamesPlayed || 0}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Games</span>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-xl border border-amber-500/50 flex flex-col items-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-orange-600/10 group-hover:opacity-100 transition-opacity"></div>
            <Coins className="text-amber-400 mb-1 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" size={20} />
            <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-orange-400 drop-shadow-sm">{localProfile.tokens || 0}</span>
            <span className="text-[10px] text-amber-500/80 uppercase tracking-wider font-bold">Tokens</span>
          </div>
        </div>

        <div className="text-center text-slate-500 text-xs mb-6">
          Member since {new Date().getFullYear()}
        </div>

        {localProfile.isPremium && (
          <button
            onClick={handleManageSubscription}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 mb-2"
          >
            <CreditCard size={18} />
            Manage Subscription
          </button>
        )}
      </motion.div>
    </motion.div>
  );
};

export default Profile;
