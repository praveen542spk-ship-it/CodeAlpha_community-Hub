import { useState, useEffect } from 'react';
import { motion, animate } from 'framer-motion';

export function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18, mass: 0.8 }}
      className="w-full min-h-screen"
    >
      {children}
    </motion.div>
  );
}

export function ChunkyProgressBar({ label = 'Loading' }) {
  const [segments, setSegments] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSegments((prev) => (prev + 1) % 11);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 w-64 font-display">
      <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">{label}</span>
      <div className="w-full h-8 bg-black border-4 border-white flex p-1 gap-1 shadow-[4px_4px_0px_0px_#000]">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-full transition-all duration-100 ${
              i < segments ? 'bg-yellow-400 border border-black' : 'bg-transparent'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function JitterText({ text = 'Connecting...' }) {
  const [xShift, setXShift] = useState(0);
  const [yShift, setYShift] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setXShift(Math.floor(Math.random() * 5) - 2);
      setYShift(Math.floor(Math.random() * 3) - 1);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.span
      animate={{ x: xShift, y: yShift }}
      transition={{ type: 'just' }}
      className="text-xs text-yellow-400 font-bold uppercase tracking-widest font-mono"
    >
      {text}
    </motion.span>
  );
}

export function Odometer({ value }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const controls = animate(displayValue, value, {
      type: 'spring',
      stiffness: 150,
      damping: 15,
      onUpdate: (latest) => {
        setDisplayValue(Math.round(latest));
      }
    });
    return () => controls.stop();
  }, [value]);

  return <span className="font-mono tracking-tight">{displayValue}</span>;
}

export function StampEffect({ children, className = '' }) {
  return (
    <motion.div
      initial={{ scale: 1.35, rotate: -2, boxShadow: '0px 0px 0px rgba(0,0,0,0)' }}
      animate={{ scale: 1, rotate: 0, boxShadow: '4px 4px 0px 0px #000' }}
      transition={{ type: 'spring', stiffness: 350, damping: 15 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MicWaveform({ analyser, micEnabled }) {
  const [amplitudes, setAmplitudes] = useState([15, 15, 15, 15, 15]);

  useEffect(() => {
    if (!micEnabled || !analyser) {
      setAmplitudes([15, 15, 15, 15, 15]);
      return;
    }

    const interval = setInterval(() => {
      try {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        const numBars = 5;
        const step = Math.floor(dataArray.length / numBars) || 1;
        const newAmplitudes = Array.from({ length: numBars }).map((_, i) => {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += dataArray[i * step + j] || 0;
          }
          const val = sum / step;
          return Math.min(100, Math.max(15, (val / 255) * 100));
        });

        setAmplitudes(newAmplitudes);
      } catch (e) {
        // Fallback
        setAmplitudes([15, 15, 15, 15, 15]);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [analyser, micEnabled]);

  return (
    <div className="flex items-end gap-1 h-5 px-1.5 min-w-[32px] justify-center">
      {amplitudes.map((amp, i) => (
        <motion.div
          key={i}
          animate={{ height: `${amp}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 14 }}
          className="w-1 bg-yellow-400 border border-black"
          style={{ minHeight: '3px' }}
        />
      ))}
    </div>
  );
}

const letterVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1, 
    transition: { type: 'spring', stiffness: 450, damping: 14 } 
  }
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04
    }
  }
};

export function StaggerHeading({ text, className = '', children }) {
  const letters = Array.from(text);
  return (
    <motion.h2 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`${className} flex items-center`}
    >
      {children}
      <span className="flex">
        {letters.map((char, index) => (
          <motion.span 
            key={index} 
            variants={letterVariants} 
            className="inline-block"
            style={{ whiteSpace: char === ' ' ? 'pre' : 'normal' }}
          >
            {char}
          </motion.span>
        ))}
      </span>
    </motion.h2>
  );
}
