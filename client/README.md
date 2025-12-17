# WhatsApp HLD - Client

Minimal React dev client to demo login and WebSocket messaging.

Quick start:

1. cd client
2. npm install
3. npm run dev

The client expects the server to run on http://localhost:4000.

Notes:
- Create a chat on the server and set its id in localStorage: in browser console run `localStorage.setItem('demoChatId', '<CHAT_ID>')` before sending messages.
- The client stores JWT in localStorage after login.
