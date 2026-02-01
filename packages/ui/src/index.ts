/**
 * @app/ui - Shared UI components
 *
 * Exports:
 * - Base components (Button, Card, Input, etc.)
 * - Composite components
 * - Styles and utilities
 */

// Utils
export { cn } from './utils';

// Base components
export { Button, buttonVariants, type ButtonProps } from './components/button';
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from './components/card';
export { Input, type InputProps } from './components/input';
export { Label } from './components/label';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/tabs';
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from './components/tooltip';
export { Skeleton } from './components/skeleton';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './components/dialog';
export { Badge, badgeVariants, type BadgeProps } from './components/badge';

// Market components
export { MarketCard, type MarketCardProps } from './components/market-card';
export { SearchInput, type SearchInputProps } from './components/search-input';
export { CategoryTabs, type Category, type CategoryTabsProps } from './components/category-tabs';

// Layout components
export { AppShell, type AppShellProps } from './components/app-shell';
export { Container, containerVariants, type ContainerProps } from './components/container';
export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarNav,
  SidebarNavItem,
  type SidebarProps,
} from './components/sidebar';
export {
  MobileNav,
  MobileNavHeader,
  MobileNavContent,
  MobileNavFooter,
  MobileNavLink,
  type MobileNavProps,
} from './components/mobile-nav';

// Hooks
export { useCountdown } from './hooks/use-countdown';

// Toast
export {
  Toaster,
  toast,
  useToast,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  ToastViewport,
  type ToastProps,
  type ToastActionElement,
  type ToastInput,
} from './components/toast';

// Styles
export * from './styles';
