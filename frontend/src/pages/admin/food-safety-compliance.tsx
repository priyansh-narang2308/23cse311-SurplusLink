import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    TooltipProps,
} from 'recharts';
import {
    ShieldAlert,
    AlertTriangle,
    XCircle,
    CheckCircle2,
    Download,
    Search,
    Clock,
    UserX,
    FileWarning,
    Activity,
    Filter,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { format, parseISO, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SafetyRejection {
    _id: string;
    donationId: { _id: string; title?: string; foodType?: string } | null;
    ngoId: { _id: string; name?: string; organization?: string } | null;
    rejectionReason: string;
    isSafetyIssue: boolean;
    createdAt: string;
}

interface UnsafeDonation {
    _id: string;
    title?: string;
    foodType?: string;
    status: string;
    expiryDate?: string;
    donor?: { name?: string; organization?: string };
    createdAt: string;
}

interface UserViolation {
    _id: string;
    userId?: { name?: string; email?: string } | null;
    adminId?: { name?: string } | null;
    violationType?: string;
    description?: string;
    createdAt: string;
}

interface VerificationEntry {
    _id: string;
    userId?: { name?: string; organization?: string; email?: string } | null;
    adminId?: { name?: string } | null;
    status?: string;
    action?: string;
    createdAt: string;
}

interface GovernanceAction {
    _id: string;
    userId?: { name?: string } | null;
    category?: string;
    action?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
}

interface SafetyReportSummary {
    totalSafetyRejections: number;
    expiredEntries: number;
    violationsRecorded: number;
    pendingVerifications: number;
    totalGovernanceActions: number;
}

interface SafetyReport {
    success: boolean;
    summary: SafetyReportSummary;
    data: {
        safetyRejections: SafetyRejection[];
        unsafeDonations: UnsafeDonation[];
        userViolations: UserViolation[];
        verificationHistory: VerificationEntry[];
        governanceActions: GovernanceAction[];
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#EF4444', '#F97316', '#EAB308', '#8B5CF6', '#06B6D4'];

const TAB_OPTIONS = [
    { id: 'rejections', label: 'Safety Rejections', icon: ShieldAlert },
    { id: 'unsafe', label: 'Expired / Unsafe', icon: FileWarning },
    { id: 'violations', label: 'Violations', icon: UserX },
    { id: 'verifications', label: 'Verifications', icon: CheckCircle2 },
    { id: 'governance', label: 'Governance', icon: Activity },
] as const;

type TabId = (typeof TAB_OPTIONS)[number]['id'];

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-card/95 backdrop-blur-md p-4 border border-border/50 shadow-2xl rounded-2xl">
                <p className="text-xs font-black text-foreground mb-3 uppercase tracking-widest border-b border-border/50 pb-2">
                    {label}
                </p>
                {payload.map((entry, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color ?? '#EF4444' }} />
                        <span className="text-muted-foreground font-bold">{entry.name}:</span>
                        <span className="font-extrabold text-foreground ml-auto">{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="relative">
                <div className="absolute inset-0 bg-destructive/5 rounded-full scale-150 animate-pulse" />
                <div className="relative bg-card p-6 rounded-full shadow-lg border border-border">
                    <Search className="h-10 w-10 text-muted-foreground/40" />
                </div>
            </div>
            <div className="text-center">
                <h3 className="text-lg font-bold text-foreground">No records found</h3>
                <p className="text-muted-foreground max-w-[200px] mt-1 text-sm">{message}</p>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FoodSafetyCompliance() {
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState<SafetyReport | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>('rejections');
    const [search, setSearch] = useState('');
    const [datePreset, setDatePreset] = useState('30');

    const dateRange = useMemo(() => {
        const to = new Date();
        const from = subDays(to, parseInt(datePreset));
        return {
            startDate: format(from, 'yyyy-MM-dd'),
            // Include the full end-of-day so today's records are not cut off at midnight
            endDate: format(to, 'yyyy-MM-dd') + 'T23:59:59',
        };
    }, [datePreset]);

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            try {
                const res = await api.get('/reports/safety-compliance', { params: dateRange });
                setReport(res.data);
            } catch (err) {
                console.error('Failed to load safety compliance report:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [dateRange]);

    // ── Filtered table data ──────────────────────────────────────────────────
    const filteredRejections = useMemo(() => {
        if (!report) return [];
        const q = search.toLowerCase();
        return report.data.safetyRejections.filter(r =>
            (r.ngoId?.name ?? '').toLowerCase().includes(q) ||
            (r.ngoId?.organization ?? '').toLowerCase().includes(q) ||
            r.rejectionReason.toLowerCase().includes(q)
        );
    }, [report, search]);

    const filteredUnsafe = useMemo(() => {
        if (!report) return [];
        const q = search.toLowerCase();
        return report.data.unsafeDonations.filter(d =>
            (d.title ?? '').toLowerCase().includes(q) ||
            (d.foodType ?? '').toLowerCase().includes(q) ||
            (d.donor?.name ?? '').toLowerCase().includes(q)
        );
    }, [report, search]);

    const filteredViolations = useMemo(() => {
        if (!report) return [];
        const q = search.toLowerCase();
        return report.data.userViolations.filter(v =>
            (v.userId?.name ?? '').toLowerCase().includes(q) ||
            (v.violationType ?? '').toLowerCase().includes(q) ||
            (v.description ?? '').toLowerCase().includes(q)
        );
    }, [report, search]);

    const filteredVerifications = useMemo(() => {
        if (!report) return [];
        const q = search.toLowerCase();
        return report.data.verificationHistory.filter(v =>
            (v.userId?.name ?? '').toLowerCase().includes(q) ||
            (v.userId?.organization ?? '').toLowerCase().includes(q) ||
            (v.status ?? '').toLowerCase().includes(q)
        );
    }, [report, search]);

    const filteredGovernance = useMemo(() => {
        if (!report) return [];
        const q = search.toLowerCase();
        return report.data.governanceActions.filter(g =>
            (g.userId?.name ?? '').toLowerCase().includes(q) ||
            (g.category ?? '').toLowerCase().includes(q) ||
            (g.action ?? '').toLowerCase().includes(q)
        );
    }, [report, search]);

    // ── Chart data ───────────────────────────────────────────────────────────
    const summaryPieData = useMemo(() => {
        if (!report) return [];
        const s = report.summary;
        return [
            { name: 'Safety Rejections', value: s.totalSafetyRejections },
            { name: 'Expired/Unsafe', value: s.expiredEntries },
            { name: 'Violations', value: s.violationsRecorded },
            { name: 'Pending Verif.', value: s.pendingVerifications },
            { name: 'Gov. Actions', value: s.totalGovernanceActions },
        ].filter(d => d.value > 0);
    }, [report]);

    const barData = useMemo(() => {
        if (!report) return [];
        return [
            { name: 'Safety Rej.', count: report.summary.totalSafetyRejections },
            { name: 'Expired', count: report.summary.expiredEntries },
            { name: 'Violations', count: report.summary.violationsRecorded },
            { name: 'Pend. Verif.', count: report.summary.pendingVerifications },
            { name: 'Gov. Actions', count: report.summary.totalGovernanceActions },
        ];
    }, [report]);

    // ── CSV Export ───────────────────────────────────────────────────────────
    const handleExport = () => {
        if (!report) return;
        const rows: string[][] = [['Category', 'Count']];
        rows.push(
            ['Safety Rejections', String(report.summary.totalSafetyRejections)],
            ['Expired/Unsafe Donations', String(report.summary.expiredEntries)],
            ['Violations Recorded', String(report.summary.violationsRecorded)],
            ['Pending Verifications', String(report.summary.pendingVerifications)],
            ['Governance Actions', String(report.summary.totalGovernanceActions)],
        );
        const csv = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csv));
        link.setAttribute('download', `food_safety_compliance_${format(new Date(), 'yyyyMMdd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ── Loading skeleton ─────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="max-w-[1400px] mx-auto space-y-8">
                <div className="space-y-4">
                    <Skeleton className="h-10 w-72 rounded-xl" />
                    <Skeleton className="h-4 w-96 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
                <Skeleton className="h-[400px] rounded-2xl" />
            </div>
        );
    }

    const s = report?.summary;

    return (
        <div className="max-w-[1400px] mx-auto space-y-8">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <PageHeader
                    title="Food Safety & Compliance"
                    description="Audit trail of safety rejections, violations, verifications, and governance actions."
                />
                <div className="flex items-center gap-3 flex-wrap">
                    <Select value={datePreset} onValueChange={setDatePreset}>
                        <SelectTrigger id="date-range-select" className="h-10 w-36 rounded-xl text-xs font-bold">
                            <Filter className="h-3 w-3 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Time Range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                            <SelectItem value="90">Last 90 days</SelectItem>
                            <SelectItem value="365">Last year</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button id="export-csv-btn" onClick={handleExport} className="h-10 rounded-xl text-xs font-black uppercase tracking-widest px-5">
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard
                    title="Safety Rejections"
                    value={s?.totalSafetyRejections ?? 0}
                    icon={ShieldAlert}
                    subtext="Flagged unsafe by NGOs"
                />
                <StatCard
                    title="Expired / Unsafe"
                    value={s?.expiredEntries ?? 0}
                    icon={AlertTriangle}
                    subtext="Donations past expiry"
                />
                <StatCard
                    title="Violations"
                    value={s?.violationsRecorded ?? 0}
                    icon={UserX}
                    subtext="Admin-logged incidents"
                />
                <StatCard
                    title="Pending Verif."
                    value={s?.pendingVerifications ?? 0}
                    icon={Clock}
                    subtext="Awaiting KYC review"
                />
                <StatCard
                    title="Gov. Actions"
                    value={s?.totalGovernanceActions ?? 0}
                    icon={Activity}
                    subtext="Safety & system events"
                />
            </div>

            {/* ── Charts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
                {/* Bar Chart */}
                <Card className="lg:col-span-6 border-border/50 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="pb-2 border-b border-border/50">
                        <CardTitle className="text-lg font-extrabold flex items-center gap-2 text-foreground">
                            <ShieldAlert className="h-5 w-5 text-destructive" />
                            Compliance Breakdown
                        </CardTitle>
                        <CardDescription className="font-medium text-muted-foreground">
                            Incidents by category for selected period
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] pt-4">
                            {barData.every(d => d.count === 0) ? (
                                <EmptyState message="No incidents in the selected period" />
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={barData}>
                                        <defs>
                                            <linearGradient id="safetyBarGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#EF4444" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#B91C1C" stopOpacity={1} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 700 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 700 }} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--destructive) / 0.05)', radius: 8 }} />
                                        <Bar dataKey="count" name="Count" fill="url(#safetyBarGrad)" radius={[6, 6, 0, 0]} barSize={45} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Pie Chart */}
                <Card className="lg:col-span-4 border-border/50 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="pb-2 border-b border-border/50">
                        <CardTitle className="text-lg font-extrabold flex items-center gap-2 text-foreground">
                            <XCircle className="h-5 w-5 text-destructive" />
                            Incident Distribution
                        </CardTitle>
                        <CardDescription className="font-medium text-muted-foreground">
                            Share by type
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] flex flex-col items-center justify-center">
                            {summaryPieData.length === 0 ? (
                                <EmptyState message="All clear — no incidents!" />
                            ) : (
                                <>
                                    <ResponsiveContainer width="100%" height="80%">
                                        <PieChart>
                                            <Pie
                                                data={summaryPieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={65}
                                                outerRadius={95}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {summaryPieData.map((_, i) => (
                                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                                        {summaryPieData.map((entry, i) => (
                                            <div key={i} className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{entry.name}</span>
                                                <span className="text-xs font-extrabold text-foreground">{entry.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Detail Tables ── */}
            <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-border/50">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle className="text-lg font-extrabold text-foreground">Incident Log</CardTitle>
                            <CardDescription className="font-medium text-muted-foreground">Detailed records — switch tabs to explore each category</CardDescription>
                        </div>
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                            <Input
                                id="incident-search"
                                placeholder="Search records..."
                                className="pl-9 h-10 w-56 rounded-xl text-sm"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Tab bar */}
                    <div className="flex gap-1 flex-wrap mt-4">
                        {TAB_OPTIONS.map(tab => (
                            <button
                                key={tab.id}
                                id={`tab-${tab.id}`}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all',
                                    activeTab === tab.id
                                        ? 'bg-destructive text-destructive-foreground shadow-md'
                                        : 'text-muted-foreground hover:bg-muted'
                                )}
                            >
                                <tab.icon className="h-3.5 w-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </CardHeader>

                <CardContent className="p-0">

                    {/* Safety Rejections */}
                    {activeTab === 'rejections' && (
                        filteredRejections.length === 0 ? <EmptyState message="No safety rejections in this period" /> : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-border/50">
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">NGO</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Reason</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground text-center">Safety Flag</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRejections.map(r => (
                                            <TableRow key={r._id} className="border-border/30 hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-semibold text-sm">
                                                    {r.ngoId?.organization ?? r.ngoId?.name ?? '—'}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                                                    {r.rejectionReason}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn(
                                                            'text-[10px] font-black uppercase tracking-widest',
                                                            r.isSafetyIssue
                                                                ? 'bg-destructive/10 text-destructive border-destructive/20'
                                                                : 'bg-muted text-muted-foreground'
                                                        )}
                                                    >
                                                        {r.isSafetyIssue ? '⚠ Safety' : 'Other'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {format(parseISO(r.createdAt), 'MMM dd, yyyy HH:mm')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )
                    )}

                    {/* Expired / Unsafe Donations */}
                    {activeTab === 'unsafe' && (
                        filteredUnsafe.length === 0 ? <EmptyState message="No expired or unsafe donations" /> : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-border/50">
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Donation</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Donor</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground text-center">Status</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Posted</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredUnsafe.map(d => (
                                            <TableRow key={d._id} className="border-border/30 hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-semibold text-sm">
                                                    {d.title ?? d.foodType ?? '—'}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {d.donor?.organization ?? d.donor?.name ?? '—'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn(
                                                            'text-[10px] font-black uppercase tracking-widest',
                                                            d.status === 'expired'
                                                                ? 'bg-muted text-muted-foreground border-border'
                                                                : 'bg-destructive/10 text-destructive border-destructive/20'
                                                        )}
                                                    >
                                                        {d.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {format(parseISO(d.createdAt), 'MMM dd, yyyy')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )
                    )}

                    {/* Violations */}
                    {activeTab === 'violations' && (
                        filteredViolations.length === 0 ? <EmptyState message="No violations recorded" /> : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-border/50">
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">User</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Type</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Description</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Logged By</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredViolations.map(v => (
                                            <TableRow key={v._id} className="border-border/30 hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-semibold text-sm">{v.userId?.name ?? '—'}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-600 border-orange-400/20">
                                                        {v.violationType ?? 'Unknown'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">{v.description ?? '—'}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{v.adminId?.name ?? '—'}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {format(parseISO(v.createdAt), 'MMM dd, yyyy')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )
                    )}

                    {/* Verifications */}
                    {activeTab === 'verifications' && (
                        filteredVerifications.length === 0 ? <EmptyState message="No verification history found" /> : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-border/50">
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Organization</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground text-center">Status</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Action</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Reviewed By</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredVerifications.map(v => (
                                            <TableRow key={v._id} className="border-border/30 hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-semibold text-sm">
                                                    {v.userId?.organization ?? v.userId?.name ?? '—'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn(
                                                            'text-[10px] font-black uppercase tracking-widest',
                                                            v.status === 'approved'
                                                                ? 'bg-primary/10 text-primary border-primary/20'
                                                                : v.status === 'rejected'
                                                                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                                                                    : 'bg-amber-500/10 text-amber-600 border-amber-400/20'
                                                        )}
                                                    >
                                                        {v.status ?? 'Pending'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {v.action === 'awaiting_kyc' ? (
                                                        <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                                                            <Clock className="h-3 w-3" />
                                                            Awaiting KYC
                                                        </span>
                                                    ) : (v.action ?? '—')}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{v.adminId?.name ?? '—'}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {format(parseISO(v.createdAt), 'MMM dd, yyyy')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )
                    )}

                    {/* Governance */}
                    {activeTab === 'governance' && (
                        filteredGovernance.length === 0 ? <EmptyState message="No governance actions logged" /> : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-border/50">
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Admin</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Category</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Action</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Details</TableHead>
                                            <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredGovernance.map(g => (
                                            <TableRow key={g._id} className="border-border/30 hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-semibold text-sm">{g.userId?.name ?? 'System'}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-600 border-purple-400/20">
                                                        {g.category ?? '—'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm font-medium">{g.action?.replace(/_/g, ' ') ?? '—'}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                                    {g.metadata ? Object.entries(g.metadata).map(([k, v]) => `${k}: ${v}`).join(', ') : '—'}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {format(parseISO(g.createdAt), 'MMM dd, yyyy')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )
                    )}

                </CardContent>
            </Card>
        </div>
    );
}
