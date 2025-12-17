import React, { useState } from 'react';
import API from '../api';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [msg, setMsg] = useState('');

  async function submit(e) {
    e.preventDefault();
    try {
      if (mode === 'login') {
        const res = await API.post('/api/auth/login', { phoneNumber: phone, password });
        localStorage.setItem('token', res.data.token);
        window.location.href = '/chat';
      } else {
        const res = await API.post('/api/auth/register', { phoneNumber: phone, username, password });
        localStorage.setItem('token', res.data.token);
        window.location.href = '/chat';
      }
    } catch (err) {
      setMsg(err.response?.data?.error || 'Server error');
    }
  }

  return (
    <div className="login">
      <h2>{mode === 'login' ? 'Login' : 'Register'}</h2>
      <form onSubmit={submit}>
        <input placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {mode === 'register' && <input placeholder="Display name" value={username} onChange={(e) => setUsername(e.target.value)} />}
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">{mode === 'login' ? 'Login' : 'Sign up'}</button>
      </form>
      <div className="mode-switch">
        <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Switch to register' : 'Switch to login'}</button>
      </div>
      {msg && <div className="msg">{msg}</div>}
    </div>
  );
}
