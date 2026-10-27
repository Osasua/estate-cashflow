import React from 'react';

/**
 * Shared horizontal tab bar.
 *
 * Extracted verbatim from the tab bar that was inlined in Contribution.jsx,
 * so swapping it in produces zero visual difference there. The Dashboard now
 * reuses it for its Overview + per-contribution-type tabs.
 *
 * Props:
 *  - tabs:    array of strings OR { key, label } objects
 *  - active:  key of the active tab
 *  - onChange: (key) => void
 *  - style:   optional extra styles for the bar container
 *
 * Notes:
 *  - No font properties are set on purpose: the original buttons relied on
 *    browser defaults, and setting them here would shift the look.
 *  - overflowX:auto + whiteSpace:nowrap keep the bar usable on narrow
 *    screens without changing desktop rendering.
 */
export default function Tabs({ tabs, active, onChange, style }) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '2px solid #e5e7eb',
        overflowX: 'auto',
        ...style,
      }}
    >
      {tabs.map((t) => {
        const key = typeof t === 'string' ? t : t.key;
        const label = typeof t === 'string' ? t : t.label;
        const isActive = active === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            style={{
              padding: '10px 20px',
              background: isActive ? '#6366f1' : 'transparent',
              color: isActive ? 'white' : '#6b7280',
              border: 'none',
              fontWeight: isActive ? '600' : '500',
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
