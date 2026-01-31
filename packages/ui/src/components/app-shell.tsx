import * as React from 'react';
import { cn } from '../utils';

export interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Header component to render at the top */
  header?: React.ReactNode;
  /** Sidebar component to render on the left */
  sidebar?: React.ReactNode;
  /** Footer component to render at the bottom */
  footer?: React.ReactNode;
  /** Main content */
  children: React.ReactNode;
  /** Whether the sidebar is currently open (for responsive layouts) */
  sidebarOpen?: boolean;
}

const AppShell = React.forwardRef<HTMLDivElement, AppShellProps>(
  ({ className, header, sidebar, footer, children, sidebarOpen = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex min-h-screen flex-col bg-background', className)}
        {...props}
      >
        {/* Header */}
        {header && (
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            {header}
          </header>
        )}

        {/* Main layout with sidebar and content */}
        <div className="flex flex-1">
          {/* Sidebar - hidden on mobile, visible on desktop */}
          {sidebar && (
            <aside
              className={cn(
                'hidden border-r bg-background transition-all duration-300 ease-in-out md:block',
                sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
              )}
            >
              {sidebar}
            </aside>
          )}

          {/* Main content area */}
          <main className="flex flex-1 flex-col">
            <div className="flex-1">{children}</div>
          </main>
        </div>

        {/* Footer */}
        {footer && (
          <footer className="border-t bg-background">
            {footer}
          </footer>
        )}
      </div>
    );
  }
);
AppShell.displayName = 'AppShell';

export { AppShell };
