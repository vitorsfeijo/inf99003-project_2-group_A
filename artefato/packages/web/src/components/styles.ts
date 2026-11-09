import React from 'react';

export const card: React.CSSProperties = { padding: 14, borderRadius: 14, background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,.1), 0 8px 24px rgba(15,23,42,.04)' };
export const label: React.CSSProperties = { display: 'block', fontSize: 12, color: '#475569', fontWeight: 700, marginBottom: 5 };
export const input: React.CSSProperties = { width: '100%', minHeight: 42, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#0f172a', fontSize: 14 };
export const hint: React.CSSProperties = { fontSize: 11, lineHeight: 1.4, color: '#64748b', marginTop: 6 };
export const secondaryButton: React.CSSProperties = { ...input, minHeight: 38, background: '#e0e7ff', border: 'none', color: '#1e40af', fontWeight: 700, cursor: 'pointer' };
export const linkButton: React.CSSProperties = { minHeight: 32, padding: '0 6px', background: 'transparent', color: '#1d4ed8', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 12 };
export const dangerLink: React.CSSProperties = { ...linkButton, color: '#b91c1c' };

export function chip(active: boolean): React.CSSProperties {
  return { minHeight: 30, padding: '4px 9px', borderRadius: 999, fontSize: 12, fontWeight: 650, cursor: 'pointer',
    border: `1px solid ${active ? '#2563eb' : '#cbd5e1'}`, background: active ? '#dbeafe' : '#fff', color: active ? '#1e3a8a' : '#334155' };
}

export function badge(color: string, background: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', borderRadius: 999, fontSize: 11,
    fontWeight: 700, color, background, whiteSpace: 'nowrap' };
}
