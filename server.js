const express = require('express');
const cors = require('cors');
const Pusher = require('pusher');
require('dotenv').config();

const app = express();

const rooms = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Pusher Config
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

// Pusher Client Config (public key + cluster only)
app.get('/pusher-config', (req, res) => {
  res.json({
    key: process.env.PUSHER_KEY,
    cluster: process.env.PUSHER_CLUSTER
  });
});

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Pusher Auth Endpoint
app.post('/pusher/auth', async (req, res) => {
  const socketId = req.body.socket_id;
  const channel = req.body.channel_name;
  const presenceData = {
    user_id: req.body.username || 'anonymous',
    user_info: {
      username: req.body.username || 'anonymous'
    }
  };
  
  const authResponse = pusher.authenticate(socketId, channel, presenceData);
  res.send(authResponse);
});

// Events Handler
app.post('/events', async (req, res) => {
  try {
    console.log('📥 Received:', req.body);
    
    const { event: eventData = {} } = req.body || {};

    if (!eventData) {
      return res.status(400).json({ error: 'Missing event data' });
    }
    
    const parsedEvent = {
      type: eventData.type,
      roomId: eventData.roomId,
      password: eventData.password,
      username: eventData.username,
      timestamp: new Date().toISOString()
    };
    
    res.json({ 
      success: true, 
      message: 'Event processing started',
      event: parsedEvent 
    });
    
    setImmediate(async () => {
      await handleEvent(parsedEvent);
    });
    
  } catch (error) {
    console.error('💥 Events error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Room Event Handler
async function handleEvent(event) {
  console.log('🔄 Processing:', event.type, '→', event.roomId);
  
  try {
    switch (event.type) {
      case 'create':
        await createRoom(event);
        break;
      case 'join':
        await joinRoom(event);
        break;
      case 'leave':
        await leaveRoom(event);
        break;
      default:
        console.log('❓ Unknown:', event.type);
    }
  } catch (error) {
    console.error('❌ Handler error:', error);
  }
}

// 🏠 CREATE ROOM
async function createRoom(event) {
  console.log('🏠 Creating:', event.roomId, 'by', event.username);
  
  try {
    // Check if room exists
    if (rooms.has(event.roomId)) {
      throw new Error('Room already exists');
    }
    
    // Create room
    const roomData = {
      roomId: event.roomId,
      password: event.password || '',
      owner: event.username,
      users: [event.username],
      createdAt: new Date()
    };
    
    rooms.set(event.roomId, roomData);
    console.log('✅ Room created:', roomData);
    
    // PUSHER: Notify everyone
    await pusher.trigger(`presence-${event.roomId}`, 'room-created', {
      roomId: event.roomId,
      owner: event.username,
      users: roomData.users
    });
    
  } catch (error) {
    console.error('❌ Create failed:', error);
    // Notify creator of failure
    await pusher.trigger(`presence-${event.roomId}`, 'join-failed', {
      username: event.username,
      error: error.message
    });
  }
}

// 👥 JOIN ROOM
async function joinRoom(event) {
  console.log('👋 Joining:', event.username, '→', event.roomId);
  
  try {
    // 1. Verify room exists & password
    const room = rooms.get(event.roomId);
    if (!room) throw new Error('Room not found');
    if (room.password && room.password !== event.password) {
      throw new Error('Invalid password');
    }
    
    // 2. Add user if not already in room
    if (!room.users.includes(event.username)) {
      room.users.push(event.username);
      rooms.set(event.roomId, room);
    }
    
    console.log('✅ Joined:', event.username);
    
    // 3. PUSHER: Notify room
    await pusher.trigger(`presence-${event.roomId}`, 'user-joined', {
      username: event.username,
      roomId: event.roomId,
      timestamp: event.timestamp
    });
    
  } catch (error) {
    console.error('❌ Join failed:', error);
    // Notify client of failure
    await pusher.trigger(`presence-${event.roomId}`, 'join-failed', {
      username: event.username,
      error: error.message
    });
  }
}

// 👋 LEAVE ROOM
async function leaveRoom(event) {
  console.log('👋 Leaving:', event.username, '→', event.roomId);
  
  try {
    const room = rooms.get(event.roomId);
    if (room) {
      // Remove user
      room.users = room.users.filter(u => u !== event.username);
      
      // Delete room if empty and not owner left
      if (room.users.length === 0) {
        rooms.delete(event.roomId);
        console.log(`🗑️ Empty room deleted: ${event.roomId}`);
      } else {
        rooms.set(event.roomId, room);
      }
      
      // PUSHER
      await pusher.trigger(`presence-${event.roomId}`, 'user-left', {
        username: event.username,
        roomId: event.roomId
      });
      
      console.log('✅ Left:', event.username);
    }
  } catch (error) {
    console.error('❌ Leave failed:', error);
  }
}

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    pusher: !!pusher,
    rooms: rooms.size
  });
});

// List all rooms (for debugging)
app.get('/rooms', (req, res) => {
  res.json(Array.from(rooms.values()));
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎮 Hive CHAT v1.0 LIVE on port ${PORT}`);
  console.log(`📱 Chat fully functional!`);
});

module.exports = app;
