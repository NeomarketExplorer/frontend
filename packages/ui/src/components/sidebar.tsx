'use client';

import * as React from 'react';
import { cn } from '../utils';

export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** Callback when sidebar toggle is triggered */
  onToggle?: () => void;
  /** Sidebar content */
  children: React.ReactNode;
  /** Width of the sidebar when open */
  width?: string;
}

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ className, isOpen, onToggle, children, width = 'w-64', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative flex h-full flex-col border-r bg-background transition-all duration-300 ease-in-out',
          isOpen ? width : 'w-0 overflow-hidden',
          className
        )}
        {...props}
      >
        {/* Sidebar content */}
        <div
          className={cn(
            'flex h-full flex-col overflow-y-auto transition-opacity duration-200',
            isOpen ? 'opacity-100' : 'opacity-0'
          )}
        >
          {children}
        </div>

        {/* Toggle button */}
        {onToggle && (
          <button
            onClick={onToggle}
            className={cn(
              'absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-md transition-transform hover:bg-accent',
              !isOpen && 'right-0 translate-x-full'
            )}
            aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                'transition-transform duration-200',
                isOpen ? 'rotate-0' : 'rotate-180'
              )}
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);
Sidebar.displayName = 'Sidebar';

/* Sidebar sub-components */
const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex h-14 items-center border-b px-4', className)}
    {...props}
  />
));
SidebarHeader.displayName = 'SidebarHeader';

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex-1 overflow-y-auto p-4', className)}
    {...props}
  />
));
SidebarContent.displayName = 'SidebarContent';

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('border-t p-4', className)}
    {...props}
  />
));
SidebarFooter.displayName = 'SidebarFooter';

const SidebarNav = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    className={cn('flex flex-col gap-1', className)}
    {...props}
  />
));
SidebarNav.displayName = 'SidebarNav';

const SidebarNavItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { active?: boolean }
>(({ className, active, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
      active && 'bg-accent text-accent-foreground',
      className
    )}
    {...props}
  />
));
SidebarNavItem.displayName = 'SidebarNavItem';

export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarNav,
  SidebarNavItem,
};
