# Webhook Setup Guide

This guide explains how to set up webhooks for the BMS Highscore Challenge achievement system.

## Supported Platforms

### 1. Microsoft Teams
1. Go to your Teams channel
2. Click the "..." menu → "Connectors"
3. Find "Incoming Webhook" and click "Configure"
4. Give it a name and upload an icon (optional)
5. Copy the webhook URL
6. Add it to your environment variables as `TEAMS_WEBHOOK_URL`

### 2. Discord
1. Go to your Discord server
2. Right-click on the channel where you want notifications
3. Select "Edit Channel" → "Integrations" → "Webhooks"
4. Click "Create Webhook"
5. Give it a name and upload an avatar (optional)
6. Copy the webhook URL
7. Add it to your environment variables as `DISCORD_WEBHOOK_URL`

### 3. Slack
1. Go to your Slack workspace
2. Navigate to the channel where you want notifications
3. Click the channel name → "Settings" → "Integrations"
4. Click "Add apps" → Search for "Incoming Webhooks"
5. Click "Add to Slack"
6. Choose the channel and click "Add Incoming Webhooks Integration"
7. Copy the webhook URL
8. Add it to your environment variables as `SLACK_WEBHOOK_URL`

## Environment Variables

Add these to your `.env` file or Supabase environment variables:

```bash
# Webhook URLs
TEAMS_WEBHOOK_URL=https://your-teams-webhook-url
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-discord-webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your-slack-webhook

# Supabase Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

## Webhook Events

### Achievement Notifications
Triggered when a player unlocks an achievement:
- **Event**: `achievement_unlocked`
- **Data**: Player name, achievement details, game context, score
- **Platforms**: Teams, Discord, Slack

### Score Notifications (Existing)
Triggered when a player submits a score:
- **Event**: `score_submitted`
- **Data**: Player name, score, game, position
- **Platforms**: Teams (existing system)

## Testing Webhooks

1. Go to the Admin panel
2. Navigate to the "Webhook Configuration" section
3. Enter your webhook URLs
4. Click "Test Webhook" for each platform
5. Check your channels to verify the test messages

## Webhook Payload Examples

### Achievement Webhook (Teams)
```json
{
  "attachments": [
    {
      "contentType": "application/vnd.microsoft.card.adaptive",
      "content": {
        "type": "AdaptiveCard",
        "version": "1.5",
        "body": [
          {
            "type": "TextBlock",
            "text": "🏆 ACHIEVEMENT UNLOCKED! 🏆",
            "style": "heading",
            "size": "ExtraLarge"
          },
          {
            "type": "TextBlock",
            "text": "🎯 PLAYER_NAME"
          },
          {
            "type": "TextBlock",
            "text": "🏅 Achievement Name"
          }
        ]
      }
    }
  ]
}
```

### Achievement Webhook (Discord)
```json
{
  "username": "BMS Achievement Bot",
  "embeds": [
    {
      "title": "🏆 Achievement Unlocked!",
      "description": "**PLAYER_NAME** just unlocked a new achievement!",
      "color": 16711680,
      "fields": [
        {
          "name": "🏅 Achievement",
          "value": "Achievement Name",
          "inline": true
        },
        {
          "name": "⭐ Points",
          "value": "+10",
          "inline": true
        }
      ]
    }
  ]
}
```

### Achievement Webhook (Slack)
```json
{
  "text": "🏆 Achievement Unlocked!",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🏆 Achievement Unlocked!"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*PLAYER_NAME* just unlocked a new achievement!"
      }
    }
  ]
}
```

## Troubleshooting

### Common Issues

1. **Webhook not receiving messages**
   - Check that the webhook URL is correct
   - Verify the webhook is enabled in the platform
   - Check the Supabase function logs for errors

2. **Test webhook fails**
   - Ensure the webhook URL is accessible
   - Check that the platform accepts the message format
   - Verify environment variables are set correctly

3. **Messages not formatted correctly**
   - Each platform has different message formats
   - Check the webhook function code for platform-specific formatting
   - Test with the built-in test functionality

### Debugging

1. Check Supabase function logs:
   ```bash
   supabase functions logs send-achievement-webhook
   ```

2. Check browser console for frontend errors

3. Verify environment variables are loaded:
   ```bash
   supabase secrets list
   ```

## Security Notes

- Webhook URLs contain sensitive tokens - keep them secure
- Use environment variables, never hardcode URLs
- Consider implementing webhook signature verification for production
- Regularly rotate webhook URLs for security

## Future Enhancements

- Webhook signature verification
- Retry logic with exponential backoff
- Webhook delivery status tracking
- Custom webhook templates
- Webhook analytics and monitoring
