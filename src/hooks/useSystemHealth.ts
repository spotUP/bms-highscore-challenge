import { useState, useEffect } from 'react';
import { getSubmissionHealthStatus } from '@/utils/submissionMonitoring';

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

export const useSystemHealth = () => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    overall: 'healthy',
    message: 'System operational',
    lastChecked: new Date().toISOString(),
    tests: {
      deployment: { status: 'unknown' },
      submissions: { status: 'healthy', message: 'No recent failures' },
      scheduled: { status: 'healthy', message: 'Tests running normally' },
      brackets: { status: 'healthy', message: 'Brackets system operational' },
      security: { status: 'healthy', message: 'Security systems operational' },
      tournament: { status: 'healthy', message: 'Tournament management operational' },
      realtime: { status: 'healthy', message: 'Real-time systems operational' }
    }
  });

  const checkSystemHealth = () => {
    // Check submission health
    const submissionHealth = getSubmissionHealthStatus();

    // Check deployment test results
    let deploymentHealth: { status: 'healthy' | 'warning' | 'error' | 'unknown'; timestamp?: string } = { status: 'unknown' };
    try {
      const deployTestResults = localStorage.getItem('deployTestResults');
      if (deployTestResults) {
        const results = JSON.parse(deployTestResults);
        const testAge = Date.now() - new Date(results.timestamp).getTime();
        const isStale = testAge > 24 * 60 * 60 * 1000; // 24 hours

        if (isStale) {
          deploymentHealth = { status: 'warning', timestamp: results.timestamp };
        } else if (results.passed) {
          deploymentHealth = { status: 'healthy', timestamp: results.timestamp };
        } else {
          deploymentHealth = { status: 'error', timestamp: results.timestamp };
        }
      }
    } catch (e) {
      deploymentHealth = { status: 'unknown' };
    }

    // Check scheduled test status
    let scheduledHealth: { status: 'healthy' | 'warning' | 'error'; message: string } = {
      status: 'healthy',
      message: 'Tests running normally'
    };
    try {
      const scheduledData = localStorage.getItem('scheduledTestsData');
      if (scheduledData) {
        const data = JSON.parse(scheduledData);
        if (data.enabled) {
          const lastRun = data.lastRun ? new Date(data.lastRun).getTime() : 0;
          const timeSinceLastRun = Date.now() - lastRun;
          const daysSinceLastRun = timeSinceLastRun / (24 * 60 * 60 * 1000);

          if (daysSinceLastRun > 2) {
            scheduledHealth = { status: 'error', message: 'Scheduled tests overdue' };
          } else if (daysSinceLastRun > 1.2) {
            scheduledHealth = { status: 'warning', message: 'Scheduled tests running late' };
          } else {
            scheduledHealth = { status: 'healthy', message: 'Tests running normally' };
          }
        } else {
          scheduledHealth = { status: 'warning', message: 'Scheduled tests disabled' };
        }
      } else {
        scheduledHealth = { status: 'warning', message: 'Scheduled tests not configured' };
      }
    } catch (e) {
      scheduledHealth = { status: 'error', message: 'Cannot check scheduled test status' };
    }

    // Check brackets health from recent test results
    let bracketsHealth: { status: 'healthy' | 'warning' | 'error'; message: string } = {
      status: 'healthy',
      message: 'Brackets system operational'
    };
    try {
      // Check for recent brackets test results from scheduled tests
      const testResults = localStorage.getItem('deployTestResults');
      if (testResults) {
        const results = JSON.parse(testResults);
        if (results.results && results.results.brackets) {
          const bracketsResult = results.results.brackets;
          if (!bracketsResult.success) {
            bracketsHealth = { status: 'error', message: 'Brackets tests failing' };
          } else {
            const testAge = Date.now() - new Date(bracketsResult.timestamp).getTime();
            if (testAge > 48 * 60 * 60 * 1000) { // 48 hours
              bracketsHealth = { status: 'warning', message: 'Brackets tests stale' };
            }
          }
        }
      } else {
        bracketsHealth = { status: 'warning', message: 'No recent brackets test data' };
      }
    } catch (e) {
      bracketsHealth = { status: 'warning', message: 'Cannot check brackets test status' };
    }

    // Check security system health from recent test results
    let securityHealth: { status: 'healthy' | 'warning' | 'error'; message: string } = {
      status: 'healthy',
      message: 'Security systems operational'
    };
    try {
      const testResults = localStorage.getItem('deployTestResults');
      if (testResults) {
        const results = JSON.parse(testResults);
        if (results.results && results.results.security) {
          const securityResult = results.results.security;
          if (!securityResult.success) {
            securityHealth = { status: 'error', message: 'Security tests failing' };
          } else {
            const testAge = Date.now() - new Date(securityResult.timestamp).getTime();
            if (testAge > 48 * 60 * 60 * 1000) { // 48 hours
              securityHealth = { status: 'warning', message: 'Security tests stale' };
            }
          }
        }
      } else {
        securityHealth = { status: 'warning', message: 'No recent security test data' };
      }
    } catch (e) {
      securityHealth = { status: 'warning', message: 'Cannot check security test status' };
    }

    // Check tournament management health from recent test results
    let tournamentHealth: { status: 'healthy' | 'warning' | 'error'; message: string } = {
      status: 'healthy',
      message: 'Tournament management operational'
    };
    try {
      const testResults = localStorage.getItem('deployTestResults');
      if (testResults) {
        const results = JSON.parse(testResults);
        if (results.results && results.results.tournament) {
          const tournamentResult = results.results.tournament;
          if (!tournamentResult.success) {
            tournamentHealth = { status: 'error', message: 'Tournament tests failing' };
          } else {
            const testAge = Date.now() - new Date(tournamentResult.timestamp).getTime();
            if (testAge > 48 * 60 * 60 * 1000) { // 48 hours
              tournamentHealth = { status: 'warning', message: 'Tournament tests stale' };
            }
          }
        }
      } else {
        tournamentHealth = { status: 'warning', message: 'No recent tournament test data' };
      }
    } catch (e) {
      tournamentHealth = { status: 'warning', message: 'Cannot check tournament test status' };
    }

    // Check real-time system health from recent test results
    let realtimeHealth: { status: 'healthy' | 'warning' | 'error'; message: string } = {
      status: 'healthy',
      message: 'Real-time systems operational'
    };
    try {
      const testResults = localStorage.getItem('deployTestResults');
      if (testResults) {
        const results = JSON.parse(testResults);
        if (results.results && results.results.realtime) {
          const realtimeResult = results.results.realtime;
          if (!realtimeResult.success) {
            realtimeHealth = { status: 'error', message: 'Real-time tests failing' };
          } else {
            const testAge = Date.now() - new Date(realtimeResult.timestamp).getTime();
            if (testAge > 48 * 60 * 60 * 1000) { // 48 hours
              realtimeHealth = { status: 'warning', message: 'Real-time tests stale' };
            }
          }
        }
      } else {
        realtimeHealth = { status: 'warning', message: 'No recent real-time test data' };
      }
    } catch (e) {
      realtimeHealth = { status: 'warning', message: 'Cannot check real-time test status' };
    }

    // Determine overall health
    const statuses = [
      deploymentHealth.status === 'unknown' ? 'healthy' : deploymentHealth.status,
      submissionHealth.status,
      scheduledHealth.status,
      bracketsHealth.status,
      securityHealth.status,
      tournamentHealth.status,
      realtimeHealth.status
    ];

    let overall: 'healthy' | 'warning' | 'error' = 'healthy';
    let message = 'All systems operational';

    if (statuses.includes('error')) {
      overall = 'error';
      message = 'System issues detected';
    } else if (statuses.includes('warning')) {
      overall = 'warning';
      message = 'Minor issues detected';
    }

    setHealthStatus({
      overall,
      message,
      lastChecked: new Date().toISOString(),
      tests: {
        deployment: deploymentHealth,
        submissions: {
          status: submissionHealth.status,
          message: submissionHealth.message
        },
        scheduled: scheduledHealth,
        brackets: bracketsHealth,
        security: securityHealth,
        tournament: tournamentHealth,
        realtime: realtimeHealth
      }
    });
  };

  useEffect(() => {
    // Initial check
    checkSystemHealth();

    // Check every 30 seconds
    const interval = setInterval(checkSystemHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    healthStatus,
    refreshHealth: checkSystemHealth
  };
};