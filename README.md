# ⚡ CodeAlpha Community Hub

A high-performance, installable **Progressive Web App (PWA)** styled with premium, punchy **Neo-Brutalism** aesthetics. Built for developers to call, collaborate, pair-program, and track goals with built-in gamification.

---

## ✨ Features

### 🎨 Premium Neo-Brutalism & Animations
- **Springy Tap Physics**: All buttons scale down and spring back with overshoot bounce on click.
- **3D Card-Flip Route Transitions**: Transitions from Lobby to Meeting Room rotate on the Y-axis.
- **Audio-Reactive Shaking**: Video grid borders shake dynamically when participants talk.
- **Chunky stepped progress bars** replacing old circular spinners.
- **Floating Emoji Reactions**: Float up from the screen bottom with random angle tilts.

### 📱 Progressive Web App (PWA) & Offline Mode
- **Fully Installable**: Works like a native desktop/mobile app with `manifest.json`.
- **Offline Mode**: Access past chat messages and tasks history even when internet connection is lost.
- **Scheduled Notifications**: Desktop alerts notifying you 5 minutes before scheduled meetings.

### 👥 Collaborative Utilities
- **Shared Tasks Board**: Create, delegate, and track tasks. Completed items snap with a stamp scale effect.
- **Interactive Whiteboard**: Draw and share sketches in real time.
- **Code-Together Editor**: Pair programming editor with syntax highlighting.
- **Audio & Video calls**: Mesh WebRTC calling with secure TURN configurations.
- **File Sharing & Breakout Rooms**: Drag-and-drop secure file transfers and sub-rooms.

---

## 🛠️ Tech Stack

**Client:**
- React (v19)
- Tailwind CSS
- Framer Motion (v12)
- Socket.io Client
- Lucide React

**Server:**
- Node.js & Express
- Socket.io
- MongoDB & Mongoose
- JSON Web Token (JWT) Authentication

---

## 🚀 Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/praveen542spk-ship-it/CodeAlpha_community-Hub.git
cd CodeAlpha_community-Hub
```

### 2. Configure Environment Variables
Create a `.env` file inside the `server/` directory:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/community-hub
JWT_SECRET=your_super_secret_jwt_key
```

### 3. Install dependencies & Run
**Server:**
```bash
cd server
npm install
npm start
```

**Client:**
```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.
