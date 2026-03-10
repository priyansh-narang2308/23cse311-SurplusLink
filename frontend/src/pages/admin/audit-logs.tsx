import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Filter, History, User as UserIcon, Activity, Database } from 'lucide-react';
import { format } from 'date-fns';
import api from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

interface AuditLog {
    _id: string;
    action: string;
    category: string;
    userId: {
        name: string;
        email: string;
        role: string;
    };
    metadata: Record<string, unknown>;
    createdAt: string;
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();

    const fetchLogs = useCallback(async () => {
        try {
            const res = await api.get('/admin/audit-logs');
            setLogs(res.data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch audit logs',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const getCategoryBadge = (category: string) => {
        const styles: { [key: string]: string } = {
            verification: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
            safety: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
            user: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
            donation: 'bg-green-500/10 text-green-500 border-green-500/20',
        };
        return (
            <Badge variant="outline" className={`capitalize font-bold rounded-lg ${styles[category] || ''}`}>
                {category}
            </Badge>
        );
    };

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.userId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
        log.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8">
            <PageHeader
                title="Audit Trail"
                description="Immutable history of critical system actions and administrative changes."
            />

            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                        placeholder="Search by action, user, or category..."
                        className="pl-12 h-12 rounded-2xl bg-muted/30 border-none focus-visible:ring-primary"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" className="h-12 w-12 rounded-2xl p-0 border-border/50">
                    <Filter size={18} />
                </Button>
            </div>

            <Card className="border-border/50 overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="border-border/50 hover:bg-transparent">
                            <TableHead className="text-[10px] font-black uppercase text-muted-foreground py-4">Timestamp</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-muted-foreground py-4">Actor</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-muted-foreground py-4">Category</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-muted-foreground py-4">Action Event</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-muted-foreground py-4">Details</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            [1, 2, 3, 4, 5].map(i => (
                                <TableRow key={i} className="animate-pulse">
                                    <TableCell colSpan={5} className="py-8"><div className="h-4 w-full bg-muted rounded" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                                    No audit logs found matching your criteria.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredLogs.map(log => (
                                <TableRow key={log._id} className="border-border/50 group hover:bg-muted/10 transition-colors">
                                    <TableCell className="py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold">{format(new Date(log.createdAt), 'MMM dd, HH:mm')}</span>
                                            <span className="text-[10px] text-muted-foreground font-medium">{format(new Date(log.createdAt), 'yyyy')}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <UserIcon size={14} className="text-primary" />
                                            </div>
                                             <div className="min-w-0">
                                                <p className="text-sm font-bold truncate">{log.userId?.name || 'Unknown User'}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase font-black">{log.userId?.role || 'Deleted'}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        {getCategoryBadge(log.category)}
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                            <span className="text-xs font-black uppercase tracking-tight">{log.action.replace(/_/g, ' ')}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="max-w-[300px] truncate">
                                            <pre className="text-[10px] bg-muted/50 p-1.5 rounded-lg border border-border/50 font-mono text-muted-foreground">
                                                {JSON.stringify(log.metadata)}
                                            </pre>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
