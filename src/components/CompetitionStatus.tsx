import React, { useState } from 'react';
import { useCompetitionStatus } from '@/hooks/useCompetitionStatus';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { Clock, Lock, Unlock, Calendar, Trophy, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import SystemProblemsModal from '@/components/SystemProblemsModal';

const CompetitionStatus: React.FC = () => {
  const { competition, isLocked, loading, error } = useCompetitionStatus();
  const { healthStatus } = useSystemHealth();
  const [isSystemModalOpen, setIsSystemModalOpen] = useState(false);

  // Always render the full container to prevent layout shifts
  if (loading) {
    return (
      <div className="bg-black/20 border border-white/20 rounded-lg p-4 backdrop-blur-sm status-bar-stable">
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
      <div className="bg-black/20 border border-white/20 rounded-lg p-4 backdrop-blur-sm status-bar-stable">
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

  return (
    <div className="bg-black/20 border border-white/20 rounded-lg p-4 backdrop-blur-sm status-bar-stable">
      <div className="flex flex-wrap items-center justify-center gap-6 text-sm min-h-[2rem]">
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
    </div>
  );
};

export default CompetitionStatus;