# Competition Lifecycle Webhooks

This document describes the Competition Lifecycle webhook system that sends notifications when competitions start and end.

## Overview

The Competition Lifecycle webhook system automatically sends notifications to configured platforms (Microsoft Teams, Discord, Slack) when:
- A new competition starts (when games are randomized)
- A competition ends (when the competition is stopped)

## Features

### 🎮 Competition Started Notifications
- Triggered when the "Randomize Games" button is clicked in the admin panel
- Includes information about the selected games
- Shows competition name and timestamp
- Provides a link to view the leaderboard

### 🏁 Competition Ended Notifications
- Triggered when the "Stop Competition" button is clicked in the admin panel
- Includes final competition statistics
- Shows the winner and their total score
- Displays total number of scores submitted
- Lists all games that were part of the competition

## Webhook Events

### Competition Started Event
```json
{
  "event_type": "competition_started",
  "competition_name": "Competition 12/15/2024",
  "games": [
    {
      "id": "pacman",
      "name": "Pac-Man",
      "logo_url": "/game-logos/pacman-logo.png"
    },
    {
      "id": "space-invaders",
      "name": "Space Invaders",
      "logo_url": "/game-logos/space-invaders-logo.png"
    }
  ],
  "timestamp": "2024-12-15T10:30:00.000Z"
}
```

### Competition Ended Event
```json
{
  "event_type": "competition_ended",
  "competition_name": "Competition 12/15/2024",
  "games": [
    {
      "id": "pacman",
      "name": "Pac-Man",
      "logo_url": "/game-logos/pacman-logo.png"
    }
  ],
  "timestamp": "2024-12-15T18:45:00.000Z",
  "total_scores": 25,
  "winner": {
    "player_name": "Player1",
    "total_score": 50000
  }
}
```

## Platform-Specific Formats

### Microsoft Teams
Uses Adaptive Cards with:
- Rich formatting and colors
- Action buttons to view leaderboard
- Game information and statistics
- Winner highlights for ended competitions

### Discord
Uses Rich Embeds with:
- Color-coded embeds (green for start, orange for end)
- Structured fields for information
- Footer with system branding
- Winner information prominently displayed

### Slack
Uses Block Kit with:
- Header blocks for titles
- Section blocks for content
- Context blocks for timestamps
- Action blocks with buttons
- Winner information in dedicated sections

## Configuration

### Environment Variables
Set these environment variables in your Supabase project:

```bash
# Webhook URLs
TEAMS_WEBHOOK_URL=https://your-teams-webhook-url
DISCORD_WEBHOOK_URL=https://your-discord-webhook-url
SLACK_WEBHOOK_URL=https://your-slack-webhook-url

# Site URL for links in notifications
SITE_URL=https://your-domain.com
```

### Admin Panel Configuration
1. Navigate to the Admin panel
2. Go to the "Webhook Configuration" section
3. Click on the "Competition Webhooks" tab
4. Configure webhook URLs for each platform
5. Enable/disable webhooks as needed
6. Test webhooks using the "Test Start" and "Test End" buttons

## Implementation Details

### Files Created/Modified

#### New Files
- `supabase/functions/send-competition-webhook/index.ts` - Edge function for sending webhooks
- `src/hooks/useCompetitionWebhooks.ts` - React hook for webhook management
- `COMPETITION_LIFECYCLE_WEBHOOKS.md` - This documentation

#### Modified Files
- `src/components/RandomizeGames.tsx` - Added competition started webhook
- `src/components/StopCompetition.tsx` - Added competition ended webhook
- `src/components/WebhookConfig.tsx` - Added competition webhook configuration UI

### Webhook Flow

1. **Competition Start**:
   - User clicks "Randomize Games" in admin panel
   - Games are selected and updated in database
   - `sendCompetitionStartedWebhook` is called with game data
   - Webhook is sent to all enabled platforms

2. **Competition End**:
   - User clicks "Stop Competition" in admin panel
   - Competition data is gathered (games, scores, winner)
   - Competition is archived in database
   - `sendCompetitionEndedWebhook` is called with final data
   - Webhook is sent to all enabled platforms

### Error Handling
- Webhook failures are logged but don't prevent competition operations
- Individual platform failures don't affect other platforms
- Test webhooks allow verification before enabling

## Testing

### Manual Testing
1. Configure webhook URLs in the admin panel
2. Use the "Test Start" and "Test End" buttons to verify webhook delivery
3. Check the webhook status badges for success/failure indicators
4. Review webhook logs in the browser console

### Automated Testing
The webhook system includes comprehensive error handling and logging:
- All webhook calls are logged with success/failure status
- Failed webhooks don't interrupt the main competition flow
- Test payloads simulate real competition data

## Troubleshooting

### Common Issues

1. **Webhooks not sending**:
   - Check environment variables are set correctly
   - Verify webhook URLs are valid and accessible
   - Check browser console for error messages

2. **Formatting issues**:
   - Different platforms have different formatting requirements
   - Test with each platform individually
   - Check platform-specific documentation for webhook formats

3. **Missing data**:
   - Ensure competition data is properly gathered before archiving
   - Check database queries for correct data retrieval
   - Verify game and score data is available

### Debug Information
- All webhook calls include detailed console logging
- Success/failure status is tracked and displayed in the admin panel
- Test webhooks provide immediate feedback on configuration issues

## Future Enhancements

Potential improvements to the system:
- Competition duration tracking
- Player participation statistics
- Game-specific performance metrics
- Custom webhook payload templates
- Webhook delivery retry logic
- Webhook analytics and reporting

## Security Considerations

- Webhook URLs should be kept secure and not exposed in client-side code
- Environment variables are used for sensitive configuration
- Webhook payloads don't include sensitive user data
- All webhook calls are server-side to prevent client-side exposure
