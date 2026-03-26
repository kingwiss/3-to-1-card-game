import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { playSound } from '../utils/sound';

interface TokenAnimationProps {
  id: string;
  amount: number;
  startX: number;
  startY: number;
  onComplete: (id: string) => void;
  reason: string;
}

const Spark: React.FC<{ delay: number; x: number; y: number }> = ({ delay, x, y }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0 }}
    animate={{ 
      scale: [0, 2, 0], 
      opacity: [0, 1, 0],
      rotate: [0, 45, 90]
    }}
    transition={{ 
      duration: 0.4, 
      delay,
      ease: "easeOut" 
    }}
    className="absolute text-yellow-400 pointer-events-none"
    style={{ left: x - 12, top: y - 12 }}
  >
    <Sparkles size={24} fill="currentColor" className="drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
  </motion.div>
);

const TokenAnimation: React.FC<TokenAnimationProps> = ({ id, amount, startX, startY, onComplete, reason }) => {
  const [coins, setCoins] = useState<{index: number, value: number}[]>([]);
  const [showSparks, setShowSparks] = useState(false);

  useEffect(() => {
    // Show exactly 10 coins for small amounts, or up to 10 for larger ones
    const numCoins = amount >= 10 ? 10 : amount;
    setCoins(Array.from({ length: numCoins }).map((_, i) => ({
      index: i,
      value: Math.floor(Math.random() * 3) + 1
    })));

    // Play shuffle sound when animation starts
    playSound('coinShuffle');

    // Start showing sparks after the first coin hits (approx 0.8s)
    const sparkTimer = setTimeout(() => {
        setShowSparks(true);
    }, 800);

    // Play land sound for each coin as it hits the target
    const soundTimers = Array.from({ length: numCoins }).map((_, i) => {
      return setTimeout(() => {
        playSound('coinLand');
      }, 800 + i * 50); // 800ms travel time + 50ms delay per coin
    });

    const timer = setTimeout(() => {
      onComplete(id);
    }, 2500); // Increased duration to account for all sparks

    return () => {
      clearTimeout(timer);
      clearTimeout(sparkTimer);
      soundTimers.forEach(t => clearTimeout(t));
    };
  }, [amount, id, onComplete, reason]);

  // Target is top right (profile picture center)
  const targetX = window.innerWidth - 36;
  const targetY = 36;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      <AnimatePresence>
        {coins.map((coin) => (
          <motion.div
            key={`${id}-${coin.index}`}
            initial={{
              x: startX,
              y: startY,
              scale: 0,
              opacity: 0,
            }}
            animate={{
              x: [startX, targetX],
              y: [startY, targetY],
              scale: [0, 1.2, 1, 0.5],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 0.8,
              ease: "easeIn",
              delay: coin.index * 0.05,
              times: [0, 0.2, 0.8, 1]
            }}
            className="absolute w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              transformStyle: 'preserve-3d',
              perspective: '1000px',
              boxShadow: '0 10px 20px rgba(0,0,0,0.5)'
            }}
          >
            <motion.div
              animate={{ rotateY: [0, 360] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
              className="w-full h-full rounded-full flex flex-col items-center justify-center relative"
              style={{
                background: 'radial-gradient(ellipse at top left, #00f2fe 0%, #4facfe 40%, #0062cc 100%)',
                boxShadow: 'inset 0 0 8px rgba(255, 255, 255, 0.8), inset 0 0 20px rgba(0, 98, 204, 0.8), 0 4px 6px rgba(0,0,0,0.5)',
                border: '2px solid #0056b3'
              }}
            >
              {/* Inner ring for 3D effect */}
              <div className="absolute inset-[3px] rounded-full border-[1.5px] border-[#00f2fe] opacity-70" style={{ boxShadow: 'inset 0 0 5px rgba(0,0,0,0.3)' }}></div>
              
              <div className="flex flex-col items-center justify-center h-full w-full z-10 text-[#002a5c]" style={{ textShadow: '1px 1px 0px rgba(255,255,255,0.5)' }}>
                <span className="text-[20px] font-black leading-none">{coin.value}</span>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Sparks when coins hit */}
      {showSparks && coins.map((coin) => (
        <Spark 
          key={`spark-${id}-${coin.index}`} 
          delay={coin.index * 0.08} 
          x={targetX} 
          y={targetY} 
        />
      ))}
      
      {/* Floating Text for Amount */}
      <motion.div
        initial={{ x: startX, y: startY, opacity: 0, scale: 0.5 }}
        animate={{ y: startY - 100, opacity: [0, 1, 0], scale: [0.5, 1.2, 1] }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute text-2xl font-bold text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
        style={{ left: startX, top: startY }}
      >
        +{amount} Tokens!
      </motion.div>
    </div>
  );
};

export default TokenAnimation;
