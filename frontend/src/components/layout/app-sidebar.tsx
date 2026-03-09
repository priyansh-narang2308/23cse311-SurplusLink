import * as React from "react"
import {
    Home,
    PlusCircle,
    List,
    Bell,
    BarChart3,
    MapPin,
    CheckSquare,
    Users,
    MessageSquare,
    FileText,
    Truck,
    ShieldCheck,
    ChevronsUpDown,
    LogOut,
    User as UserIcon,
    Settings,
    Sparkles,
    Circle,
    Zap,
    ShieldAlert,
    AlertTriangle
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { motion, AnimatePresence } from "framer-motion"
import api from "@/lib/api"
import { cn } from "@/lib/utils"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
    SidebarRail,
    useSidebar,
} from "@/components/ui/sidebar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Logo } from "@/components/ui/logo"
import { useAuth } from "@/contexts/auth-context"
import { useNotifications } from "@/contexts/notification-context"
import { UserRole } from "@/types"
import { Link, useLocation, useNavigate } from "react-router-dom"

const navItemsByRole = {
    donor: [
        { label: "Dashboard", href: "/donor", icon: Home },
        { label: "Post Donation", href: "/donor/post", icon: PlusCircle },
        { label: "My Donations", href: "/donor/donations", icon: List },
        { label: "Notifications", href: "/donor/notifications", icon: Bell },
        { label: "Reports", href: "/donor/reports", icon: FileText },
        { label: "Impact Summary", href: "/donor/impact", icon: BarChart3 },
        { label: "Location Settings", href: "/donor/settings", icon: Settings },
    ],
    ngo: [
        { label: "Dashboard", href: "/ngo", icon: Home },
        { label: "Smart Feed", href: "/ngo/nearby", icon: Sparkles },
        { label: "Accepted Donations", href: "/ngo/accepted", icon: CheckSquare },
        { label: "Volunteer Availablity", href: "/ngo/fleet", icon: Truck },
        { label: "Notifications", href: "/ngo/notifications", icon: Bell },
        // { label: "Feedback", href: "/ngo/feedback", icon: MessageSquare },
        { label: "Settings", href: "/ngo/settings", icon: Settings },
    ],
    admin: [
        { label: "Dashboard", href: "/admin", icon: Home },
        { label: "User Directory", href: "/admin/users", icon: Users },
        { label: "KYC Hub", href: "/admin/verification", icon: ShieldCheck },
        { label: "Safety Rules", href: "/admin/safety", icon: ShieldAlert },
        { label: "Audit Trail", href: "/admin/audit", icon: List },
        { label: "Task Rescue", href: "/admin/tasks", icon: AlertTriangle },
        { label: "System Reports", href: "/admin/reports", icon: FileText },
        { label: "Volunteer Fleet", href: "/admin/volunteers", icon: Zap },
        { label: "Food Safety Report", href: "/admin/food-safety", icon: ShieldAlert },
    ],
    volunteer: [
        { label: "Dashboard", href: "/volunteer", icon: Home },
        { label: "Active Mission", href: "/volunteer/active", icon: Truck },
        { label: "Available Jobs", href: "/volunteer/available", icon: MapPin },
        { label: "Mission History", href: "/volunteer/history", icon: List },
        { label: "Vehicle Settings", href: "/volunteer/settings", icon: Settings },
    ],
}

export function AppSidebar({ role }: { role: UserRole }) {
    const { user, logout, toggleOnlineStatus } = useAuth()
    const { unreadCount } = useNotifications()
    const { state } = useSidebar()
    const location = useLocation()
    const navigate = useNavigate()
    const [showLogoutDialog, setShowLogoutDialog] = React.useState(false)
    const [pendingCount, setPendingCount] = React.useState(0)
    const [nearbyCount, setNearbyCount] = React.useState(0)
    const isOnline = user?.isOnline || false
    const navItems = navItemsByRole[role] || []

    const fetchPending = React.useCallback(async () => {
        if (role === 'admin') {
            try {
                const { data } = await api.get('/users/admin/pending');
                const nonAdminPending = data.filter((u: { role: string }) => u.role !== 'admin');
                setPendingCount(nonAdminPending.length);
            } catch (error) {
                console.error('Error fetching pending count:', error);
            }
        }
        if (role === 'ngo') {
            try {
                const { data } = await api.get('/donations/feed');
                setNearbyCount(data.count || 0);
            } catch (error) {
                console.error('Error fetching nearby count:', error);
            }
        }
    }, [role]);

    React.useEffect(() => {
        fetchPending();
        const interval = setInterval(fetchPending, 15000);
        return () => clearInterval(interval);
    }, [role, fetchPending]);

    const isCollapsed = state === "collapsed"

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="h-16 flex items-center justify-center border-b border-border/50 p-0 overflow-hidden">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild className="h-16 w-full hover:bg-transparent active:bg-transparent p-0">
                            <Link to="/" className={cn("flex items-center justify-center w-full", !isCollapsed && "px-4")}>
                                <Logo size="md" showText={!isCollapsed} />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup className="pt-4">
                    {role === 'volunteer' && !isCollapsed && (
                        <div className="px-4 mb-6">
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-xl border transition-all duration-300",
                                    "bg-background/50 backdrop-blur-sm",
                                    isOnline ? "border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]" : "border-slate-800"
                                )}
                            >
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Status</span>
                                    <div className="flex items-center gap-2">
                                        <div className={cn("h-2 w-2 rounded-full", isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-500")} />
                                        <span className="text-sm font-bold">{isOnline ? "Online" : "Offline"}</span>
                                    </div>
                                </div>
                                <Switch
                                    checked={isOnline}
                                    onCheckedChange={toggleOnlineStatus}
                                    className="data-[state=checked]:bg-emerald-500"
                                />
                            </motion.div>
                        </div>
                    )}
                    <SidebarGroupLabel>Platform</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={location.pathname === item.href}
                                        tooltip={item.label}
                                        size="lg"
                                        className="h-12 group-data-[collapsible=icon]:justify-center"
                                    >
                                        <Link
                                            to={item.href}
                                            className={cn(
                                                "flex items-center w-full px-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center relative",
                                                ((item.label === "Notifications" && unreadCount > 0) ||
                                                    (item.label === "Smart Feed" && nearbyCount > 0)) && "animate-blink text-primary"
                                            )}
                                        >
                                            <item.icon className={cn(
                                                "!size-5 shrink-0",
                                                ((item.label === "Notifications" && unreadCount > 0) ||
                                                    (item.label === "Smart Feed" && nearbyCount > 0)) ? "text-primary" : ""
                                            )} />
                                            <span className="text-sm font-medium ml-3 group-data-[collapsible=icon]:hidden">
                                                {item.label}
                                            </span>
                                            {(item.label === "Notifications" && unreadCount > 0) && (
                                                <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] flex items-center justify-center group-data-[collapsible=icon]:hidden">
                                                    {unreadCount}
                                                </span>
                                            )}
                                            {(item.label === "Smart Feed" && nearbyCount > 0) && (
                                                <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] flex items-center justify-center group-data-[collapsible=icon]:hidden">
                                                    {nearbyCount}
                                                </span>
                                            )}
                                            {item.label === "User Management" && pendingCount > 0 && (
                                                <span className="ml-auto flex h-2 w-2 rounded-full bg-orange-500 animate-pulse group-data-[collapsible=icon]:hidden" />
                                            )}
                                            {(item.label === "Notifications" || item.label === "Smart Feed" || item.label === "User Management") &&
                                                (unreadCount > 0 || nearbyCount > 0 || pendingCount > 0) && isCollapsed && (
                                                    <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                                                )}
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {!isCollapsed && (
                    <SidebarGroup className="mt-auto px-4 pb-4">
                        <SidebarGroupContent>
                            <div className="rounded-2xl bg-primary/5 p-5 border border-primary/10 transition-all hover:bg-primary/10">
                                <p className="text-[11px] font-bold text-primary uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                    <Sparkles className="size-3.5 fill-primary/20" />
                                    Pro Tip
                                </p>
                                <p className="text-[13px] text-muted-foreground leading-relaxed font-medium">
                                    {role === 'donor' && 'Post donations early for faster pickup matches.'}
                                    {role === 'ngo' && 'Accept nearby donations first for quicker delivery.'}
                                    {role === 'volunteer' && 'Safety first! Always check food timestamps.'}
                                    {role === 'admin' && 'Monitor KPIs daily to ensure system efficiency.'}
                                </p>
                            </div>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    size="lg"
                                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
                                >
                                    <Avatar className="h-8 w-8 rounded-lg">
                                        <AvatarImage src={user?.avatar} alt={user?.name} />
                                        <AvatarFallback className="rounded-lg">
                                            {user?.name?.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                                        <span className="truncate font-semibold">{user?.organization || user?.name}</span>
                                        <span className="truncate text-xs text-muted-foreground uppercase tracking-wider font-bold">
                                            {user?.role}
                                        </span>
                                    </div>
                                    <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                                side="bottom"
                                align="end"
                                sideOffset={4}
                            >
                                <DropdownMenuLabel className="p-0 font-normal">
                                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                        <Avatar className="h-8 w-8 rounded-lg">
                                            <AvatarImage src={user?.avatar} alt={user?.name} />
                                            <AvatarFallback className="rounded-lg">
                                                {user?.name?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="grid flex-1 text-left text-sm leading-tight">
                                            <span className="truncate font-semibold">{user?.organization || user?.name}</span>
                                            <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                                        </div>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                    <DropdownMenuItem onClick={() => navigate('/account')} className="cursor-pointer">
                                        <UserIcon className="mr-2 size-4" />
                                        Account
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => {
                                            const path = user?.role === 'ngo' ? '/ngo/settings' :
                                                user?.role === 'volunteer' ? '/volunteer/settings' :
                                                    user?.role === 'donor' ? '/donor/settings' : '/settings';
                                            navigate(path);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <Settings className="mr-2 size-4" />
                                        Settings
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => setShowLogoutDialog(true)} className="text-destructive cursor-pointer hover:bg-white/80 ">
                                    <LogOut className="mr-2 size-4" />
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />

            <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                <AlertDialogContent className="rounded-2xl border-border/50 backdrop-blur-md bg-card/95">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-bold tracking-tight">Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground font-medium">
                            This will end your current session and you will need to sign in again to access your workspace.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-wider h-11 border-none hover:bg-muted transition-colors">
                            Stay Signed In
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={logout}
                            className="rounded-xl font-bold uppercase tracking-wider h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all shadow-lg shadow-destructive/20"
                        >
                            Log Out
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Sidebar>
    )
}
