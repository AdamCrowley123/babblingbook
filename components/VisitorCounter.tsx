import React, { useState, useEffect } from 'react';

const VisitorCounter: React.FC = () => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const key = 'babbling-book-visitor-count';
    // This timeout prevents hydration errors in some React setups,
    // and defers the non-critical count update slightly.
    const timer = setTimeout(() => {
      try {
        let currentCount = localStorage.getItem(key);
        let newCount: number;

        if (currentCount) {
          newCount = parseInt(currentCount, 10) + 1;
        } else {
          // Simulate a higher starting number to look more impressive
          newCount = Math.floor(Math.random() * (2500 - 800 + 1)) + 800;
        }
        
        localStorage.setItem(key, String(newCount));
        setCount(newCount);

      } catch (error) {
        console.error("Could not access localStorage for visitor count.", error);
        // Set a fallback count if localStorage is disabled
        setCount(1);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  const formattedCount = count !== null ? count.toLocaleString() : '...';

  return (
    <div className="text-center text-xs text-gray-400">
      <p>Visitor #</p>
      <p className="text-lg font-bold text-gray-200 tracking-wider animate-fade-in-down">{formattedCount}</p>
    </div>
  );
};

export default VisitorCounter;
