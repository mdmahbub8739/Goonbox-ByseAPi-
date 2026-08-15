import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import clsx from 'clsx';

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Add a throttle/debounce or simple passive listener for scroll
    const toggleVisibility = () => {
      if (window.scrollY > 400) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={clsx(
        "fixed right-4 bottom-[64px] z-50 p-3 rounded-full bg-gradient-to-tr from-[#ff0033] to-[#ff3366] text-white shadow-lg shadow-[#ff0033]/40 transition-all duration-500 ease-out active:scale-90 hover:scale-110",
        isVisible 
          ? "opacity-100 translate-y-0" 
          : "opacity-0 translate-y-12 pointer-events-none"
      )}
      aria-label="Scroll to top"
      title="Back to top"
    >
      <ArrowUp className="w-5 h-5" strokeWidth={3} />
    </button>
  );
}
