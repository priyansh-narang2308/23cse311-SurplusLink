import { Outlet, Navigate } from 'react-router-dom';
import { UserRole } from '@/types';

import { useAuth } from '@/contexts/auth-context';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { AppSidebar } from './app-sidebar';
import { Sun, Moon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/theme-context';
import { LanguageSelector } from '@/components/common/language-selector';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DashboardLayoutProps {
    requiredRole?: UserRole;
}

export function DashboardLayout({ requiredRole }: DashboardLayoutProps) {
    const { isAuthenticated, role, isLoading } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { isOnline, isSyncing } = useOfflineSync();

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && role !== requiredRole) {
        return <Navigate to="/unauthorized" replace />;
    }

    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full bg-background font-sans selection:bg-primary/20">
                <AppSidebar role={(role || 'donor') as UserRole} />

                <SidebarInset className="flex flex-col flex-1 min-w-0">
                    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/50 px-4 sticky top-0 bg-background/80 backdrop-blur-md z-10">
                        <div className="flex items-center gap-2">
                            <SidebarTrigger className="-ml-1 " />
                            <Separator orientation="vertical" className="mx-2 h-4 hidden md:block" />


                        </div>
                        <div className="flex items-center gap-4">
                            {!isOnline && (
                                <Badge variant="destructive" className="gap-1.5 animate-pulse uppercase text-[9px] font-black">
                                    <WifiOff size={12} />
                                    Offline
                                </Badge>
                            )}
                            {isSyncing && (
                                <div className="flex items-center gap-2 text-primary font-black text-[9px] uppercase animate-bounce">
                                    <RefreshCw size={14} className="animate-spin" />
                                    Syncing
                                </div>
                            )}
                            <LanguageSelector />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleTheme}
                                className="rounded-full hover:bg-primary/10 transition-colors"
                            >
                                {theme === 'light' ? (
                                    <Moon className="h-[1.2rem] w-[1.2rem] transition-all" />
                                ) : (
                                    <Sun className="h-[1.2rem] w-[1.2rem] transition-all" />
                                )}
                            </Button>
                            <h1 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{requiredRole} workspace</h1>
                        </div>
                    </header>
                    <main className="flex-1 overflow-auto p-4 lg:p-8">
                        <div className="max-w-7xl mx-auto w-full">
                            <Outlet />
                        </div>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}
