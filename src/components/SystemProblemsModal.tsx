import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Shield, Clock, Database, User, Settings, BarChart3, Trophy, Smartphone, Mail, Calendar } from 'lucide-react';

interface HealthStatus {
  overall: 'healthy' | 'warning' | 'error';
  message: string;
  lastChecked: string;
  tests: {
    deployment: { status: 'healthy' | 'warning' | 'error' | 'unknown'; timestamp?: string };
    submissions: { status: 'healthy' | 'warning' | 'error'; message: string };
    scheduled: { status: 'healthy' | 'warning' | 'error'; message: string };
    brackets: { status: 'healthy' | 'warning' | 'error'; message: string };
    security: { status: 'healthy' | 'warning' | 'error'; message: string };
    tournament: { status: 'healthy' | 'warning' | 'error'; message: string };
    realtime: { status: 'healthy' | 'warning' | 'error'; message: string };
  };
}

interface SystemProblemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  healthStatus: HealthStatus;
}

const SystemProblemsModal: React.FC<SystemProblemsModalProps> = ({ isOpen, onClose, healthStatus }) => {
  const getStatusIcon = (status: 'healthy' | 'warning' | 'error' | 'unknown') => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'error': return <Shield className="w-4 h-4 text-red-400" />;
      case 'unknown': return <Clock className="w-4 h-4 text-gray-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: 'healthy' | 'warning' | 'error' | 'unknown') => {
    switch (status) {
      case 'healthy': return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Healthy</Badge>;
      case 'warning': return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warning</Badge>;
      case 'error': return <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">Error</Badge>;
      case 'unknown': return <Badge variant="secondary" className="bg-gray-500/20 text-gray-400 border-gray-500/30">Unknown</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getTestIcon = (testName: string) => {
    switch (testName) {
      case 'deployment': return <Database className="w-4 h-4" />;
      case 'submissions': return <Smartphone className="w-4 h-4" />;
      case 'scheduled': return <Calendar className="w-4 h-4" />;
      case 'brackets': return <Trophy className="w-4 h-4" />;
      case 'security': return <User className="w-4 h-4" />;
      case 'tournament': return <Settings className="w-4 h-4" />;
      case 'realtime': return <BarChart3 className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  const getTestName = (testKey: string) => {
    switch (testKey) {
      case 'deployment': return 'Deployment Tests';
      case 'submissions': return 'Score Submissions';
      case 'scheduled': return 'Scheduled Tests';
      case 'brackets': return 'Brackets System';
      case 'security': return 'Security System';
      case 'tournament': return 'Tournament Management';
      case 'realtime': return 'Real-time System';
      default: return testKey;
    }
  };

  const getTestDescription = (testKey: string) => {
    switch (testKey) {
      case 'deployment': return 'Database schema, score validation, and system integrity tests';
      case 'submissions': return 'Score submission monitoring and failure tracking';
      case 'scheduled': return 'Automated system health checks and monitoring';
      case 'brackets': return 'Tournament brackets, player management, and match reporting';
      case 'security': return 'RLS policies, admin privileges, and security constraints';
      case 'tournament': return 'Tournament creation, state management, and data isolation';
      case 'realtime': return 'WebSocket connections, notifications, and subscription management';
      default: return 'System component health monitoring';
    }
  };

  const problemTests = Object.entries(healthStatus.tests).filter(([_, test]) =>
    test.status === 'warning' || test.status === 'error'
  );

  const healthyTests = Object.entries(healthStatus.tests).filter(([_, test]) =>
    test.status === 'healthy'
  );

  const unknownTests = Object.entries(healthStatus.tests).filter(([_, test]) =>
    test.status === 'unknown'
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-gray-900/95 border border-white/20 fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            {getStatusIcon(healthStatus.overall)}
            System Health Overview
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Last checked: {new Date(healthStatus.lastChecked).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overall Status */}
          <div className="p-4 rounded-lg bg-black/30 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white">Overall System Status</h3>
              {getStatusBadge(healthStatus.overall)}
            </div>
            <p className="text-gray-300 text-sm">{healthStatus.message}</p>
          </div>

          {/* Problem Tests */}
          {problemTests.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Issues Detected ({problemTests.length})
              </h3>
              <div className="space-y-3">
                {problemTests.map(([testKey, test]) => (
                  <div key={testKey} className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getTestIcon(testKey)}
                        <span className="font-medium text-white">{getTestName(testKey)}</span>
                      </div>
                      {getStatusBadge(test.status)}
                    </div>
                    <p className="text-gray-300 text-sm mb-2">{getTestDescription(testKey)}</p>
                    <p className="text-red-300 text-sm font-medium">
                      {'message' in test ? test.message : `Status: ${test.status}`}
                    </p>
                    {test.timestamp && (
                      <p className="text-gray-400 text-xs mt-1">
                        Last updated: {new Date(test.timestamp).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unknown Tests */}
          {unknownTests.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-400 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Status Unknown ({unknownTests.length})
              </h3>
              <div className="space-y-3">
                {unknownTests.map(([testKey, test]) => (
                  <div key={testKey} className="p-4 rounded-lg bg-gray-500/10 border border-gray-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getTestIcon(testKey)}
                        <span className="font-medium text-white">{getTestName(testKey)}</span>
                      </div>
                      {getStatusBadge(test.status)}
                    </div>
                    <p className="text-gray-300 text-sm">
                      {getTestDescription(testKey)}
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                      No recent test data available
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Healthy Tests */}
          {healthyTests.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-green-400 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Healthy Systems ({healthyTests.length})
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {healthyTests.map(([testKey, test]) => (
                  <div key={testKey} className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {getTestIcon(testKey)}
                        <span className="font-medium text-white text-sm">{getTestName(testKey)}</span>
                      </div>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <p className="text-green-300 text-xs">
                      {'message' in test ? test.message : 'Operating normally'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <h4 className="font-medium text-blue-300 mb-2">Need Help?</h4>
            <div className="text-sm text-gray-300 space-y-1">
              <p>• Visit the Admin page to run detailed system tests</p>
              <p>• Check the test logs for specific error details</p>
              <p>• Contact system administrators if issues persist</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SystemProblemsModal;