import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Filter, Loader2, Plus, Target, Trash2, X } from 'lucide-react';
import { getCampaigns, deleteCampaign } from '@/features/campaigns/campaignService';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const CATEGORIES = ['all', 'medical', 'urgent', 'harambee', 'education', 'celebration'];

export default function CampaignsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: campaigns, isLoading, refetch } = useQuery({
    queryKey: ['campaigns'],
    queryFn: getCampaigns,
  });

  const filteredCampaigns = useMemo(() => {
    if (filter === 'all') return campaigns;
    return campaigns?.filter((c: any) => c.category === filter);
  }, [campaigns, filter]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Permanently delete this campaign?')) return;
    setDeletingId(id);
    try {
      await deleteCampaign(parseInt(id));
      refetch();
    } catch (err) {
      alert('Failed to delete. Check permissions.');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-2xl font-bold text-foreground">Manage Campaigns</h1>
          <Button onClick={() => navigate('/campaigns/create')} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> New Goal
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn("whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-all", filter === cat ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "bg-white/5 text-muted-foreground hover:bg-white/10")}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCampaigns?.map((campaign: any) => {
            const progress = Math.min((campaign.current_amount / campaign.target_amount) * 100, 100);
            const isDeleting = deletingId === campaign.id;

            return (
              <motion.div key={campaign.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} whileHover={{ y: -5 }} className="group cursor-pointer" onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                <Card className="h-full border-white/10 bg-card/50 transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline" className="mb-2 border-primary/30 text-primary">{campaign.category}</Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={(e) => handleDelete(e, campaign.id)} disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                    <CardTitle className="line-clamp-1 text-xl">{campaign.title}</CardTitle>
                    <p className="line-clamp-2 text-sm text-muted-foreground mt-2">{campaign.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs font-bold text-muted-foreground mb-2">
                          <span>{Math.round(progress)}% Raised</span>
                          <span>KES {campaign.current_amount.toLocaleString()}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">??</div>
                          {campaign.beneficiary_name || 'Anonymous'}
                        </div>
                        <div className="text-primary group-hover:translate-x-1 transition-transform">?</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {filteredCampaigns?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Target className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <h3 className="text-xl font-bold text-foreground">No campaigns found</h3>
            <p className="text-muted-foreground mt-2">Create your first fundraising goal today.</p>
          </div>
        )}
      </main>
    </div>
  );
}

