import React, { useState } from 'react';
import { login, signup } from '../lib/authStore';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 4) {
        setError('密码至少4位');
        return;
      }
      if (password !== confirmPassword) {
        setError('两次密码输入不一致');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await signup(username.trim(), password);
      }
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200001,
      background: 'linear-gradient(135deg, #0a0f1a 0%, #0d1525 40%, #111d35 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'linear-gradient(145deg, rgba(30,20,40,0.98), rgba(20,15,30,0.98))',
        borderRadius: '24px', padding: '40px 28px',
        maxWidth: '380px', width: '100%',
        border: '1px solid rgba(255,180,220,0.2)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 60px rgba(255,150,200,0.1)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🌍</div>
        <h2 style={{
          color: '#fff', margin: '0 0 4px', fontSize: '22px', fontWeight: 700,
          letterSpacing: '2px',
        }}>
          ToWhere
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.35)', margin: '0 0 32px', fontSize: '13px' }}>
          {mode === 'login' ? '欢迎回来，继续探索世界' : '创建账号，开始记录旅程'}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="用户名"
              style={inputStyle}
              autoFocus
            />
          </div>
          <div style={{ marginBottom: mode === 'signup' ? '16px' : '24px' }}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="密码"
              style={inputStyle}
            />
          </div>

          {mode === 'signup' && (
            <div style={{ marginBottom: '24px' }}>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="确认密码"
                style={inputStyle}
              />
            </div>
          )}

          {error && (
            <p style={{
              color: '#ff6b6b', fontSize: '13px', margin: '0 0 16px',
              lineHeight: '1.5',
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
              background: loading
                ? 'rgba(255,255,255,0.08)'
                : 'linear-gradient(135deg, #f9a8d4, #c084fc)',
              color: loading ? 'rgba(255,255,255,0.3)' : '#1a0a20',
              fontSize: '15px', fontWeight: 600, cursor: loading ? 'default' : 'pointer',
              letterSpacing: '1px',
            }}
          >
            {loading ? '请稍候...' : mode === 'login' ? '登 录' : '注 册'}
          </button>
        </form>

        <p style={{ color: 'rgba(255,255,255,0.3)', margin: '20px 0 0', fontSize: '13px' }}>
          {mode === 'login' ? '还没有账号？' : '已有账号？'}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
            style={{
              background: 'none', border: 'none', color: '#f9a8d4',
              cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              padding: '0 0 0 4px',
            }}
          >
            {mode === 'login' ? '注册' : '登录'}
          </button>
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px', color: 'white', fontSize: '15px', outline: 'none',
  textAlign: 'center',
};
