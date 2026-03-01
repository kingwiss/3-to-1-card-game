import React from 'react';
import { motion } from 'framer-motion';
import { X, Check, Star, Crown, Zap, Palette, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface PremiumModalProps {
  onClose: () => void;
}

const PremiumModal: React.FC<PremiumModalProps> = ({ onClose }) => {
  const { user, userProfile } = useAuth();

  const handleSubscribe = async () => {
    if (!user) {
      alert('Please login to subscribe!');
      return;
    }

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
        }),
      });

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start checkout process.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative w-full max-w-4xl bg-slate-900 rounded-3xl border border-yellow-500/30 shadow-[0_0_50px_rgba(234,179,8,0.2)] overflow-hidden flex flex-col md:flex-row"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-slate-400 hover:text-white transition-colors bg-black/50 rounded-full p-2"
        >
          <X size={24} />
        </button>

        {/* Left Side - Visuals */}
        <div className="w-full md:w-2/5 bg-gradient-to-br from-yellow-900 via-yellow-600 to-yellow-800 p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-black/60"></div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/20 border border-yellow-400/50 text-yellow-200 text-xs font-bold mb-6">
              <Crown size={14} /> PREMIUM ACCESS
            </div>
            <h2 className="text-4xl font-extrabold text-white mb-2 drop-shadow-lg">
              Unlock the <br />
              <span className="text-yellow-300">Ultimate</span> <br />
              Experience
            </h2>
          </div>

          <div className="relative z-10 mt-8 space-y-4">
            <div className="flex items-center gap-4 bg-black/30 p-3 rounded-xl backdrop-blur-sm border border-white/10">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Palette className="text-white" size={24} />
              </div>
              <div>
                <h4 className="font-bold text-white">Exclusive Themes</h4>
                <p className="text-xs text-yellow-100/80">Customize your game board</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-black/30 p-3 rounded-xl backdrop-blur-sm border border-white/10">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center shadow-lg">
                <Sparkles className="text-white" size={24} />
              </div>
              <div>
                <h4 className="font-bold text-white">Special Cards</h4>
                <p className="text-xs text-yellow-100/80">Golden & Permanent cards</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Comparison */}
        <div className="w-full md:w-3/5 p-8 bg-slate-900">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">Choose Your Plan</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            {/* Free Plan */}
            <div className="p-4 rounded-2xl border border-slate-700 bg-slate-800/50 flex flex-col items-center opacity-70 hover:opacity-100 transition-opacity">
              <span className="text-slate-400 font-bold mb-2">Free</span>
              <span className="text-2xl font-bold text-white mb-4">$0</span>
              <ul className="space-y-3 text-sm text-slate-300 w-full">
                <li className="flex items-center gap-2"><Check size={14} className="text-green-500" /> Basic Gameplay</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-green-500" /> Standard Deck</li>
                <li className="flex items-center gap-2"><X size={14} className="text-slate-500" /> No Special Cards</li>
                <li className="flex items-center gap-2"><X size={14} className="text-slate-500" /> Basic Themes Only</li>
              </ul>
            </div>

            {/* Premium Plan */}
            <div className="p-4 rounded-2xl border-2 border-yellow-500 bg-slate-800 relative flex flex-col items-center transform scale-105 shadow-xl">
              <div className="absolute -top-3 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                RECOMMENDED
              </div>
              <span className="text-yellow-400 font-bold mb-2">Premium</span>
              <span className="text-3xl font-bold text-white mb-4">$4.99<span className="text-sm text-slate-400 font-normal">/mo</span></span>
              <ul className="space-y-3 text-sm text-white w-full">
                <li className="flex items-center gap-2"><Check size={14} className="text-yellow-400" /> All Game Modes</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-yellow-400" /> Golden Cards</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-yellow-400" /> Permanent Cards</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-yellow-400" /> All Themes Unlocked</li>
              </ul>
            </div>
          </div>

          {userProfile?.isPremium ? (
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/create-portal-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: user?.email }),
                  });
                  const { url } = await response.json();
                  if (url) window.location.href = url;
                } catch (error) {
                  console.error('Error opening portal:', error);
                  alert('Failed to open subscription portal.');
                }
              }}
              className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              Manage Subscription
            </button>
          ) : (
            <button
              onClick={handleSubscribe}
              className="w-full py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold text-lg rounded-xl shadow-lg shadow-yellow-500/20 transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
              <Zap size={20} fill="currentColor" />
              Upgrade to Premium
            </button>
          )}
          <p className="text-center text-slate-500 text-xs mt-4">
            Secure payment via Stripe. Cancel anytime.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default PremiumModal;
