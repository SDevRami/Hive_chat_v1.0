# 🔒 Hive Chat v1.0 - Pure Client-Side E2EE

**A real-time, secure group chat app with end-to-end encryption happening entirely in the browser.** Server sees only encrypted gibberish!

## ✨ Features

- 🔒 **Pure Client-Side E2EE** - Encryption/decryption happens ONLY in browser, server receives encrypted data
- 👥 **Real-time Presence** - See who's online with owner badges and self-highlighting
- 🏠 **Password-Protected Rooms** - Optional room passwords (hashed client-side)
- 📱 **Mobile-Responsive** - Works perfectly on phones/tablets
- ⚡ **Instant Messaging** - Messages appear immediately after sending (local decrypt)
- 🎲 **Secure Key Generator** - One-click cryptographically secure shared keys
- 👑 **Ownership Transfer** - Rooms auto-transfer ownership when owner leaves
- 🧹 **Auto-Cleanup** - Empty rooms deleted, 5min user timeouts
- 🎨 **Modern Dark UI** - Glassmorphism design with smooth animations

## 🚀 Live Demo

[https://hive-chat-v1-0.onrender.com/](https://hive-chat-v1-0.onrender.com/)

**Quick Test:**
1. Enter username → `testuser`
2. Generate key → Click 🎲
3. Create room → `room123` (no password)
4. Open another tab → Join same room with same key

## 🔐 How E2EE Works

```
Your Message → [ENCRYPT in Browser] → 🔒 Encrypted Gibberish → Server → Other Users → [DECRYPT in Browser] → Original Message
```

**Key Security Features:**
- ✅ Shared secret key **NEVER sent to server**
- ✅ Server stores **only encrypted messages**
- ✅ Client-side AES-256 encryption (CryptoJS)
- ✅ Messages decrypt **instantly** locally when sent
- ✅ Key mismatch shows clear warning

## 🛠 Tech Stack

| Frontend | Backend | Real-time | Security |
|---------|---------|-----------|----------|
| HTML5/CSS3/JS | Node.js/Express | Pusher Presence Channels | AES-256 (CryptoJS) |
| Pusher JS SDK | CORS | Client Events | SHA-256 Hashing |
| CryptoJS | dotenv | WebSocket Auth | Client-side Key Gen |

## 📁 Project Structure

```
Hive_chat_v1.0/
├── public/
│   └── index.html          # Complete client app
├── server.js               # Express + Pusher backend
├── package.json            # Dependencies
├── README.md               # This file
└── LICENSE                 # MIT LICENSE
```

## 🚀 Quick Start (Local)

### 1. Clone & Install
```bash
git clone https://github.com/SDevRami/Hive_chat_v1.0.git
cd Hive_chat_v1.0
npm install
```

### 2. Pusher Setup
1. [Create Pusher account](https://pusher.com/channels/)
2. New "Channels" app
3. Copy credentials to `.env`:

```env
PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_key
PUSHER_SECRET=your_secret
PUSHER_CLUSTER=your_cluster
```

### 3. Run
```bash
npm start
# or
node server.js
```

**Open:** `http://localhost:3000`

## 🧪 package.json Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "pusher": "^5.1.3",
    "dotenv": "^16.3.1"
  },
  "scripts": {
    "start": "node server.js"
  }
}
```

## 🔧 Server Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serve chat UI |
| `/pusher-config` | GET | Public Pusher keys |
| `/pusher/auth` | POST | Presence channel auth |
| `/events` | POST | Room create/join/leave |
| `/health` | GET | Server status |
| `/rooms` | GET | Debug: List rooms |

## 🎮 Usage Flow

```
1. Enter username → Login
2. Generate/Set shared secret → Copy to all members
3. Create Room → room123 + optional password
4. Share room ID + secret key with friends
5. Chat securely → Server sees only encrypted data!
```

## 📱 Room Features

- **👥 Live User List** - Owner (👑), Self-highlighted, User count
- **🔒 Message Styling** - Own (green), Others (blue), System (orange)
- **⏰ Timestamps** - HH:MM format
- **💬 Enter to Send** - Natural chat experience
- **🚪 Leave Room** - Auto-ownership transfer

## ⚙️ Rate Limiting

- **Client-side**: 1 second between messages
- **Server-side**: 500ms between events
- **Room limit**: 50 users max
- **User timeout**: 5 minutes inactivity

## 🔒 Security Model

```
✅ Client generates AES-256 key (32 bytes random)
✅ Key stays in browser memory only
✅ Messages encrypted BEFORE server transmission
✅ Server stores NOTHING readable
✅ Passwords hashed client-side before sending
✅ Pusher presence channels for real-time sync
❌ No database persistence (ephemeral rooms)
```

## 🌐 Deployment

### Render.com (Production)
```
✅ Already deployed: https://hive-chat-v1-0.onrender.com/
✅ Free tier works perfectly
✅ Auto-deploys from GitHub
```

### Other Platforms
1. Set `PUSHER_*` env vars
2. `npm install && npm start`
3. Point domain to server

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "DECRYPTION FAILED" | Shared key mismatch - regenerate & share exact key |
| Room not found | Room creator must join first |
| Messages not appearing | Check console, verify Pusher config |
| User list empty | Presence auth headers missing |
| Join failed | Password mismatch or room full |

## 📊 Health Check

```
GET /health → {"status":"OK","rooms":2}
```

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Test thoroughly (E2EE especially!)
4. Submit PR with demo video

## 📄 License

MIT License - Free to use/modify/deploy

```
Made with ❤️ by SDevRami
Follow: https://github.com/SDevRami
```

## 🎉 Credits

- **Pusher** - Real-time magic
- **CryptoJS** - Battle-tested encryption
- **Render.com** - Free hosting hero

***

**⭐ Star this repo if you found it useful!**
