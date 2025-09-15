import React from 'react';
import { useCompetitionStatus } from '@/hooks/useCompetitionStatus';
import { Clock, Lock, Unlock, Calendar, Trophy } from 'lucide-react';

const CompetitionStatus: React.FC = () => {
  const { competition, isLocked, loading, error } = useCompetitionStatus();

  if (loading) {
    return (
      <div className="text-sm text-gray-400 animate-pulse">
        Loading competition status...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-400">
        {error}
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

  return (
    <div className="bg-black/20 border border-white/20 rounded-lg p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-6 text-sm">
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

        {/* Score Lock Status */}
        <div className="ml-auto">
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
    </div>
  );
};

export default CompetitionStatus;