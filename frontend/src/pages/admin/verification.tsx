import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/common/page-header';
import { CheckCircle2, XCircle, FileSearch, Building2, Mail, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

interface PendingUser {
    id: string;
    name: string;
    email: string;
    role: string;
    organization?: string;
    taxId?: string;
    documentUrl?: string;
    status: string;
}

export default function VerificationPage() {
    const [users, setUsers] = useState<PendingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [remarks, setRemarks] = useState<{ [key: string]: string }>({});
    const { toast } = useToast();

    const filteredUsers = (users || []).filter(user =>
        user && (
            (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.organization || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const fetchPendingUsers = useCallback(async () => {
        try {
            const res = await api.get('/users/admin/pending');
            setUsers(res.data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch pending verifications',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchPendingUsers();
    }, [fetchPendingUsers]);

    const handleVerify = async (userId: string, status: 'approved' | 'rejected') => {
        setProcessingId(userId);
        try {
            await api.post('/admin/verify-user', {
                userId,
                status,
                remarks: remarks[userId] || '',
            });
            toast({
                title: 'Success',
                description: `User has been ${status}`,
            });
            setUsers(users.filter(u => u.id !== userId));
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Verification failed',
                variant: 'destructive',
            });
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="space-y-8">
            <PageHeader
                title="Identity Verification"
                description="Review and approve organization documentation and tax IDs."
            />

            {loading ? (
                <div className="grid gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 w-full bg-muted animate-pulse rounded-2xl" />
                    ))}
                </div>
            ) : users.length === 0 ? (
                <Card className="border-dashed border-2 flex flex-col items-center justify-center p-12 text-center">
                    <div className="p-4 rounded-full bg-primary/10 text-primary mb-4">
                        <CheckCircle2 size={32} />
                    </div>
                    <CardTitle>Queue Empty</CardTitle>
                    <p className="text-muted-foreground mt-2">All pending verifications have been processed.</p>
                </Card>
            ) : (
                <div className="grid gap-6">
                    <AnimatePresence>
                        {filteredUsers.map(user => (
                            <motion.div
                                key={user.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                            >
                                <Card className="overflow-hidden border-border/50">
                                    <div className="grid md:grid-cols-3">
                                        <div className="p-6 md:col-span-2 border-r border-border/50 bg-muted/10">
                                            <div className="flex items-start justify-between mb-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                                        <Building2 className="text-primary" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-lg">{user.organization || user.name}</h3>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                            <Mail size={12} />
                                                            {user.email}
                                                            <Badge variant="secondary" className="ml-2 uppercase text-[10px] font-black">
                                                                {user.role}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid sm:grid-cols-2 gap-4 mb-6">
                                                <div className="p-4 rounded-xl bg-background border border-border/50">
                                                    <p className="text-[10px] font-black text-muted-foreground uppercase opacity-50 mb-1">Tax ID / Registration</p>
                                                    <code className="text-sm font-bold text-primary">{user.taxId || 'NOT_PROVIDED'}</code>
                                                </div>
                                                <div className="p-4 rounded-xl bg-background border border-border/50 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[10px] font-black text-muted-foreground uppercase opacity-50 mb-1">Legal Document</p>
                                                        <p className="text-sm font-bold">Verification_Doc.pdf</p>
                                                    </div>
                                                    {user.documentUrl ? (
                                                        <Button variant="ghost" size="icon" asChild>
                                                            <a href={user.documentUrl} target="_blank" rel="noreferrer">
                                                                <ExternalLink size={16} />
                                                            </a>
                                                        </Button>
                                                    ) : (
                                                        <FileSearch className="text-muted-foreground opacity-20" />
                                                    )}
                                                </div>
                                            </div>

                                            <Textarea
                                                placeholder="Add internal notes or rejection reason..."
                                                className="bg-background/50 text-sm h-20 resize-none rounded-xl"
                                                value={remarks[user.id] || ''}
                                                onChange={(e) => setRemarks({ ...remarks, [user.id]: e.target.value })}
                                            />
                                        </div>

                                        <div className="p-6 flex flex-col justify-center gap-3 bg-muted/5">
                                            <Button
                                                className="w-full h-12 rounded-xl gap-2 font-black uppercase text-xs"
                                                onClick={() => handleVerify(user.id, 'approved')}
                                                disabled={processingId === user.id}
                                            >
                                                <CheckCircle2 size={16} />
                                                Approve User
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="w-full h-12 rounded-xl gap-2 font-black uppercase text-xs border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500"
                                                onClick={() => handleVerify(user.id, 'rejected')}
                                                disabled={processingId === user.id}
                                            >
                                                <XCircle size={16} />
                                                Reject Identity
                                            </Button>
                                            <p className="text-[10px] text-center text-muted-foreground mt-2">
                                                Verification logs will be recorded in audit history.
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
