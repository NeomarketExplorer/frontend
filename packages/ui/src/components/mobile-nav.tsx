'use client';

import * as React from 'react';
import { cn } from '../utils';

export interface MobileNavProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether the mobile nav is open */
  isOpen: boolean;
  /** Callback when close is triggered */
  onClose: () => void;
  /** Navigation content */
  children: React.ReactNode;
  /** Side from which the drawer slides in */
  side?: 'left' | 'right';
}

const MobileNav = React.forwardRef<HTMLDivElement, MobileNavProps>(
  ({ className, isOpen, onClose, children, side = 'left', ...props }, ref) => {
    // Lock body scroll when open
    React.useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => {
        document.body.style.overflow = '';
      };
    }, [isOpen]);

    // Handle escape key
    React.useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isOpen) {
          onClose();
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    return (
      <>
        {/* Backdrop overlay */}
        <div
          className={cn(
            'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity duration-300 md:hidden',
            isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Drawer panel */}
        <div
          ref={ref}
          className={cn(
            'fixed inset-y-0 z-50 flex w-3/4 max-w-sm flex-col border-r bg-background shadow-lg transition-transform duration-300 ease-in-out md:hidden',
            side === 'left' ? 'left-0' : 'right-0 border-l border-r-0',
            isOpen
              ? 'translate-x-0'
              : side === 'left'
                ? '-translate-x-full'
                : 'translate-x-full',
            className
          )}
          {...props}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Close navigation"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          {/* Content */}
          <div className="flex h-full flex-col overflow-y-auto pt-14">
            {children}
          </div>
        </div>
      </>
    );
  }
);
MobileNav.displayName = 'MobileNav';

/* Mobile Nav sub-components */
const MobileNavHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center border-b px-6 py-4', className)}
    {...props}
  />
));
MobileNavHeader.displayName = 'MobileNavHeader';

const MobileNavContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex-1 overflow-y-auto px-6 py-4', className)}
    {...props}
  />
));
MobileNavContent.displayName = 'MobileNavContent';

const MobileNavFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('border-t px-6 py-4', className)}
    {...props}
  />
));
MobileNavFooter.displayName = 'MobileNavFooter';

const MobileNavLink = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { active?: boolean }
>(({ className, active, ...props }, ref) => (
  <a
    ref={ref}
    className={cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
      active && 'bg-accent text-accent-foreground',
      className
    )}
    {...props}
  />
));
MobileNavLink.displayName = 'MobileNavLink';

export {
  MobileNav,
  MobileNavHeader,
  MobileNavContent,
  MobileNavFooter,
  MobileNavLink,
};
