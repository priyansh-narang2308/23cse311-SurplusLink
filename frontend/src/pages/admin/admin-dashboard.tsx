/** Central administrative dashboard for system-wide oversight */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Truck, AlertTriangle, Building2, UserCircle, Sparkles, Leaf } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import DonationService from '@/services/donation.service';
import { User, SystemConfig, SystemHealth } from '@/types';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ShieldAlert, Activity } from 'lucide-react';

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        pendingApprovals: 0,
        activeDonors: 0,
        activeNgos: 0,
        donationsToday: 0,
        activeRoutes: 0,
        totalMeals: 0,
        totalCo2: 0,
        monthlyData: [] as { month: string; donations: number }[]
    });
    const [config, setConfig] = useState<SystemConfig | null>(null);
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [recentUsers, setRecentUsers] = useState<User[]>([]);
    const [toggling, setToggling] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [userRes, adminRes, impactRes, configRes, healthRes] = await Promise.all([
                    api.get('/users/admin/users'),
                    DonationService.getAdminStats(),
                    api.get('/reports/impact-summary'),
                    api.get('/admin/system-config'),
                    api.get('/admin/health')
                ]);

                const users = userRes.data;
                const pending = users.filter((u: User) => u.status === 'pending' && (u.taxId || u.documentUrl));
                const donors = users.filter((u: User) => u.role === 'donor' && u.status === 'active');
                const ngos = users.filter((u: User) => u.role === 'ngo' && u.status === 'active');

                setStats({
                    totalUsers: users.length,
                    pendingApprovals: pending.length,
                    activeDonors: donors.length,
                    activeNgos: ngos.length,
                    donationsToday: adminRes.donationsToday,
                    activeRoutes: adminRes.activeRoutes,
                    totalMeals: impactRes.data.summary.totalMeals,
                    totalCo2: impactRes.data.summary.totalCo2,
                    monthlyData: adminRes.monthlyData
                });
                setRecentUsers(users.slice(0, 5));
                setConfig(configRes.data);
                setHealth(healthRes.data);
            } catch (error) {
                console.error('Dashboard fetch error:', error);
            }
        };

        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 15000);
        return () => clearInterval(interval);
    }, []);

    const toggleEmergency = async (enabled: boolean) => {
        setToggling(true);
        try {
            const res = await api.post('/admin/emergency-mode', {
                enabled,
                reason: 'Admin Override'
            });
            setConfig(prev => prev ? { ...prev, emergencyMode: res.data.config } : null);
            toast({ title: enabled ? 'EMERGENCY ACTIVE' : 'Emergency Resolved' });
        } catch (error) {
            toast({ title: 'Update Failed', variant: 'destructive' });
        } finally {
            setToggling(false);
        }
    };

    return (
        <div className="space-y-8">
            <PageHeader title="Admin Dashboard" description="System overview.">
                <div className="flex items-center gap-4 bg-muted/50 p-2 rounded-xl px-4">
                    <Label className="text-[10px] font-black uppercase">Emergency</Label>
                    <Switch checked={config?.emergencyMode.enabled} onCheckedChange={toggleEmergency} disabled={toggling} />
                </div>
            </PageHeader>

            {config?.emergencyMode.enabled && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 animate-pulse">
                    <ShieldAlert className="text-red-500" />
                    <p className="text-sm font-black text-red-900 uppercase">Emergency Protocol Engaged - Priority Logistics Active</p>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                <StatCard
                    title="Health"
                    value={health?.status || 'Online'}
                    icon={<Activity className={health?.status === 'Healthy' ? "text-green-500" : "text-red-500"} />}
                />
                <StatCard title="Donations Today" value={stats.donationsToday} icon={<FileText className="h-5 w-5" />} trend={{ value: stats.donationsToday > 0 ? 100 : 0, isPositive: true }} />
                <StatCard title="Total Meals" value={stats.totalMeals.toLocaleString()} icon={<Sparkles className="h-5 w-5" />} />
                <StatCard title="CO₂ Avoided" value={`${stats.totalCo2.toFixed(1)}kg`} icon={<Leaf className="h-5 w-5" />} />
                <StatCard title="Active Routes" value={stats.activeRoutes} icon={<Truck className="h-5 w-5" />} />
                <StatCard
                    title="Pending Approvals"
                    value={stats.pendingApprovals}
                    icon={<AlertTriangle className={cn("h-5 w-5", stats.pendingApprovals > 0 ? "text-orange-500 animate-pulse" : "")} />}
                    trend={stats.pendingApprovals > 0 ? { value: stats.pendingApprovals, isPositive: false } : undefined}
                />
            </div>

            {stats.pendingApprovals > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-orange-500/20 text-orange-600">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-orange-900 text-sm">Quick Action Required</p>
                            <p className="text-orange-800/80 text-xs font-medium">There are {stats.pendingApprovals} new organizations waiting for identity verification.</p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant="hero"
                        className="bg-orange-500 hover:bg-orange-600 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest px-6"
                        onClick={() => navigate('/admin/verification')}
                    >
                        Review KYC
                    </Button>
                </motion.div>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 overflow-hidden border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Donations Over Time</CardTitle>
                            <p className="text-xs text-muted-foreground font-medium mt-1">rescued vs delivered trends</p>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stats.monthlyData}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                    <Line type="monotone" dataKey="donations" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle>Recently Joined</CardTitle>
                        <p className="text-xs text-muted-foreground font-medium mt-1">latest profile activations</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {recentUsers.map(user => (
                            <div key={user.id} className="group p-3 rounded-xl border border-transparent hover:border-border/50 hover:bg-muted/30 transition-all flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    {user.avatar ? <img src={user.avatar} className="h-full w-full rounded-lg object-cover" /> : <UserCircle size={20} className="text-primary" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold truncate">{user.name}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-black flex items-center gap-1.5 min-w-0">
                                        <Building2 size={10} className="shrink-0" />
                                        <span className="truncate">{user.organization || user.role}</span>
                                    </p>
                                </div>
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-black  uppercase shrink-0">
                                    {user.status}
                                </Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
