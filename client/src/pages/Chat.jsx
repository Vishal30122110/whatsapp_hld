import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import API from '../api';

export default function Chat() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [text, setText] = useState('');
  const msgRef = useRef(null);

  useEffect(() => {
    async function init() {
      const token = localStorage.getItem('token');
      if (!token) return;

      // auto-create demoChat if missing
      let chatId = localStorage.getItem('demoChatId');
      if (!chatId) {
        try {
          const res = await API.post('/api/chat/demo');
          chatId = res.data.chatId;
          localStorage.setItem('demoChatId', chatId);
        } catch (err) {
          console.error('failed to create demo chat', err);
        }
      }

      // connect to same API backend (use Vite env if provided)
      const backend = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
        ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
        : 'http://localhost:4001';
      const s = io(backend, { auth: { token } });
    s.on('connect', () => console.log('connected', s.id));
    s.on('message', (m) => setMessages((cur) => [...cur, m]));
    s.on('mentioned', (ev) => {
      // simple notification when mentioned
      console.log('mentioned', ev);
    });
    s.on('message_status', (st) => console.log('status', st));
      setSocket(s);
      return () => s.disconnect();
    }

    init();
  }, []);

  async function fetchChats() {
    try {
      const res = await API.get('/api/chat');
      setChats(res.data.chats || []);
    } catch (err) {
      console.error('fetch chats error', err);
    }
  }

  useEffect(() => {
    fetchChats();
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

  async function createGroup() {
    const name = prompt('Group name');
    if (!name) return;
    try {
      const res = await API.post('/api/chat/group', { name });
      const chatId = res.data.chatId;
      localStorage.setItem('demoChatId', chatId);
      fetchChats();
      window.location.reload();
    } catch (err) {
      console.error('create group error', err);
      alert('Failed to create group');
    }
  }

  function selectChat(chatId) {
    localStorage.setItem('demoChatId', chatId);
    window.location.reload();
  }

  return (
    <div className="chat-root">
      <div style={{ display: 'flex', height: '80vh' }}>
        <aside style={{ width: 260, borderRight: '1px solid #eee', padding: 8, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Chats</strong>
            <button onClick={createGroup}>New Group</button>
          </div>
          <div style={{ marginTop: 8 }}>
            {chats.map((c) => {
              const token = localStorage.getItem('token');
              let title = c.type === 'group' ? c.name : 'Direct';
              if (c.type === 'direct' && Array.isArray(c.participants)) {
                const other = c.participants.find((p) => String(p.userId._id || p.userId) !== String(token));
                if (other && other.userId) title = other.userId.username || other.userId.phoneNumber || 'Direct';
              }
              return (
                <div key={String(c._id)} style={{ padding: 8, borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }} onClick={() => selectChat(c._id)}>
                  <div style={{ fontWeight: 600 }}>{title}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{c.type}</div>
                </div>
              );
            })}
          </div>
        </aside>

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="topbar">
            <h3>WhatsApp HLD Demo</h3>
            <div>
              <button onClick={() => alert('Not implemented: open contacts')}>Contacts</button>
              <button onClick={logout}>Logout</button>
            </div>
          </div>

          <div className="messages" ref={msgRef} style={{ flex: 1, overflow: 'auto' }}>
            {messages.map((m, idx) => {
              const meId = localStorage.getItem('token');
              const isMentioned = m.mentions && m.mentions.find && m.mentions.find((id) => String(id) === String(meId));
              const rendered = typeof m.content === 'string'
                ? m.content.replace(/@([a-zA-Z0-9_\-\.]+)/g, (all, name) => `<span class="mention">@${name}</span>`)
                : m.content;

              return (
                <div key={idx} className={`message ${m.senderId === 'me' ? 'mine' : 'other'} ${isMentioned ? 'mentioned' : ''}`}>
                  <div className="body" dangerouslySetInnerHTML={{ __html: rendered }} />
                  <div className="meta">{new Date(m.createdAt).toLocaleTimeString()}</div>
                </div>
              );
            })}
          </div>

          <div className="composer">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" />
            <button onClick={send}>Send</button>
          </div>
        </main>
      </div>
    </div>
  );
}
