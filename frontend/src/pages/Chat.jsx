import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import Skeleton from '../components/Skeleton';

const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const POLL_MS = 5000;

const ROLE_CHIP = {
  admin: { bg: '#fff1f2', text: '#e11d48' },
  treasurer: { bg: '#eef2ff', text: '#4f46e5' },
  member: { bg: '#f3f4f6', text: '#6b7280' },
};

const clock = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function Chat() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [image, setImage] = useState(null); // { mime, data, preview }
  const [imgError, setImgError] = useState('');
  const [sending, setSending] = useState(false);
  const lastIdRef = useRef(0);
  const listRef = useRef(null);
  const fileRef = useRef(null);

  const isStaff = ['admin', 'treasurer'].includes(user?.role);

  const scrollToEnd = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const nearBottom = () => {
    const el = listRef.current;
    return el ? el.scrollHeight - el.scrollTop - el.clientHeight < 120 : true;
  };

  // initial load
  useEffect(() => {
    let alive = true;
    api('/chat')
      .then((res) => {
        if (!alive) return;
        setMsgs(res.messages || []);
        lastIdRef.current = res.latest_id || 0;
        setTimeout(scrollToEnd, 50);
      })
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, []);

  // poll for new messages
  useEffect(() => {
    const t = setInterval(async () => {
      if (!lastIdRef.current) return;
      try {
        const res = await api(`/chat?after=${lastIdRef.current}`);
        if (res.messages && res.messages.length) {
          const stick = nearBottom();
          setMsgs((m) => [...(m || []), ...res.messages]);
          lastIdRef.current = res.latest_id;
          if (stick) setTimeout(scrollToEnd, 50);
        }
      } catch {
        /* transient poll failure: ignore, next tick retries */
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const pickImage = (file) => {
    setImgError('');
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      setImgError('Only PNG, JPEG, GIF or WebP images.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImgError('Image too large — 1.5 MB max.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const [meta, data] = String(dataUrl).split(',');
      const mime = (meta.match(/data:(.*?);/) || [])[1] || file.type;
      setImage({ mime, data, preview: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body && !image) return;
    setSending(true);
    try {
      const res = await api('/chat', {
        method: 'POST',
        body: { body, image: image ? { mime: image.mime, data: image.data } : undefined },
      });
      const stick = nearBottom();
      setMsgs((m) => [...(m || []), res.message]);
      lastIdRef.current = Math.max(lastIdRef.current, Number(res.message.id) || 0);
      setText('');
      setImage(null);
      if (fileRef.current) fileRef.current.value = '';
      if (stick) setTimeout(scrollToEnd, 50);
    } catch (err) {
      setImgError(err.message);
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await api(`/chat/${id}`, { method: 'DELETE' });
      setMsgs((m) => (m || []).filter((x) => String(x.id) !== String(id)));
    } catch (err) {
      setImgError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>💬</div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.9rem', fontWeight: '700', color: '#111827', letterSpacing: '-0.02em' }}>Community Lounge</h1>
          <p style={{ margin: '2px 0 0 0', color: '#6b7280', fontSize: '0.95rem' }}>
            Chat with your neighbours · share fun pictures · be kind 🙂
          </p>
        </div>
      </div>

      {/* Room */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', borderTop: '4px solid #22c55e', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div
          ref={listRef}
          style={{ height: '58vh', overflowY: 'auto', padding: '24px', background: 'linear-gradient(180deg, #f9fafb 0%, #ffffff 100%)', display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          {error ? (
            <div style={{ textAlign: 'center', color: '#ef4444', padding: '40px 0' }}>
              <p style={{ fontWeight: '600' }}>Error loading the lounge</p>
              <p style={{ fontSize: '0.9rem' }}>{error}</p>
            </div>
          ) : msgs === null ? (
            <Skeleton height="100%" />
          ) : msgs.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎉</div>
              <p style={{ fontSize: '1.05rem', fontWeight: '600', color: '#6b7280' }}>The lounge is quiet</p>
              <p style={{ fontSize: '0.9rem' }}>Say hello — or drop the first fun picture!</p>
            </div>
          ) : (
            msgs.map((m) => {
              const mine = m.author_id === user?.id;
              const role = ROLE_CHIP[m.author_role] || ROLE_CHIP.member;
              const canDelete = mine || isStaff;
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: mine ? 'row-reverse' : 'row', gap: '10px', alignItems: 'flex-end' }}>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                    background: mine ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#e5e7eb',
                    color: mine ? '#fff' : '#374151',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: '700', fontSize: '0.85rem',
                  }}>
                    {(m.author_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{
                    maxWidth: '72%',
                    background: mine ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : '#fff',
                    color: mine ? '#fff' : '#111827',
                    border: mine ? 'none' : '1px solid #e5e7eb',
                    borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '10px 14px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                    position: 'relative',
                  }}>
                    {!mine && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.8rem', color: '#374151' }}>{m.author_name}</span>
                        <span style={{ padding: '1px 8px', borderRadius: '8px', background: role.bg, color: role.text, fontSize: '0.62rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.author_role}</span>
                      </div>
                    )}
                    {m.image_data && (
                      <img
                        src={`data:${m.image_mime};base64,${m.image_data}`}
                        alt="shared"
                        style={{ maxWidth: '240px', width: '100%', borderRadius: '10px', display: 'block', marginBottom: m.body ? '8px' : 0 }}
                      />
                    )}
                    {m.body && <div style={{ fontSize: '0.92rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.body}</div>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.68rem', opacity: 0.7 }}>{clock(m.created_at)}</span>
                      {canDelete && (
                        <button
                          onClick={() => remove(m.id)}
                          title="Delete message"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.7rem', opacity: 0.6, color: mine ? '#fff' : '#991b1b', padding: 0 }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <form onSubmit={send} style={{ borderTop: '1px solid #e5e7eb', padding: '16px 20px', background: '#fff' }}>
          {imgError && (
            <div style={{ marginBottom: '10px', padding: '8px 12px', borderRadius: '8px', background: '#fff1f2', color: '#991b1b', border: '1px solid #fecdd3', fontSize: '0.85rem' }}>
              {imgError}
            </div>
          )}
          {image && (
            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src={image.preview} alt="attachment" style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #e5e7eb' }} />
              <button type="button" onClick={() => { setImage(null); if (fileRef.current) fileRef.current.value = ''; }} style={{ border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
                Remove
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <input
              ref={fileRef}
              type="file"
              accept={ALLOWED_MIME.join(',')}
              onChange={(e) => pickImage(e.target.files[0])}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileRef.current && fileRef.current.click()}
              title="Attach a fun image (max 1.5 MB)"
              style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontSize: '1.05rem' }}
            >
              📎
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }}
              rows="1"
              placeholder="Message the estate… (Enter to send, Shift+Enter for a new line)"
              style={{ flex: 1, padding: '12px 14px', borderRadius: '12px', border: '1px solid #d1d5db', fontSize: '0.95rem', fontFamily: 'inherit', resize: 'none', outline: 'none', maxHeight: '120px' }}
              onFocus={(e) => { e.target.style.borderColor = '#22c55e'; e.target.style.boxShadow = '0 0 0 3px rgba(34,197,94,0.15)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; }}
            />
            <button
              type="submit"
              disabled={sending || (!text.trim() && !image)}
              style={{
                padding: '12px 22px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #22c55e 100%)',
                color: '#fff', fontWeight: '700', fontSize: '0.9rem',
                cursor: sending || (!text.trim() && !image) ? 'not-allowed' : 'pointer',
                opacity: sending || (!text.trim() && !image) ? 0.6 : 1,
                boxShadow: '0 4px 14px rgba(34,197,94,0.35)',
              }}
            >
              {sending ? '…' : 'Send ➤'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
