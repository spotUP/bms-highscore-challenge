import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 3005 });

console.log('🧪 Test WebSocket server running on ws://localhost:3005');

wss.on('connection', function connection(ws) {
  console.log('✅ NEW CONNECTION ESTABLISHED');

  ws.on('message', function message(data) {
    console.log('📨 RECEIVED MESSAGE:', data.toString());

    // Echo the message back
    ws.send(JSON.stringify({
      type: 'echo',
      data: data.toString(),
      timestamp: new Date().toISOString()
    }));
  });

  ws.on('close', function close() {
    console.log('❌ CONNECTION CLOSED');
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Test WebSocket connection successful!'
  }));
});