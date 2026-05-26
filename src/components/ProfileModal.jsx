import React, { useState } from 'react';
import { getProfile, saveProfile } from '../lib/profileStore';

export default function ProfileModal({ isOpen, onDone }) {
  const existing = getProfile();
  const [name1, setName1] = useState(existing.name1 || '小珠');
  const [name2, setName2] = useState(existing.name2 || '小羊');
  const [metYear, setMetYear] = useState(existing.metYear || '');
  const [metMonth, setMetMonth] = useState(existing.metMonth || '');
  const [metDay, setMetDay] = useState(existing.metDay || '');
  const [relYear, setRelYear] = useState(existing.relYear || '');
  const [relMonth, setRelMonth] = useState(existing.relMonth || '');
  const [relDay, setRelDay] = useState(existing.relDay || '');
  const [step, setStep] = useState(0); // 0: names, 1: dates

  if (!isOpen) return null;

  const canNextStep0 = name1.trim() && name2.trim();
  const canNextStep1 = metYear && metMonth && relYear && relMonth;

  const handleSave = () => {
    saveProfile({
      name1: name1.trim(),
      name2: name2.trim(),
      metYear, metMonth, metDay,
      relYear, relMonth, relDay,
    });
    onDone();
  };

  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200000,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'linear-gradient(145deg, rgba(30,20,40,0.98), rgba(20,15,30,0.98))',
        borderRadius: '24px', padding: '36px 28px',
        maxWidth: '400px', width: '100%',
        border: '1px solid rgba(255,180,220,0.2)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 60px rgba(255,150,200,0.1)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '8px' }}>💕</div>
        <h2 style={{
          color: '#fff', margin: '0 0 6px', fontSize: '20px', fontWeight: 700,
          letterSpacing: '2px',
        }}>
          {step === 0 ? '你们是谁？' : '重要的日子'}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 28px', fontSize: '13px' }}>
          {step === 0 ? '这些信息会让回忆更温暖' : '不记得具体日期可以留空'}
        </p>

        {step === 0 && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#f9a8d4', fontSize: '13px', marginBottom: '6px', display: 'block' }}>👧 她的名字</label>
              <input value={name1} onChange={e => setName1(e.target.value)}
                placeholder="小珠" style={inputStyle} autoFocus />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ color: '#93c5fd', fontSize: '13px', marginBottom: '6px', display: 'block' }}>👦 他的名字</label>
              <input value={name2} onChange={e => setName2(e.target.value)}
                placeholder="小羊" style={inputStyle} />
            </div>
            <button onClick={() => setStep(1)} disabled={!canNextStep0}
              style={btnStyle(canNextStep0)}>继续</button>
          </>
        )}

        {step === 1 && (
          <>
            {/* 相识时间 */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: '#f9a8d4', fontSize: '14px', margin: '0 0 8px', fontWeight: 600 }}>💫 相识时间</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={metYear} onChange={e => setMetYear(e.target.value)} style={selectStyle}>
                  <option value="">年</option>
                  {Array.from({ length: 20 }, (_, i) => 2026 - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select value={metMonth} onChange={e => setMetMonth(e.target.value)} style={selectStyle}>
                  <option value="">月</option>
                  {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={metDay} onChange={e => setMetDay(e.target.value)} style={{ ...selectStyle, opacity: 0.5 }}>
                  <option value="">日</option>
                  {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 确认关系 */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: '#f9a8d4', fontSize: '14px', margin: '0 0 8px', fontWeight: 600 }}>💝 在一起的日期</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={relYear} onChange={e => setRelYear(e.target.value)} style={selectStyle}>
                  <option value="">年</option>
                  {Array.from({ length: 20 }, (_, i) => 2026 - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select value={relMonth} onChange={e => setRelMonth(e.target.value)} style={selectStyle}>
                  <option value="">月</option>
                  {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={relDay} onChange={e => setRelDay(e.target.value)} style={{ ...selectStyle, opacity: 0.5 }}>
                  <option value="">日</option>
                  {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(0)} style={{ ...btnStyle(true), background: 'rgba(255,255,255,0.08)', flex: 1 }}>
                上一步
              </button>
              <button onClick={handleSave} disabled={!canNextStep1}
                style={{ ...btnStyle(canNextStep1), flex: 1 }}>
                💝 开始记录
              </button>
            </div>
          </>
        )}
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

const selectStyle = {
  flex: 1, padding: '10px 8px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none',
  cursor: 'pointer', textAlign: 'center',
  WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none',
};

function btnStyle(enabled) {
  return {
    width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
    background: enabled ? 'linear-gradient(135deg, #f9a8d4, #c084fc)' : 'rgba(255,255,255,0.08)',
    color: enabled ? '#1a0a20' : 'rgba(255,255,255,0.3)',
    fontSize: '15px', fontWeight: 600, cursor: enabled ? 'pointer' : 'default',
    letterSpacing: '1px',
  };
}
