import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import API from '../api';

export default function Chat() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const msgRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const s = io('http://localhost:4000', { auth: { token } });
    s.on('connect', () => console.log('connected', s.id));
    s.on('message', (m) => setMessages((cur) => [...cur, m]));
    s.on('message_status', (st) => console.log('status', st));
    setSocket(s);
    return () => s.disconnect();
  }, []);

  useEffect(() => {
    if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight;
  }, [messages]);

  async function send() {
    if (!text || !socket) return;
    // For demo, use a fixed chatId (create one in DB manually or via API)
    const chatId = localStorage.getItem('demoChatId');
    if (!chatId) {
      alert('No demoChatId set. Create a chat via server or set localStorage demoChatId');
      return;
    }
    socket.emit('send_message', { clientMsgId: Date.now().toString(), chatId, type: 'text', content: text }, (ack) => {
      if (ack?.ok) {
        setMessages((cur) => [...cur, { messageId: ack.messageId, chatId, senderId: 'me', content: text, createdAt: new Date() }]);
        setText('');
      } else {
        alert('Send failed');
      }
    });
  }

  function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  return (
    <div className="chat-root">
      <div className="topbar">
        <h3>WhatsApp HLD Demo</h3>
        <div>
          <button onClick={() => alert('Not implemented: open contacts')}>Contacts</button>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="messages" ref={msgRef}>
        {messages.map((m, idx) => (
          <div key={idx} className={`message ${m.senderId === 'me' ? 'mine' : 'other'}`}>
            <div className="body">{m.content}</div>
            <div className="meta">{new Date(m.createdAt).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>

      <div className="composer">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
