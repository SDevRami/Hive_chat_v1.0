const express = require('express');
const cors = require('cors');
const Pusher = require('pusher');
require('dotenv').config();
const rateLimit = require('express-rate-limit');

const sanitizeInput = (input) => 
  input?.replace(/[<>\"'&]/g, '').trim().substring(0, 20) || 'anonymous';

const app = express();

const rooms = new Map();
const userLastMessage = new Map();
const userHeartbeat = new Map(); 

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'http://localhost:3000',
      'https://hive-chat-v1-0.onrender.com/'
    ];
    if (!origin || allowed.some(domain => origin.endsWith(domain))) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  }
}));

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

// Pusher Client Config
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
  const csrfToken = req.headers['x-csrf-token'];
  if (!csrfToken) {
    return res.status(403).json({ auth: null, error: 'CSRF token required' });
  }
  
  const socketId = req.body.socket_id;
  const channel = req.body.channel_name;
  const presenceData = {
    user_id: sanitizeInput(req.body.username),
    user_info: { username: sanitizeInput(req.body.username) }
  };
  
  const authResponse = pusher.authenticate(socketId, channel, presenceData);
  res.send(authResponse);
});

// Events Handler
const eventsLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,
  message: { success: false, error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,  // 5 rooms per IP
  message: { success: false, error: 'Too many room creates' }
});

app.post('/events', eventsLimiter, async (req, res) => {
  try {
    console.log('📥 Received:', req.body);
    
    const { event: eventData = {} } = req.body || {};

    if (!eventData) {
      return res.status(400).json({ success: false, error: 'Missing event data' });
    }
    
    // ✅ SANITIZATION
    const sanitizedUsername = sanitizeInput(eventData.username);
    const sanitizedRoomId = sanitizeInput(eventData.roomId);
    
    if (sanitizedRoomId.length < 2) {
      return res.status(400).json({ success: false, error: 'Room ID too short' });
    }
    
    const parsedEvent = {
      type: eventData.type,
      roomId: sanitizedRoomId,
      password: eventData.password,
      username: sanitizedUsername,
      timestamp: new Date().toISOString()
    };
    
    // ✅ RATE LIMIT by type
    if (parsedEvent.type === 'create') {
      const createKey = `create:${req.ip}`;
      const createCount = req.rateLimitRegistry?.get(createKey) || 0;
      if (createCount > 5) {
        return res.status(429).json({ success: false, error: 'Too many room creates' });
      }
    }
    
    const result = await handleEvent(parsedEvent);
    res.json({ 
      success: !result?.error, 
      message: result?.message || 'Event processed',
      event: parsedEvent,
      error: result?.error || null
    });
    
  } catch (error) {
    console.error('💥 Events error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Room Event Handler
async function handleEvent(event) {
  console.log('🔄 Processing:', event.type, '→', event.roomId);
  
  try {
    let result = { success: true };
    
    switch (event.type) {
      case 'create':
        result = await createRoom(event);
        break;
      case 'join':
        result = await joinRoom(event);
        break;
      case 'leave':
        result = await leaveRoom(event);
        break;
      default:
        console.log('❓ Unknown:', event.type);
        result = { success: false, error: 'Unknown event type' };
    }
    
    return result;
  } catch (error) {
    console.error('❌ Handler error:', error);
    return { success: false, error: error.message };
  }
}

// 🏠 CREATE ROOM
async function createRoom(event) {
  console.log('🏠 Creating:', event.roomId, 'by', event.username);
  
  try {
    if (rooms.has(event.roomId)) {
      const error = 'Room already exists';
      console.error('❌ Create failed:', error);
      
      // Notify creator
      try {
        await pusher.trigger(`presence-${event.roomId}`, 'join-failed', {
          username: event.username,
          error
        });
      } catch (e) {}
      
      return { success: false, error };  // ← FIXED
    }
    
    const roomData = {
      roomId: event.roomId,
      password: event.password || '',
      owner: event.username,
      users: [event.username],
      createdAt: new Date()
    };
    
    rooms.set(event.roomId, roomData);
  
      await pusher.trigger('global-notifications', 'room-ready', {
        roomId: event.roomId,
        owner: event.username
      });
      
      await pusher.trigger(`presence-${event.roomId}`, 'room-created', {
        roomId: event.roomId,
        owner: event.username,
        users: roomData.users
      });
      
      return { success: true };
  } catch (error) {
    console.error('❌ Create failed:', error);
    return { success: false, error: error.message };
  }
}

// 👥 JOIN ROOM
async function joinRoom(event) {
  console.log('👋 Joining:', event.username, '→', event.roomId);
  
  try {
    const room = rooms.get(event.roomId);
    if (!room) {
      const error = 'Room not found';
      console.error('❌ Join failed:', error);
      await pusher.trigger(`presence-${event.roomId}`, 'join-failed', {
        username: event.username,
        error
      });
      return { success: false, error };
    }
    
    if (room.password && room.password !== event.password) {
      const error = 'Invalid password';
      console.error('❌ Join failed:', error);
      await pusher.trigger(`presence-${event.roomId}`, 'join-failed', {
        username: event.username,
        error
      });
      return { success: false, error };
    }

    if (room.users.length >= 50) {
      return { success: false, error: 'Room full (50 user limit)' };
    }

    if (!room.users.includes(event.username)) {
      room.users.push(event.username);
      rooms.set(event.roomId, room);
    }
    
    console.log('✅ Joined:', event.username);
    
    await pusher.trigger(`presence-${event.roomId}`, 'user-joined', {
      username: event.username,
      roomId: event.roomId,
      timestamp: event.timestamp
    });
    userHeartbeat.set(`${event.roomId}:${event.username}`, Date.now());
    return { success: true, message: 'Joined room' };
    
  } catch (error) {
    console.error('❌ Join failed:', error);
    return { success: false, error: error.message };
  }
}

// 👋 LEAVE ROOM
async function leaveRoom(event) {
  console.log('👋 Leaving:', event.username, '→', event.roomId);
  
  try {
    const room = rooms.get(event.roomId);
    if (room) {
      const wasOwner = event.username === room.owner;
      
      room.users = room.users.filter(u => u !== event.username);
      
      if (wasOwner && room.users.length > 0) {
        room.owner = room.users[0];
        console.log(`👑 Ownership transferred to: ${room.owner}`);
      }
      
      if (room.users.length === 0) {
        rooms.delete(event.roomId);
        console.log(`🗑️ Empty room deleted: ${event.roomId}`);
      } else {
        rooms.set(event.roomId, room);
      }
      
      await pusher.trigger(`presence-${event.roomId}`, 'user-left', {
        username: event.username,
        roomId: event.roomId
      });
      
      console.log('✅ Left:', event.username);
      return { success: true, message: 'Left room' };
    } else {
      return { success: false, error: 'Room not found' };
    }
  } catch (error) {
    console.error('❌ Leave failed:', error);
    return { success: false, error: error.message };
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

app.post('/heartbeat', (req, res) => {
  const { roomId, username } = req.body;
  userHeartbeat.set(`${roomId}:${username}`, Date.now());
  res.json({ success: true });
});

// Cleanup every 5min
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    room.users = room.users.filter(username => {
      const last = userHeartbeat.get(`${roomId}:${username}`) || 0;
      return now - last < 5 * 60 * 1000;  // 5min timeout
    });
    
    if (room.users.length === 0) {
      rooms.delete(roomId);
      userHeartbeat.delete(`${roomId}:${username}`);
    }
  }
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎮 Hive CHAT v1.0 LIVE on port ${PORT}`);
  console.log(`📱 Chat fully functional!`);
});

module.exports = app;
