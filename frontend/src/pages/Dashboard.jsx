import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import Skeleton from '../components/Skeleton';
import Tabs from '../components/Tabs';
import OverviewDashboard from '../components/dashboard/OverviewDashboard';
import TypeDashboard from '../components/dashboard/TypeDashboard';
import OccasionDashboard from '../components/dashboard/OccasionDashboard';

/**
 * Tabbed financial dashboard.
 *
 * Tabs: Overview (the classic aggregated dashboard, unchanged) plus one tab
 * per contribution type (Monthly / Float / Projects / End of Year / Welfare),
 * each showing the same widget set scoped to that type's data.
 *
 * The active tab is kept in the URL (?tab=float) so it survives refresh and
 * can be shared/bookmarked. Missing or invalid values fall back to the
 * default tab. Data for each tab is fetched once per page visit and cached
 * for the lifetime of the visit, so switching back and forth is instant
 * while every fresh visit still sees fresh numbers.
 */
const DASH_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'float', label: 'Float' },
  { key: 'projects', label: 'Projects' },
  { key: 'end-of-year', label: 'End of Year' },
  { key: 'welfare', label: 'Welfare' },
];

const DEFAULT_TAB = 'overview';

// Occasional funds (1-3 activations per year) get the occasion-based
// analytics view instead of the monthly-window view.
const OCCASION_FUNDS = ['float', 'projects', 'end-of-year'];

const TAB_LABEL = DASH_TABS.reduce((m, t) => ({ ...m, [t.key]: t.label }), {});

export default function Dashboard() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const requested = params.get('tab');
  const tab = TAB_LABEL[requested] ? requested : DEFAULT_TAB;

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const cacheRef = useRef(new Map());

  const isOccasion = OCCASION_FUNDS.includes(tab);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');

    // Occasion tabs fetch their own analytics; no /dashboard payload needed
    if (OCCASION_FUNDS.includes(tab)) {
      setData({ occasion: true });
      return;
    }

    const cache = cacheRef.current;
    if (!cache.has(tab)) {
      const promise = tab === 'overview'
        ? api('/dashboard')
        : api(`/dashboard?type=${encodeURIComponent(tab)}`);
      // Never cache failures: drop the entry so a retry can happen
      promise.catch(() => cache.delete(tab));
      cache.set(tab, promise);
    }

    cache.get(tab)
      .then((d) => {
        if (!alive) return;
        // Safety guard: a backend that doesn't know ?type= would return the
        // estate-wide aggregate, which must never be displayed as if it were
        // type-scoped. The contract requires a scope echo on type responses;
        // without it we show an error instead of wrong numbers.
        if (tab !== 'overview' && d?.scope?.type !== tab) {
          cache.delete(tab);
          setError('Scoped data for this tab is not available yet. The backend needs the "?type=" update described in docs/BACKEND_CONTRACT.md.');
          return;
        }
        setData(d);
      })
      .catch((e) => { if (alive) setError(e.message); });

    return () => { alive = false; };
  }, [tab]);

  const changeTab = (key) => {
    if (key === tab) return;
    // replace:true keeps rapid tab-switching from flooding browser history
    setParams(key === DEFAULT_TAB ? {} : { tab: key }, { replace: true });
  };

  const isMember = user?.role === 'member';

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
        <Tabs tabs={DASH_TABS} active={tab} onChange={changeTab} />
        <div style={{ padding: '40px', color: '#ef4444', textAlign: 'center' }}>
          <h2>Error Loading Dashboard</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
        <Skeleton height="40px" width="300px" style={{ marginBottom: '24px' }} />
        <div style={{ marginBottom: '24px' }}>
          <Tabs tabs={DASH_TABS} active={tab} onChange={() => {}} style={{ pointerEvents: 'none', opacity: 0.6 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} height="140px" width="100%" />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827', letterSpacing: '-0.02em' }}>
          {isMember ? `Welcome back, ${user?.name || 'Resident'}` : 'Financial Dashboard'}
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
          Real-time overview of estate finances • {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <Tabs tabs={DASH_TABS} active={tab} onChange={changeTab} />

      {isOccasion
        ? <OccasionDashboard typeKey={tab} typeLabel={TAB_LABEL[tab]} />
        : tab === 'overview'
          ? <OverviewDashboard data={data} />
          : <TypeDashboard data={data} typeKey={tab} typeLabel={TAB_LABEL[tab]} />}
    </div>
  );
}
