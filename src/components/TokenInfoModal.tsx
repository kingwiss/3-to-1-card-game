import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TokenInfoModal: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const showCountStr = localStorage.getItem('tokenInfoShownCount');
    const showCount = showCountStr ? parseInt(showCountStr, 10) : 0;

    // Show the modal the first few times (e.g., 3 times)
    if (showCount < 3) {
      // Show after 3 to 5 seconds
      const delay = Math.floor(Math.random() * 2000) + 3000;
      const timer = setTimeout(() => {
        setIsVisible(true);
        localStorage.setItem('tokenInfoShownCount', (showCount + 1).toString());
      }, delay);

      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsVisible(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-gradient-to-br from-blue-500 to-teal-400 p-8 rounded-3xl shadow-2xl max-w-md w-full text-white relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-full h-full bg-white/10 pointer-events-none"></div>
            
            <div className="relative z-10 text-center">
              <h2 className="text-3xl font-bold mb-4 drop-shadow-md">Tokens & Rewards</h2>
              <p className="text-lg leading-relaxed mb-8 drop-shadow-sm font-medium">
                You will be able to use the tokens you earn while playing the games to redeem prizes and special offers in the future.
              </p>
              <button
                onClick={() => setIsVisible(false)}
                className="px-8 py-3 bg-white text-blue-600 font-bold rounded-full shadow-lg hover:bg-blue-50 transition-colors active:scale-95"
              >
                Got it!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TokenInfoModal;
