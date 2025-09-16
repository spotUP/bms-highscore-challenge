import { supabase } from '@/integrations/supabase/client';

interface SubmissionFailure {
  timestamp: string;
  playerName: string;
  score: number;
  gameName: string;
  error: string;
  userAgent: string;
  location: string; // 'desktop' | 'mobile' | 'qr'
}

// Track recent failures to prevent spam
let recentFailures: SubmissionFailure[] = [];
const FAILURE_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_FAILURES_PER_WINDOW = 3;

export async function reportSubmissionFailure(failure: Omit<SubmissionFailure, 'timestamp'>) {
  const timestamp = new Date().toISOString();
  const fullFailure: SubmissionFailure = {
    ...failure,
    timestamp
  };

  // Add to recent failures
  recentFailures.push(fullFailure);

  // Clean old failures
  const cutoff = Date.now() - FAILURE_WINDOW;
  recentFailures = recentFailures.filter(f => new Date(f.timestamp).getTime() > cutoff);

  // Check if we should send an alert
  const shouldSendAlert = recentFailures.length >= MAX_FAILURES_PER_WINDOW;

  if (shouldSendAlert) {
    await sendFailureAlert(recentFailures);
    // Clear failures after sending to prevent duplicate alerts
    recentFailures = [];
  }

  // Log locally for debugging
  console.error('Score submission failure:', fullFailure);
}

async function sendFailureAlert(failures: SubmissionFailure[]) {
  try {
    const { data, error } = await supabase.functions.invoke('send-test-failure-report', {
      body: {
        to: 'spotup@gmail.com',
        subject: '🚨 Score Submission Failures Detected - BMS High Score Challenge',
        report: {
          timestamp: new Date().toISOString(),
          environment: 'production',
          failedTestsCount: failures.length,
          totalTests: failures.length,
          failedTests: failures.map(f => ({
            testName: `Score Submission - ${f.location} (${f.gameName})`,
            error: f.error,
            details: {
              playerName: f.playerName,
              score: f.score,
              gameName: f.gameName,
              userAgent: f.userAgent,
              location: f.location,
              timestamp: f.timestamp
            }
          })),
          allResults: {
            type: 'submission_failures',
            failureWindow: FAILURE_WINDOW,
            maxFailuresPerWindow: MAX_FAILURES_PER_WINDOW,
            totalFailures: failures.length
          }
        }
      }
    });

    if (error) {
      console.error('Failed to send submission failure alert:', error);
    } else {
      console.log('Submission failure alert sent successfully');
    }
  } catch (error) {
    console.error('Error sending submission failure alert:', error);
  }
}

// Function to get current failure rate for status indicator
export function getSubmissionHealthStatus() {
  const cutoff = Date.now() - FAILURE_WINDOW;
  const recentFailureCount = recentFailures.filter(f => new Date(f.timestamp).getTime() > cutoff).length;

  if (recentFailureCount === 0) {
    return { status: 'healthy', message: 'All submissions working normally' };
  } else if (recentFailureCount < MAX_FAILURES_PER_WINDOW) {
    return { status: 'warning', message: `${recentFailureCount} recent submission failures` };
  } else {
    return { status: 'error', message: 'Multiple submission failures detected' };
  }
}