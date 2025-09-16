import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestFailureReport {
  timestamp: string;
  environment: string;
  failedTestsCount: number;
  totalTests: number;
  failedTests: Array<{
    testName: string;
    error: string;
    details: any;
  }>;
  allResults: any;
}

interface EmailRequest {
  to: string;
  subject: string;
  report: TestFailureReport;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, report }: EmailRequest = await req.json()

    if (!to || !subject || !report) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, report' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create the email HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Score System Test Failure Report</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .summary { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .test-failure { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 15px; }
            .test-name { font-weight: bold; color: #dc2626; }
            .error-message { font-family: monospace; background: #f9fafb; padding: 10px; border-radius: 4px; margin-top: 8px; }
            .metadata { background: #f9fafb; padding: 10px; border-radius: 4px; font-size: 14px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🚨 Score System Test Failures</h1>
            <p>Automated test failures detected in the BMS High Score Challenge system</p>
          </div>

          <div class="summary">
            <h2>Summary</h2>
            <ul>
              <li><strong>Failed Tests:</strong> ${report.failedTestsCount} out of ${report.totalTests}</li>
              <li><strong>Environment:</strong> ${report.environment}</li>
              <li><strong>Timestamp:</strong> ${new Date(report.timestamp).toLocaleString()}</li>
            </ul>
          </div>

          <h2>Failed Tests</h2>
          ${report.failedTests.map(test => `
            <div class="test-failure">
              <div class="test-name">${test.testName}</div>
              <div class="error-message">
                <strong>Error:</strong> ${test.error || 'Unknown error'}
              </div>
              ${test.details ? `
                <div class="metadata">
                  <strong>Details:</strong><br>
                  <pre>${JSON.stringify(test.details, null, 2)}</pre>
                </div>
              ` : ''}
            </div>
          `).join('')}

          <h2>All Test Results</h2>
          <div class="metadata">
            <pre>${JSON.stringify(report.allResults, null, 2)}</pre>
          </div>

          <div class="footer">
            <p>This is an automated message from the BMS High Score Challenge monitoring system.</p>
            <p>To disable these notifications, visit the admin panel and turn off scheduled testing.</p>
          </div>
        </body>
      </html>
    `;

    // Create plain text version
    const textContent = `
Score System Test Failure Report

SUMMARY:
- Failed Tests: ${report.failedTestsCount} out of ${report.totalTests}
- Environment: ${report.environment}
- Timestamp: ${new Date(report.timestamp).toLocaleString()}

FAILED TESTS:
${report.failedTests.map(test => `
- ${test.testName}
  Error: ${test.error || 'Unknown error'}
  Details: ${JSON.stringify(test.details, null, 2)}
`).join('\n')}

ALL TEST RESULTS:
${JSON.stringify(report.allResults, null, 2)}

---
This is an automated message from the BMS High Score Challenge monitoring system.
To disable these notifications, visit the admin panel and turn off scheduled testing.
    `;

    // Try to use the existing invite-user function's email logic
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // For now, we'll use a simple approach - you may need to implement actual email sending
    // This could integrate with Resend, SendGrid, or your existing email service
    console.log('Test failure report prepared for:', to)
    console.log('Subject:', subject)
    console.log('HTML length:', htmlContent.length)
    console.log('Text length:', textContent.length)

    // You can implement actual email sending here using your preferred service
    // For example with Resend:
    /*
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'alerts@bmschallenge.com',
        to: [to],
        subject: subject,
        html: htmlContent,
        text: textContent
      })
    })
    */

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test failure report processed',
        reportSummary: {
          failedTests: report.failedTestsCount,
          totalTests: report.totalTests,
          environment: report.environment
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error processing test failure report:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process test failure report' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})