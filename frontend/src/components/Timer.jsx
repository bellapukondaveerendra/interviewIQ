import React, { useState, useEffect, useRef } from 'react';

export default function Timer({ durationSeconds = 900, onExpire }) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const intervalRef = useRef(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpire && onExpire();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [onExpire]);

  const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
  const secs = (remaining % 60).toString().padStart(2, '0');
  const urgent = remaining <= 120;

  return (
    <div className={`timer${urgent ? ' urgent' : ''}`}>
      ⏱ {mins}:{secs}
    </div>
  );
}
