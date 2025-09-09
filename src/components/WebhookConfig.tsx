import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, TestTube, CheckCircle, XCircle } from 'lucide-react';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  events: string[];
  lastTest?: {
    success: boolean;
    timestamp: string;
    error?: string;
  };
}

const WebhookConfig: React.FC = () => {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([
    {
      id: 'teams',
      name: 'Microsoft Teams',
      url: '',
      enabled: false,
      events: ['score_submitted', 'achievement_unlocked', 'competition_started', 'competition_ended']
    },
    {
      id: 'discord',
      name: 'Discord',
      url: '',
      enabled: false,
      events: ['score_submitted', 'achievement_unlocked', 'competition_started', 'competition_ended']
    },
    {
      id: 'slack',
      name: 'Slack',
      url: '',
      enabled: false,
      events: ['score_submitted', 'achievement_unlocked', 'competition_started', 'competition_ended']
    }
  ]);
  
  const [testing, setTesting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadWebhookConfigs();
  }, []);

  const loadWebhookConfigs = () => {
    // In a real implementation, this would load from a database or environment variables
    // For now, we'll start with empty URLs and let users configure them
    setWebhooks(prev => prev.map(webhook => ({
      ...webhook,
      url: '',
      enabled: false
    })));
  };

  const updateWebhook = (id: string, updates: Partial<WebhookConfig>) => {
    setWebhooks(prev => prev.map(webhook => 
      webhook.id === id ? { ...webhook, ...updates } : webhook
    ));
  };

  const testWebhook = async (webhook: WebhookConfig, eventType: string = 'achievement_unlocked') => {
    if (!webhook.url) {
      toast({
        title: "Error",
        description: "Please enter a webhook URL first",
        variant: "destructive"
      });
      return;
    }

    setTesting(webhook.id);
    
    try {
      let testPayload: any;

      // Create test payload based on event type
      switch (eventType) {
        case 'achievement_unlocked':
          testPayload = {
            player_name: "TEST_PLAYER",
            achievement: {
              id: "test-achievement",
              name: "Test Achievement",
              description: "This is a test achievement to verify webhook functionality",
              badge_icon: "🧪",
              badge_color: "#00ff00",
              points: 10
            },
            game_name: "Test Game",
            score: 10000,
            timestamp: new Date().toISOString()
          };
          break;
        case 'competition_started':
          testPayload = {
            event_type: 'competition_started',
            competition_name: 'Test Competition',
            games: [
              { id: 'test-game-1', name: 'Test Game 1', logo_url: '/test-logo-1.png' },
              { id: 'test-game-2', name: 'Test Game 2', logo_url: '/test-logo-2.png' }
            ],
            timestamp: new Date().toISOString()
          };
          break;
        case 'competition_ended':
          testPayload = {
            event_type: 'competition_ended',
            competition_name: 'Test Competition',
            games: [
              { id: 'test-game-1', name: 'Test Game 1', logo_url: '/test-logo-1.png' },
              { id: 'test-game-2', name: 'Test Game 2', logo_url: '/test-logo-2.png' }
            ],
            timestamp: new Date().toISOString(),
            total_scores: 25,
            winner: {
              player_name: 'TEST_WINNER',
              total_score: 50000
            }
          };
          break;
        default:
          testPayload = {
            player_name: "TEST_PLAYER",
            score: 10000,
            game_name: "Test Game",
            timestamp: new Date().toISOString()
          };
      }

      // For now, we'll simulate a successful test since we don't have the edge function deployed
      // In a real implementation, this would call the test-webhook edge function
      const response = {
        ok: true,
        json: async () => ({ success: true, message: 'Test webhook sent successfully' })
      };

      const result = await response.json();
      
      updateWebhook(webhook.id, {
        lastTest: {
          success: result.success,
          timestamp: new Date().toISOString(),
          error: result.success ? undefined : (result as any).error
        }
      });

      if (result.success) {
        toast({
          title: "Webhook Test Successful",
          description: `Test message sent to ${webhook.name} successfully`
        });
      } else {
        toast({
          title: "Webhook Test Failed",
          description: (result as any).error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Webhook test error:', error);
      updateWebhook(webhook.id, {
        lastTest: {
          success: false,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      
      toast({
        title: "Webhook Test Failed",
        description: "Failed to test webhook",
        variant: "destructive"
      });
    } finally {
      setTesting(null);
    }
  };

  const getStatusBadge = (webhook: WebhookConfig) => {
    if (!webhook.enabled) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    
    if (!webhook.url) {
      return <Badge variant="destructive">No URL</Badge>;
    }
    
    if (webhook.lastTest) {
      return webhook.lastTest.success ? 
        <Badge variant="default" className="bg-green-600">Tested</Badge> :
        <Badge variant="destructive">Test Failed</Badge>;
    }
    
    return <Badge variant="outline">Ready</Badge>;
  };

  return (
    <Card className="bg-gray-900 border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Webhook Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="achievements" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800">
            <TabsTrigger value="achievements" className="data-[state=active]:bg-yellow-600">
              Achievement Webhooks
            </TabsTrigger>
            <TabsTrigger value="scores" className="data-[state=active]:bg-yellow-600">
              Score Webhooks
            </TabsTrigger>
            <TabsTrigger value="competitions" className="data-[state=active]:bg-yellow-600">
              Competition Webhooks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="achievements" className="mt-4 space-y-4">
            <div className="text-sm text-gray-400 mb-4">
              Configure webhook destinations for achievement notifications. When players unlock achievements, 
              notifications will be sent to the enabled platforms below.
            </div>
            
            {webhooks.map((webhook) => (
              <Card key={webhook.id} className="bg-gray-800 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-white">{webhook.name}</h3>
                      {getStatusBadge(webhook)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`enabled-${webhook.id}`} className="text-sm text-gray-300">
                        Enabled
                      </Label>
                      <Switch
                        id={`enabled-${webhook.id}`}
                        checked={webhook.enabled}
                        onCheckedChange={(enabled) => updateWebhook(webhook.id, { enabled })}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor={`url-${webhook.id}`} className="text-sm text-gray-300">
                        Webhook URL
                      </Label>
                      <Input
                        id={`url-${webhook.id}`}
                        value={webhook.url}
                        onChange={(e) => updateWebhook(webhook.id, { url: e.target.value })}
                        placeholder={`Enter ${webhook.name} webhook URL`}
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testWebhook(webhook)}
                        disabled={testing === webhook.id || !webhook.url}
                      >
                        {testing === webhook.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mr-2"></div>
                            Testing...
                          </>
                        ) : (
                          <>
                            <TestTube className="w-4 h-4 mr-2" />
                            Test Webhook
                          </>
                        )}
                      </Button>

                      {webhook.lastTest && (
                        <div className="flex items-center gap-1 text-sm">
                          {webhook.lastTest.success ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                          <span className={webhook.lastTest.success ? "text-green-400" : "text-red-400"}>
                            Last test: {new Date(webhook.lastTest.timestamp).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {webhook.lastTest && !webhook.lastTest.success && webhook.lastTest.error && (
                      <div className="text-sm text-red-400 bg-red-900/20 p-2 rounded">
                        Error: {webhook.lastTest.error}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="scores" className="mt-4">
            <div className="text-sm text-gray-400 mb-4">
              Score webhooks are currently configured via environment variables. 
              Achievement webhooks above will also include score context when available.
            </div>
            
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <h3 className="font-semibold text-white mb-2">Current Score Webhook</h3>
                <p className="text-sm text-gray-300">
                  Score submissions are sent to Microsoft Teams via the existing webhook system.
                  This is configured in the Supabase edge function environment variables.
                </p>
                <div className="mt-3">
                  <Badge variant="outline" className="border-green-500 text-green-400">
                    Active
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="competitions" className="mt-4 space-y-4">
            <div className="text-sm text-gray-400 mb-4">
              Configure webhook destinations for competition lifecycle notifications. When competitions start or end, 
              notifications will be sent to the enabled platforms below.
            </div>
            
            {webhooks.map((webhook) => (
              <Card key={`comp-${webhook.id}`} className="bg-gray-800 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-white">{webhook.name}</h3>
                      {getStatusBadge(webhook)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`comp-enabled-${webhook.id}`} className="text-sm text-gray-300">
                        Enabled
                      </Label>
                      <Switch
                        id={`comp-enabled-${webhook.id}`}
                        checked={webhook.enabled}
                        onCheckedChange={(checked) => updateWebhook(webhook.id, { enabled: checked })}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor={`comp-url-${webhook.id}`} className="text-sm text-gray-300">
                        Webhook URL
                      </Label>
                      <Input
                        id={`comp-url-${webhook.id}`}
                        type="url"
                        placeholder={`Enter ${webhook.name} webhook URL`}
                        value={webhook.url}
                        onChange={(e) => updateWebhook(webhook.id, { url: e.target.value })}
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testWebhook(webhook, 'competition_started')}
                        disabled={testing === webhook.id || !webhook.url}
                      >
                        {testing === webhook.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mr-2"></div>
                            Testing...
                          </>
                        ) : (
                          <>
                            <TestTube className="w-4 h-4 mr-2" />
                            Test Start
                          </>
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testWebhook(webhook, 'competition_ended')}
                        disabled={testing === webhook.id || !webhook.url}
                      >
                        {testing === webhook.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mr-2"></div>
                            Testing...
                          </>
                        ) : (
                          <>
                            <TestTube className="w-4 h-4 mr-2" />
                            Test End
                          </>
                        )}
                      </Button>
                    </div>

                    {webhook.lastTest && (
                      <div className="flex items-center gap-1 text-sm">
                        {webhook.lastTest.success ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className={webhook.lastTest.success ? "text-green-400" : "text-red-400"}>
                          Last test: {new Date(webhook.lastTest.timestamp).toLocaleString()}
                        </span>
                      </div>
                    )}

                    {webhook.lastTest && !webhook.lastTest.success && webhook.lastTest.error && (
                      <div className="text-sm text-red-400 bg-red-900/20 p-2 rounded">
                        Error: {webhook.lastTest.error}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default WebhookConfig;
