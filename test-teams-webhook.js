// Simple test script to debug Teams webhook
// Run this in browser console to test the Teams webhook directly

async function testTeamsWebhook() {
  const testMessage = {
    "text": "🏆 **ACHIEVEMENT UNLOCKED!** 🏆\n\n🎯 **Player:** TEST_PLAYER\n🏅 **Achievement:** Test Achievement\n📝 **Description:** This is a test\n⭐ **Points:** +10\n",
    "summary": "TEST_PLAYER unlocked achievement: Test Achievement"
  };
  
  try {
    console.log('Testing Teams webhook...');
    console.log('Message:', testMessage);
    
    const response = await fetch('YOUR_TEAMS_WEBHOOK_URL_HERE', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage),
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    const responseText = await response.text();
    console.log('Response text:', responseText);
    
    if (!response.ok) {
      console.error('Teams webhook failed:', response.status, responseText);
    } else {
      console.log('✅ Teams webhook success!');
    }
  } catch (error) {
    console.error('Error testing Teams webhook:', error);
  }
}

// Uncomment and replace with your actual Teams webhook URL to test:
// testTeamsWebhook();
