import { useRef, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const { pathname } = useLocation();
  const prevPathRef = useRef(pathname);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;

    // Check reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    setOpacity(0);
    // Two-frame RAF to ensure the opacity:0 is painted before transitioning in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setOpacity(1);
      });
    });
  }, [pathname]);

  return (
    <div
      style={{
        opacity,
        transition: opacity === 1 ? 'opacity 150ms ease-out' : 'none',
      }}
    >
      {children}
    </div>
  );
}
