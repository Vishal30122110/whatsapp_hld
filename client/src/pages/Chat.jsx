import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import API from '../api';

export default function Chat() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [chats, setChats] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [contactsVisible, setContactsVisible] = useState(false);
  const [text, setText] = useState('');
  const msgRef = useRef(null);

  useEffect(() => {
    async function init() {
      const token = localStorage.getItem('token');
      if (!token) return;
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
      const backend = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
        ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
        : 'http://localhost:4001';
      const s = io(backend, { auth: { token } });
    s.on('connect', () => console.log('connected', s.id));
    s.on('message', (m) => {
      setMessages((cur) => {
        const exists = cur.find((msg) => String(msg.messageId) === String(m.messageId));
        if (exists) {
          return cur.map((msg) => (String(msg.messageId) === String(m.messageId) ? { ...msg, ...m, senderId: m.senderId } : msg));
        }
        return [...cur, m];
      });
    });
    s.on('mentioned', (ev) => {
      console.log('mentioned', ev);
    });
    s.on('message_status', (st) => console.log('status', st));
      setSocket(s);
      // set current chat, join room and fetch its messages
      setCurrentChatId(chatId);
      try {
        s.emit('join_chat', { chatId });
      } catch (e) {
        console.error('join_chat emit failed', e);
      }
      fetchMessages(chatId).catch((e) => console.error('fetchMessages init error', e));
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

  async function fetchContacts() {
    try {
      const res = await API.get('/api/users');
      setContacts(res.data.users || []);
    } catch (err) {
      console.error('fetch contacts error', err);
      setContacts([]);
    }
  }

  async function fetchMessages(chatId) {
    if (!chatId) return setMessages([]);
    try {
      const res = await API.get(`/api/chat/${chatId}/messages`);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('fetch messages error', err);
      setMessages([]);
    }
  }

  useEffect(() => {
    if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight;
  }, [messages]);

  async function send() {
    if (!text || !socket) return;
    const chatId = currentChatId || localStorage.getItem('demoChatId');
    if (!chatId) {
      alert('No demoChatId set. Create a chat via server or set localStorage demoChatId');
      return;
    }
    const clientMsgId = Date.now().toString();
    // optimistic append
    setMessages((cur) => [...cur, { messageId: clientMsgId, chatId, senderId: 'me', content: text, createdAt: new Date() }]);
    socket.emit('send_message', { clientMsgId, chatId, type: 'text', content: text }, (ack) => {
      if (ack?.ok) {
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
      await fetchChats();
      setCurrentChatId(chatId);
      try {
        socket && socket.emit('join_chat', { chatId });
      } catch (e) {
        console.error('join_chat emit failed', e);
      }
      await fetchMessages(chatId);
    } catch (err) {
      console.error('create group error', err);
      alert('Failed to create group');
    }
  }

  function selectChat(chatId) {
    localStorage.setItem('demoChatId', chatId);
    setCurrentChatId(chatId);
    fetchMessages(chatId).catch((e) => console.error('fetchMessages select error', e));
    try {
      socket && socket.emit('join_chat', { chatId });
    } catch (e) {
      console.error('join_chat emit failed', e);
    }
  }

  return (
    <div className="chat-root">
      <div style={{ display: 'flex', height: '80vh' }}>
        <aside style={{ width: 260, borderRight: '1px solid #eee', padding: 8, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Chats</strong>
            <div>
              <button onClick={() => {
                const q = prompt('Search user by phone or username');
                if (!q) return;
                // search and create direct chat with first result
                API.get(`/api/users/search?q=${encodeURIComponent(q)}`).then((r) => {
                  const u = r.data.users && r.data.users[0];
                  if (!u) return alert('No user found');
                  API.post('/api/chat/direct', { otherUserId: u._id }).then((rr) => {
                    const newId = rr.data.chatId;
                    localStorage.setItem('demoChatId', newId);
                    fetchChats();
                    setCurrentChatId(newId);
                    try {
                      socket && socket.emit('join_chat', { chatId: newId });
                    } catch (e) {
                      console.error('join_chat emit failed', e);
                    }
                    fetchMessages(newId).catch((e) => console.error('fetchMessages new direct error', e));
                  }).catch((err) => alert('Failed to create direct chat'));
                }).catch((err) => alert('Search failed'));
              }}>New Direct</button>
              <button onClick={createGroup} style={{ marginLeft: 6 }}>New Group</button>
            </div>
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
            <h3>WhatsApp</h3>
            <div>
              <button onClick={async () => { setContactsVisible((v) => !v); if (!contactsVisible) await fetchContacts(); }}>Contacts</button>
              <button onClick={logout}>Logout</button>
            </div>
          </div>

          {contactsVisible && (
            <div style={{ position: 'absolute', right: 24, top: 72, width: 320, maxHeight: '60vh', overflow: 'auto', background: '#fff', border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.08)', zIndex: 200 }}>
              <div style={{ padding: 8, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Contacts</strong>
                <button onClick={() => setContactsVisible(false)}>Close</button>
              </div>
              <div>
                {contacts.length === 0 && <div style={{ padding: 12, color: '#666' }}>No contacts found</div>}
                {contacts.map((u) => (
                  <div key={String(u._id)} style={{ padding: 10, borderBottom: '1px solid #f3f3f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.username || u.phoneNumber}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{u.phoneNumber}</div>
                    </div>
                    <div>
                      <button onClick={async () => {
                        try {
                          const rr = await API.post('/api/chat/direct', { otherUserId: u._id });
                          localStorage.setItem('demoChatId', rr.data.chatId);
                          setContactsVisible(false);
                          await fetchChats();
                        } catch (err) {
                          alert('Failed to create direct chat');
                        }
                      }}>Chat</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="messages" ref={msgRef} style={{ flex: 1, overflow: 'auto' }}>
            {messages.map((m, idx) => {
              const meId = localStorage.getItem('token');
              const isMentioned = m.mentions && m.mentions.find && m.mentions.find((id) => String(id) === String(meId));
              const rendered = typeof m.content === 'string'
                ? m.content.replace(/@([a-zA-Z0-9_\-\.]+)/g, (all, name) => `<span class="mention">@${name}</span>`)
                : m.content;

              return (
                <div key={String(m.messageId || idx)} className={`message ${m.senderId === 'me' ? 'mine' : 'other'} ${isMentioned ? 'mentioned' : ''}`}>
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
