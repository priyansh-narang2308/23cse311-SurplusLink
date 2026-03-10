import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/common/stat-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    RefreshCw, FileDown, AlertTriangle, TrendingUp, Package, Leaf, Users, ShieldAlert, CheckCircle2
} from 'lucide-react';
import ReportService from '@/services/report.service';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { UtilizationRecord } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const REJECTION_COLORS = {
    'Safety Concerns': '#ef4444', // Red
    'Logistics': '#f59e0b',       // Amber
    'Other': '#6366f1'           // Indigo
};

const CHART_COLORS = ['#ef4444', '#f59e0b', '#6366f1', '#10b981', '#3b82f6', '#f472b6'];

export default function NgoImpactReport() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [data, setData] = useState<UtilizationRecord | null>(null);
    const [masterList, setMasterList] = useState<UtilizationRecord[]>([]);
    const [selectedNgoId, setSelectedNgoId] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();

    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            if (isAdmin && selectedNgoId === 'all') {
                const results = await ReportService.getNgoUtilizationMasterList();
                setMasterList(results);
                setData(null);
            } else {
                const ngoId = isAdmin ? (selectedNgoId === 'all' ? undefined : selectedNgoId) : undefined;
                const report = await ReportService.getNgoUtilization(ngoId);
                setData(report);
            }

            if (isRefresh) {
                toast({ title: "Updated", description: "Dashboard data refreshed successfully" });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to load utilization report",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [isAdmin, selectedNgoId, toast]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => fetchData(true), 60000); // 60s poll
        return () => clearInterval(interval);
    }, [fetchData]);

    const exportToCSV = () => {
        if (!data) return;

        const headers = ["Date", "Units (kg)", "Capacity (kg)"];
        const rows = data.dailyUtilization.map(u => [u.date, u.units, u.capacity]);

        const csvContent = [
            headers.join(","),
            ...rows.map(e => e.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `ngo_utilization_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const successRate = data ? (data.summary.totalClaims > 0 ? (data.summary.completed / data.summary.totalClaims) * 100 : 0) : 0;
    const totalWastePrevention = data?.dailyUtilization.reduce((acc, curr) => acc + curr.units, 0) || 0;
    const utilizationRate = data?.summary.utilizationRate || 0;

    const filteredMasterList = masterList.filter(item =>
        item.ngoName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && !data && masterList.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center px-4">
                    <Skeleton className="h-10 w-64" />
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-24" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-[2rem]" />)}
                </div>
                <div className="px-4">
                    <Skeleton className="h-[400px] w-full rounded-[2rem]" />
                </div>
            </div>
        );
    }

    const renderMasterList = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="Total Rescues"
                    value={masterList.reduce((acc, curr) => acc + curr.summary.totalClaims, 0)}
                    icon={<Package className="h-5 w-5" />}
                    description="Network wide activities"
                />
                <StatCard
                    title="Avg Success Rate"
                    value={`${(masterList.reduce((acc, curr) => acc + (curr.summary.totalClaims > 0 ? (curr.summary.completed / curr.summary.totalClaims) * 100 : 0), 0) / (masterList.length || 1)).toFixed(1)}%`}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    description="Network average"
                />
                <StatCard
                    title="Urgent Rescues"
                    value={masterList.reduce((acc, curr) => acc + curr.summary.urgentRescues, 0)}
                    icon={<ShieldAlert className="h-5 w-5 text-red-500" />}
                    description="Critical interventions"
                />
            </div>

            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>NGO Performance Matrix</CardTitle>
                        <CardDescription>Consolidated utilization and reliability data</CardDescription>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Find organization..."
                            className="pl-9 rounded-xl h-10 border-none bg-muted/50"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="border-none">
                                    <TableHead className="font-bold">Organization</TableHead>
                                    <TableHead className="text-center font-bold">Total Claims</TableHead>
                                    <TableHead className="text-center font-bold">Rescues</TableHead>
                                    <TableHead className="text-center font-bold">Rejections</TableHead>
                                    <TableHead className="text-center font-bold">Current Load</TableHead>
                                    <TableHead className="text-right font-bold w-[100px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredMasterList.map((ngo) => (
                                    <TableRow key={ngo.ngoId} className="border-muted/20 hover:bg-muted/10 transition-colors">
                                        <TableCell className="font-bold text-slate-900">{ngo.ngoName}</TableCell>
                                        <TableCell className="text-center">{ngo.summary.totalClaims}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="success" className="bg-emerald-500/10 text-emerald-600 border-none">
                                                {ngo.summary.completed}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 border-none">
                                                {ngo.summary.rejected}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-xs font-bold">{ngo.summary.utilizationRate}%</span>
                                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={cn("h-full", ngo.summary.utilizationRate > 80 ? "bg-red-500" : "bg-emerald-500")}
                                                        style={{ width: `${Math.min(ngo.summary.utilizationRate, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelectedNgoId(ngo.ngoId || 'all')}
                                                className="hover:text-primary"
                                            >
                                                Details
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <PageHeader
                    title={isAdmin ? "Global Utilization Monitoring" : "NGO Impact Analytics"}
                    description={isAdmin ? "Monitor network-wide capacity and organization reliability." : "Real-time distribution efficiency and capacity monitoring."}
                />
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <Select value={selectedNgoId} onValueChange={setSelectedNgoId}>
                            <SelectTrigger className="w-[200px] h-10 rounded-xl bg-white shadow-sm border-none">
                                <SelectValue placeholder="Select Organization" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-xl">
                                <SelectItem value="all">Network Overview</SelectItem>
                                {masterList.map(ngo => (
                                    <SelectItem key={ngo.ngoId} value={ngo.ngoId || 'all'}>{ngo.ngoName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                        className="h-10 rounded-xl bg-white border-none shadow-sm"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    {data && (
                        <Button variant="default" size="sm" onClick={exportToCSV} className="h-10 rounded-xl shadow-lg shadow-primary/20">
                            <FileDown className="h-4 w-4 mr-2" />
                            Export CSV
                        </Button>
                    )}
                </div>
            </div>

            {isAdmin && selectedNgoId === 'all' ? (
                renderMasterList()
            ) : data ? (
                /* Existing detailed report UI */
                <>
                    {utilizationRate > 90 && (
                        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive animate-pulse rounded-2xl">
                            <ShieldAlert className="h-4 w-4" />
                            <AlertTitle className="font-bold">Capacity Alarm</AlertTitle>
                            <AlertDescription className="font-medium">
                                Organization is currently at {utilizationRate}% capacity. Consider re-routing new claims or increasing temporary storage.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Top Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="Success Rate"
                            value={`${successRate.toFixed(1)}%`}
                            icon={<CheckCircle2 className="h-5 w-5" />}
                            description="Claimed vs. Delivered"
                        />
                        <StatCard
                            title="Total Rescues"
                            value={data.summary.totalClaims}
                            icon={<Package className="h-5 w-5" />}
                            description="Total claims handled"
                        />
                        <StatCard
                            title="Waste Prevention"
                            value={`${totalWastePrevention.toFixed(1)} kg`}
                            icon={<Leaf className="h-5 w-5 text-emerald-500" />}
                            description="Total weight handled"
                        />
                        <Card className="relative overflow-hidden rounded-[2rem] border-none shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest text-[10px]">Capacity Status</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="text-3xl font-black">{utilizationRate}%</div>
                                    <Badge variant={utilizationRate > 80 ? "destructive" : utilizationRate > 50 ? "warning" : "success"} className="rounded-lg h-5 px-1.5 text-[8px] font-black uppercase tracking-tighter">
                                        {utilizationRate > 80 ? "Near Limit" : utilizationRate > 50 ? "Optimal" : "Healthy"}
                                    </Badge>
                                </div>
                                <div className="mt-4 w-full bg-muted rounded-full h-2">
                                    <div
                                        className={cn(
                                            "h-2 rounded-full transition-all duration-500",
                                            utilizationRate > 90 ? 'bg-red-500' : utilizationRate > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                                        )}
                                        style={{ width: `${Math.min(utilizationRate, 100)}%` }}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Rejection Analysis */}
                        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                                    Rejection Analysis
                                </CardTitle>
                                <CardDescription>Primary reasons for rejected donation claims</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[350px]">
                                {data.rejectionBreakdown.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={data.rejectionBreakdown}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={80}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="count"
                                                nameKey="reason"
                                                stroke="none"
                                            >
                                                {data.rejectionBreakdown.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={REJECTION_COLORS[entry.reason as keyof typeof REJECTION_COLORS] || CHART_COLORS[index % CHART_COLORS.length]}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                                            />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground font-medium italic">
                                        No rejections recorded.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Daily Throughput */}
                        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                                    Daily Throughput
                                </CardTitle>
                                <CardDescription>Trend of food distribution volume</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.dailyUtilization}>
                                        <defs>
                                            <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                        <XAxis
                                            dataKey="date"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                                            tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                        />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="units"
                                            stroke="#10b981"
                                            strokeWidth={4}
                                            fillOpacity={1}
                                            fill="url(#colorUnits)"
                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="capacity"
                                            stroke="#cbd5e1"
                                            strokeDasharray="8 8"
                                            fill="none"
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </>
            ) : (
                /* NGO has no data state */
                <div className="h-[70vh] flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="bg-muted p-6 rounded-full">
                        <Package className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h2 className="text-2xl font-bold">No Missions Handled Yet</h2>
                    <p className="text-muted-foreground max-w-sm">
                        Start claiming and completing donations to see your impact and utilization metrics here.
                    </p>
                    <Button onClick={() => window.location.href = '/ngo/nearby'} className="rounded-xl px-8">
                        View Nearby Donations
                    </Button>
                </div>
            )}
        </div>
    );
}
