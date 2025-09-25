import React, { useState } from 'react';
import { useCompetitionStatus } from '@/hooks/useCompetitionStatus';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { useTournament } from '@/contexts/TournamentContext';
import { Clock, Lock, Unlock, Calendar, Trophy, Shield, AlertTriangle, CheckCircle, Edit } from 'lucide-react';
import SystemProblemsModal from '@/components/SystemProblemsModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

const CompetitionStatus: React.FC = () => {
  const { competition, isLocked, loading, error } = useCompetitionStatus();
  const { healthStatus } = useSystemHealth();
  const { currentTournament, hasPermission, updateTournament } = useTournament();
  const { toast } = useToast();
  const [isSystemModalOpen, setIsSystemModalOpen] = useState(false);
  const [isTournamentEditOpen, setIsTournamentEditOpen] = useState(false);
  const [tournamentFormData, setTournamentFormData] = useState({
    name: "",
    slug: "",
    description: "",
    is_public: false,
    start_time: "",
    end_time: "",
    is_active: true,
    scores_locked: false
  });

  // Always render the full container to prevent layout shifts
  if (loading) {
    return (
      <div className="status-bar-stable">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <div className="w-4 h-4 bg-gray-400/30 rounded animate-pulse"></div>
            <span className="animate-pulse">Loading competition status...</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-gray-400 bg-gray-500/20 border border-gray-500/30">
              <div className="w-3 h-3 bg-gray-400/30 rounded animate-pulse"></div>
              <span className="animate-pulse">System...</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-gray-400 bg-gray-500/20 border border-gray-500/30">
              <div className="w-3 h-3 bg-gray-400/30 rounded animate-pulse"></div>
              <span className="animate-pulse">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="status-bar-stable">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="text-red-400 flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${getHealthColor(healthStatus.overall)} cursor-pointer hover:scale-105 transition-transform duration-200`}
              title={`System Health: ${healthStatus.message}\nLast checked: ${new Date(healthStatus.lastChecked).toLocaleTimeString()}\n\nClick for detailed overview`}
              onClick={() => setIsSystemModalOpen(true)}
            >
              {getHealthIcon(healthStatus.overall)}
              <span>System {healthStatus.overall === 'healthy' ? 'OK' : healthStatus.overall}</span>
            </button>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-red-300 bg-red-500/20 border border-red-500/30">
              <Lock className="w-3 h-3" />
              <span>Error</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'text-blue-400';
      case 'active': return 'text-green-400';
      case 'completed': return 'text-gray-400';
      case 'cancelled': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Calendar className="w-4 h-4" />;
      case 'active': return <Trophy className="w-4 h-4" />;
      case 'completed': return <Trophy className="w-4 h-4" />;
      case 'cancelled': return <Trophy className="w-4 h-4" />;
      default: return <Trophy className="w-4 h-4" />;
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getHealthIcon = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-3 h-3" />;
      case 'warning': return <AlertTriangle className="w-3 h-3" />;
      case 'error': return <Shield className="w-3 h-3" />;
      default: return <Shield className="w-3 h-3" />;
    }
  };

  const getHealthColor = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy': return 'text-green-300 bg-green-500/20 border-green-500/30';
      case 'warning': return 'text-yellow-300 bg-yellow-500/20 border-yellow-500/30';
      case 'error': return 'text-red-300 bg-red-500/20 border-red-500/30';
      default: return 'text-gray-300 bg-gray-500/20 border-gray-500/30';
    }
  };

  // Format datetime for input
  const formatDateTimeForInput = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Format datetime for database
  const formatDateTimeForDatabase = (dateTimeLocal: string) => {
    if (!dateTimeLocal) return null;
    return new Date(dateTimeLocal).toISOString();
  };

  // Open edit tournament dialog
  const openEditTournamentDialog = () => {
    if (!currentTournament) return;

    const formData = {
      name: currentTournament.name || "",
      slug: currentTournament.slug || "",
      description: currentTournament.description || "",
      is_public: currentTournament.is_public || false,
      start_time: formatDateTimeForInput(currentTournament.start_time),
      end_time: formatDateTimeForInput(currentTournament.end_time),
      is_active: currentTournament.is_active ?? true,
      scores_locked: currentTournament.scores_locked || false
    };

    setTournamentFormData(formData);
    setIsTournamentEditOpen(true);
  };

  // Handle tournament edit form submission
  const handleEditTournament = async () => {
    if (!currentTournament) return;

    try {
      const success = await updateTournament(currentTournament.id, {
        name: tournamentFormData.name,
        slug: tournamentFormData.slug,
        description: tournamentFormData.description,
        is_public: tournamentFormData.is_public,
        start_time: formatDateTimeForDatabase(tournamentFormData.start_time),
        end_time: formatDateTimeForDatabase(tournamentFormData.end_time),
        is_active: tournamentFormData.is_active,
        scores_locked: tournamentFormData.scores_locked,
      });

      if (success) {
        setIsTournamentEditOpen(false);
      }
    } catch (error) {
      console.error('Error updating tournament:', error);
    }
  };

  return (
    <div className="status-bar-stable">
      <div className="flex flex-wrap items-baseline gap-6 text-sm" style={{ lineHeight: '1.2' }}>
        {competition ? (
          <>
            {/* Competition Status */}
            <div className={`flex items-center gap-2 ${getStatusColor(competition.status)}`}>
              {getStatusIcon(competition.status)}
              <span className="font-semibold capitalize">{competition.status} Competition</span>
              <span className="text-gray-400 mx-1">•</span>
              <span className="text-white font-medium">{competition.name}</span>
            </div>

            {/* Competition Timing */}
            <div className="flex items-center gap-2 text-gray-300">
              <Clock className="w-4 h-4" />
              {competition.status === 'active' ? (
                <span>Ends {formatDateTime(competition.end_time)}</span>
              ) : competition.status === 'scheduled' ? (
                <span>Starts {formatDateTime(competition.start_time)}</span>
              ) : (
                <span>Ended {formatDateTime(competition.end_time)}</span>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-gray-400">
            <Trophy className="w-4 h-4" />
            <span>No active competition</span>
          </div>
        )}

        {/* System Health and Score Lock Status */}
        <div className="ml-auto flex items-center gap-3">
          {/* Edit Tournament Button (for tournament owners/admins) */}
          {currentTournament && hasPermission('owner') && (
            <button
              className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border text-blue-300 bg-blue-500/20 border-blue-500/30 cursor-pointer hover:scale-105 transition-transform duration-200"
              title="Edit Tournament Settings"
              onClick={openEditTournamentDialog}
            >
              <Edit className="w-3 h-3" />
              <span>Edit</span>
            </button>
          )}

          {/* System Health Indicator */}
          <button
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${getHealthColor(healthStatus.overall)} cursor-pointer hover:scale-105 transition-transform duration-200`}
            title={`System Health: ${healthStatus.message}\nLast checked: ${new Date(healthStatus.lastChecked).toLocaleTimeString()}\n\nClick for detailed overview`}
            onClick={() => setIsSystemModalOpen(true)}
          >
            {getHealthIcon(healthStatus.overall)}
            <span>System {healthStatus.overall === 'healthy' ? 'OK' : healthStatus.overall}</span>
          </button>

          {/* Score Lock Status */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
            isLocked
              ? 'text-red-300 bg-red-500/20 border border-red-500/30'
              : 'text-green-300 bg-green-500/20 border border-green-500/30'
          }`}>
            {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            <span>{isLocked ? 'Scores Locked' : 'Scores Open'}</span>
          </div>
        </div>
      </div>

      {/* System Problems Modal */}
      <SystemProblemsModal
        isOpen={isSystemModalOpen}
        onClose={() => setIsSystemModalOpen(false)}
        healthStatus={healthStatus}
      />

      {/* Edit Tournament Modal */}
      <Dialog open={isTournamentEditOpen} onOpenChange={setIsTournamentEditOpen}>
        <DialogContent className="bg-gray-900 text-white border-white/20 max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Tournament</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tournament-name" className="text-white">Tournament Name</Label>
              <Input
                id="tournament-name"
                value={tournamentFormData.name}
                onChange={(e) => setTournamentFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-black/50 border-white/20 text-white"
                placeholder="Enter tournament name"
              />
            </div>
            <div>
              <Label htmlFor="tournament-slug" className="text-white">Tournament Slug</Label>
              <Input
                id="tournament-slug"
                value={tournamentFormData.slug}
                onChange={(e) => setTournamentFormData(prev => ({ ...prev, slug: e.target.value }))}
                className="bg-black/50 border-white/20 text-white"
                placeholder="tournament-slug"
              />
            </div>
            <div>
              <Label htmlFor="tournament-description" className="text-white">Description</Label>
              <Textarea
                id="tournament-description"
                value={tournamentFormData.description}
                onChange={(e) => setTournamentFormData(prev => ({ ...prev, description: e.target.value }))}
                className="bg-black/50 border-white/20 text-white"
                placeholder="Tournament description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tournament-start" className="text-white">Start Time</Label>
                <Input
                  id="tournament-start"
                  type="datetime-local"
                  value={tournamentFormData.start_time}
                  onChange={(e) => setTournamentFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  className="bg-black/50 border-white/20 text-white"
                />
              </div>
              <div>
                <Label htmlFor="tournament-end" className="text-white">End Time</Label>
                <Input
                  id="tournament-end"
                  type="datetime-local"
                  value={tournamentFormData.end_time}
                  onChange={(e) => setTournamentFormData(prev => ({ ...prev, end_time: e.target.value }))}
                  className="bg-black/50 border-white/20 text-white"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-tournament-public" className="text-white">Make Public</Label>
                <Switch
                  id="edit-tournament-public"
                  checked={tournamentFormData.is_public}
                  onCheckedChange={(checked) => setTournamentFormData(prev => ({ ...prev, is_public: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-tournament-active" className="text-white">Tournament Active</Label>
                <Switch
                  id="edit-tournament-active"
                  checked={tournamentFormData.is_active}
                  onCheckedChange={(checked) => setTournamentFormData(prev => ({ ...prev, is_active: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="edit-tournament-scores-locked" className="text-white">Lock Score Submissions</Label>
                  <p className="text-xs text-gray-400 mt-1">Prevent new score submissions when locked</p>
                </div>
                <Switch
                  id="edit-tournament-scores-locked"
                  checked={tournamentFormData.scores_locked}
                  onCheckedChange={(checked) => setTournamentFormData(prev => ({ ...prev, scores_locked: checked }))}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsTournamentEditOpen(false)}>Cancel</Button>
              <Button onClick={handleEditTournament}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompetitionStatus;