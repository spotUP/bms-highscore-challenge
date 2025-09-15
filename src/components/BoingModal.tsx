import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BoingModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

const BoingModal: React.FC<BoingModalProps> = ({ isOpen, onClose, children, className = '', title }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
      // Keep modal visible until animation completes
      const timeout = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isVisible) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          isAnimating ? 'opacity-75' : 'opacity-0'
        }`}
      />

      {/* Modal Content */}
      <div
        className={`
          relative z-10 rounded-lg shadow-xl border
          ${isAnimating ? 'boing-modal-enter' : 'boing-modal-exit'}
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button - always present */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4 text-white" />
          <span className="sr-only">Close</span>
        </button>

        {/* Header with title (if provided) */}
        {title && (
          <div className="flex items-center justify-between p-6 pb-4">
            <h2 className="animated-gradient text-xl font-semibold">
              {title}
            </h2>
          </div>
        )}

        {/* Content */}
        <div className={title ? "px-6 pb-6" : "p-6"} style={{ opacity: isAnimating ? 1 : 0 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BoingModal;