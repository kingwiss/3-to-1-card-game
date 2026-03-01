import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { User, Edit2, Save, X, Trophy, Swords, History } from 'lucide-react';

const Profile: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { userProfile, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(userProfile?.displayName || '');

  const handleSave = async () => {
    if (newName.trim()) {
      await updateProfile({ displayName: newName });
      setIsEditing(false);
    }
  };

  if (!userProfile) return null;

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
        className="bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full border border-slate-700 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white mb-4 shadow-lg overflow-hidden">
            {userProfile.photoURL ? (
              <img src={userProfile.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              userProfile.displayName.charAt(0).toUpperCase()
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
              <h2 className="text-2xl font-bold text-white">{userProfile.displayName}</h2>
              <button
                onClick={() => setIsEditing(true)}
                className="text-slate-400 hover:text-blue-400 transition-colors"
              >
                <Edit2 size={16} />
              </button>
            </div>
          )}
          
          {userProfile.isPremium && (
            <span className="mt-2 px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full border border-yellow-500/50 flex items-center gap-1">
              <Trophy size={12} /> PREMIUM MEMBER
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex flex-col items-center">
            <Trophy className="text-yellow-400 mb-2" size={24} />
            <span className="text-2xl font-bold text-white">{userProfile.wins}</span>
            <span className="text-xs text-slate-400 uppercase tracking-wider">Wins</span>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex flex-col items-center">
            <Swords className="text-red-400 mb-2" size={24} />
            <span className="text-2xl font-bold text-white">{userProfile.losses}</span>
            <span className="text-xs text-slate-400 uppercase tracking-wider">Losses</span>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex flex-col items-center">
            <History className="text-blue-400 mb-2" size={24} />
            <span className="text-2xl font-bold text-white">{userProfile.gamesPlayed}</span>
            <span className="text-xs text-slate-400 uppercase tracking-wider">Games</span>
          </div>
        </div>

        <div className="text-center text-slate-500 text-xs">
          Member since {new Date().getFullYear()}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Profile;
