import { api } from '@/lib/api-client';

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
const FAILURE_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_FAILURES_PER_WINDOW = 3;
const STORAGE_KEY = 'submissionFailures';

// Get recent failures from localStorage, filtering out old ones
function getRecentFailures(): SubmissionFailure[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const failures: SubmissionFailure[] = JSON.parse(stored);
    const cutoff = Date.now() - FAILURE_WINDOW;

    // Filter out old failures
    const recentFailures = failures.filter(f => new Date(f.timestamp).getTime() > cutoff);

    // Update localStorage with cleaned list
    if (recentFailures.length !== failures.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentFailures));
    }

    return recentFailures;
  } catch (e) {
    return [];
  }
}

// Store failures to localStorage
function storeFailures(failures: SubmissionFailure[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(failures));
  } catch (e) {
    // localStorage might be full or unavailable
  }
}

export async function reportSubmissionFailure(failure: Omit<SubmissionFailure, 'timestamp'>) {
  const timestamp = new Date().toISOString();
  const fullFailure: SubmissionFailure = {
    ...failure,
    timestamp
  };

  // Get current failures and add new one
  const recentFailures = getRecentFailures();
  recentFailures.push(fullFailure);

  // Store updated failures
  storeFailures(recentFailures);

  // Check if we should send an alert
  const shouldSendAlert = recentFailures.length >= MAX_FAILURES_PER_WINDOW;

  if (shouldSendAlert) {
    await sendFailureAlert(recentFailures);
    // Clear failures after sending to prevent duplicate alerts
    storeFailures([]);
  }

  // Log locally for debugging
  console.error('Score submission failure:', fullFailure);
}

async function sendFailureAlert(failures: SubmissionFailure[]) {
  try {
    const { data, error } = await api.functions.invoke('send-test-failure-report', {
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
  const recentFailures = getRecentFailures();
  const recentFailureCount = recentFailures.length;

  if (recentFailureCount === 0) {
    return { status: 'healthy', message: 'All submissions working normally' };
  } else if (recentFailureCount < MAX_FAILURES_PER_WINDOW) {
    return { status: 'warning', message: `${recentFailureCount} recent submission failures` };
  } else {
    return { status: 'error', message: 'Multiple submission failures detected' };
  }
}