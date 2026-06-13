import { useState, useEffect, useRef } from "react";

// ─── CURRENCY CONFIG ──────────────────────────────────────────────────────────
// Exchange rates relative to BWP (Botswana Pula)
// These are approximate static rates — in production you'd fetch live rates
const CURRENCIES = {
  BWP: { symbol: "P",  name: "BWP — Pula",    rate: 1 },
  ZAR: { symbol: "R",  name: "ZAR — Rand",    rate: 1.26 },
  USD: { symbol: "$",  name: "USD — Dollar",  rate: 0.074 },
  EUR: { symbol: "€",  name: "EUR — Euro",    rate: 0.068 },
  GBP: { symbol: "£",  name: "GBP — Pound",   rate: 0.058 },
};

// Convert an amount from BWP to the selected currency
function convertAmount(amountInBWP, currencyCode) {
  const c = CURRENCIES[currencyCode] || CURRENCIES.BWP;
  return amountInBWP * c.rate;
}

// Format a BWP amount into the selected currency display
function formatMoney(amountInBWP, currencyCode) {
  const c = CURRENCIES[currencyCode] || CURRENCIES.BWP;
  const converted = amountInBWP * c.rate;
  return `${c.symbol} ${converted.toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── THEME ───────────────────────────────────────────────────────────────────
const COLORS = {
  navy: "#1A1A2E",
  navyDeep: "#0F0F1A",
  mint: "#00C896",
  mintDim: "#00C89620",
  bg: "#F7F9FC",
  surface: "#FFFFFF",
  danger: "#FF4757",
  text: "#2D3748",
  textMuted: "#718096",
  border: "#E2E8F0",
};

const taglines = [
  "Here's where your money went this month.",
  "Small steps, big savings.",
  "Your money, your clarity.",
  "Know more. Spend smarter.",
  "Every pula tells a story.",
];

const CATEGORIES = [
  { name: "Groceries",    icon: "🛒", color: "#00C896" },
  { name: "Transport",    icon: "🚗", color: "#4299E1" },
  { name: "Entertainment",icon: "🎬", color: "#9F7AEA" },
  { name: "Bills",        icon: "📄", color: "#ED8936" },
  { name: "Health",       icon: "💊", color: "#FC8181" },
  { name: "Shopping",     icon: "🛍️", color: "#F6C90E" },
  { name: "Food & Dining",icon: "🍽️", color: "#68D391" },
  { name: "Other",        icon: "📦", color: "#CBD5E0" },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; }
    catch { return initial; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(val)); }, [key, val]);
  return [val, setVal];
}

// BATCH 1: Helper to get gross income from incomes array or fallback to user.income
function getGrossIncome(incomes, userIncome) {
  if (incomes && incomes.length > 0) {
    return incomes.reduce((sum, inc) => sum + inc.amount, 0);
  }
  return userIncome || 0;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
// The app manages its own light/dark theme via a class on <html>
// .dark class = dark mode, default = light mode
// This avoids relying on system CSS variables which caused invisible text bugs
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── LIGHT MODE (default) ── */
  :root {
    --navy: #1A1A2E;
    --navy-deep: #0F0F1A;
    --mint: #00C896;
    --bg: #F7F9FC;
    --surface: #FFFFFF;
    --danger: #FF4757;
    --text: #2D3748;
    --muted: #718096;
    --border: #E2E8F0;
    --stat-value: #1A1A2E;
    --greeting-name: #1A1A2E;
    --card-bg: #FFFFFF;
  }

  /* ── DARK MODE — toggled by adding class="dark" to <html> ── */
  html.dark {
    --bg: #0F0F1A;
    --surface: #1A1A2E;
    --text: #E2E8F0;
    --muted: #A0AEC0;
    --border: #2D3748;
    --stat-value: #E2E8F0;
    --greeting-name: #00C896;
    --card-bg: #1A1A2E;
  }

  html { color-scheme: light dark; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    -webkit-text-size-adjust: 100%;
    transition: background 0.25s, color 0.25s;
  }

  input, select, button, textarea { -webkit-appearance: none; font-family: 'DM Sans', sans-serif; }

  .app { display: flex; min-height: 100vh; }

  /* ── SIDEBAR ── */
  .sidebar {
    width: 240px; min-height: 100vh; background: var(--navy-deep);
    display: flex; flex-direction: column; padding: 32px 0;
    position: fixed; left: 0; top: 0; z-index: 100;
    transition: transform 0.3s ease;
  }
  .sidebar-logo { padding: 0 24px 32px; border-bottom: 1px solid #ffffff10; }
  .logo-text { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px; }
  .logo-dot { color: var(--mint); }
  .sidebar-nav { flex: 1; padding: 24px 12px; display: flex; flex-direction: column; gap: 4px; }
  .nav-item {
    display: flex; align-items: center; gap: 12px; padding: 12px 16px;
    border-radius: 10px; cursor: pointer; transition: all 0.2s;
    color: #ffffff60; font-size: 14px; font-weight: 500;
    border: none; background: none; width: 100%; text-align: left;
  }
  .nav-item:hover { background: #ffffff10; color: white; }
  .nav-item.active { background: #00C89615; color: var(--mint); }
  .nav-item .nav-icon { font-size: 18px; width: 24px; text-align: center; }
  .sidebar-footer { padding: 24px; border-top: 1px solid #ffffff10; }
  .user-chip { display: flex; align-items: center; gap: 10px; background: #ffffff08; border-radius: 10px; padding: 10px 12px; }
  .user-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--mint); display: flex; align-items: center; justify-content: center; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; color: var(--navy-deep); flex-shrink: 0; }
  .user-name { color: white; font-size: 13px; font-weight: 500; }

  /* ── MOBILE HEADER ── */
  .mobile-header {
    display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 200;
    background: var(--navy-deep); padding: 16px 20px;
    align-items: center; justify-content: space-between;
    border-bottom: 1px solid #ffffff10; height: 60px;
  }
  .hamburger { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; gap: 5px; padding: 4px; }
  .hamburger span { display: block; width: 22px; height: 2px; background: white; border-radius: 2px; }
  .mobile-overlay { display: none; position: fixed; inset: 0; background: #00000080; z-index: 150; pointer-events: none; }
  .mobile-overlay.open { display: block; pointer-events: all; }

  /* ── MAIN CONTENT ── */
  .main { margin-left: 240px; flex: 1; padding: 40px; min-height: 100vh; background: var(--bg); }

  /* ── AUTH SCREEN ── */
  .auth-screen {
    min-height: 100vh; background: var(--navy-deep);
    display: flex; align-items: center; justify-content: center; padding: 20px;
    background-image: radial-gradient(ellipse at 20% 50%, #00C89610 0%, transparent 60%),
                      radial-gradient(ellipse at 80% 20%, #4299E110 0%, transparent 60%);
  }
  .auth-card { background: var(--navy); border: 1px solid #ffffff10; border-radius: 20px; padding: 48px 40px; width: 100%; max-width: 420px; box-shadow: 0 40px 80px #00000060; }
  .auth-logo { text-align: center; margin-bottom: 8px; }
  .auth-logo-text { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; color: white; }
  .auth-tagline { text-align: center; color: #ffffff50; font-size: 13px; margin-bottom: 36px; }
  .auth-tabs { display: flex; background: #ffffff08; border-radius: 10px; padding: 4px; margin-bottom: 28px; }
  .auth-tab { flex: 1; padding: 10px; border: none; border-radius: 8px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; background: none; color: #ffffff50; transition: all 0.2s; }
  .auth-tab.active { background: var(--mint); color: var(--navy-deep); }
  .form-group { margin-bottom: 16px; }
  .form-label { display: block; color: #ffffff70; font-size: 12px; font-weight: 500; margin-bottom: 8px; letter-spacing: 0.5px; text-transform: uppercase; }
  .form-input { width: 100%; padding: 14px 16px; background: #ffffff08; border: 1px solid #ffffff15; border-radius: 10px; color: white; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: all 0.2s; }
  .form-input:focus { border-color: var(--mint); background: #ffffff10; }
  .form-input::placeholder { color: #ffffff30; }
  .btn-primary { width: 100%; padding: 15px; background: var(--mint); color: var(--navy-deep); border: none; border-radius: 10px; font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 8px; transition: all 0.2s; }
  .btn-primary:hover { background: #00e0aa; transform: translateY(-1px); }
  .btn-primary:active { transform: translateY(0); }

  /* ── PAGE LAYOUT ── */
  .page-header { margin-bottom: 32px; }
  .greeting { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 700; color: var(--text); }
  .greeting-name { color: var(--greeting-name); }
  .greeting-tagline { color: var(--muted); font-size: 15px; margin-top: 4px; }

  /* BATCH 1: Enhanced income banner styles */
  .income-banner { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px 20px; margin-bottom: 24px; }
  .income-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 12px; }
  .income-total { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: var(--stat-value); }
  .income-total-label { font-size: 13px; color: var(--muted); margin-right: 8px; }
  .btn-add-income { padding: 8px 16px; background: var(--mint); color: var(--navy-deep); border: none; border-radius: 8px; font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; cursor: pointer; }
  .income-sources { margin-top: 12px; }
  .income-source-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
  .income-source-row:last-child { border-bottom: none; }
  .income-source-type { display: flex; align-items: center; gap: 8px; }
  .income-badge { background: #00C89615; color: var(--mint); padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .income-source-label { color: var(--text); }
  .income-source-amount { font-weight: 600; color: var(--stat-value); }
  .income-credited-section { margin-top: 12px; padding-top: 8px; border-top: 1px dashed var(--border); }
  .income-toggle { cursor: pointer; color: var(--mint); font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 8px; }
  .income-credited-list { margin-left: 16px; }

  /* ── STAT CARDS ── */
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
  .stat-card { background: var(--surface); border-radius: 16px; padding: 24px; border: 1px solid var(--border); position: relative; overflow: hidden; transition: transform 0.2s; }
  .stat-card:hover { transform: translateY(-2px); }
  .stat-card::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
  .stat-card.spent::after { background: var(--danger); }
  .stat-card.free::after { background: var(--mint); }
  .stat-card.savings::after { background: #F6C90E; }
  .stat-label { font-size: 12px; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
  /* stat-value uses its own variable so it's always visible in both modes */
  .stat-value { font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 700; color: var(--stat-value); }
  .stat-sub { font-size: 12px; color: var(--muted); margin-top: 6px; }

  /* ── CARDS ── */
  .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
  .card { background: var(--surface); border-radius: 16px; padding: 24px; border: 1px solid var(--border); }
  .card-title { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 20px; }

  /* ── DONUT CHART ── */
  .donut-wrap { display: flex; align-items: center; gap: 24px; }
  .donut-svg { flex-shrink: 0; }
  .donut-legend { display: flex; flex-direction: column; gap: 10px; flex: 1; }
  .legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .legend-name { color: var(--muted); flex: 1; }
  .legend-val { font-weight: 600; color: var(--text); font-size: 12px; }

  /* ── BAR CHART ── */
  .bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 120px; padding-bottom: 24px; }
  .bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; }
  .bar { width: 100%; border-radius: 6px 6px 0 0; background: var(--mint); opacity: 0.3; min-height: 4px; }
  .bar.active { opacity: 1; }
  .bar-label { font-size: 11px; color: var(--muted); }

  /* ── EMPTY STATE ── */
  .empty-state { text-align: center; padding: 40px 20px; }
  .empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
  .empty-text { color: var(--muted); font-size: 14px; }
  .empty-sub { color: var(--muted); font-size: 12px; margin-top: 6px; opacity: 0.7; }

  /* ── TRANSACTIONS ── */
  .tx-list { display: flex; flex-direction: column; }
  .tx-item { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--border); }
  .tx-item:last-child { border-bottom: none; }
  .tx-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
  .tx-info { flex: 1; min-width: 0; }
  .tx-name { font-size: 14px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tx-date { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .tx-amount { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; white-space: nowrap; }
  .tx-amount.debit { color: var(--danger); }
  .tx-amount.credit { color: var(--mint); }
  .cat-badge { font-size: 11px; padding: 3px 8px; border-radius: 20px; font-weight: 500; white-space: nowrap; }

  /* ── UPLOAD ── */
  .upload-zone { border: 2px dashed var(--border); border-radius: 20px; padding: 60px 40px; text-align: center; cursor: pointer; transition: all 0.3s; background: var(--surface); margin-bottom: 24px; }
  .upload-zone:hover, .upload-zone.dragover { border-color: var(--mint); background: #00C89608; }
  .upload-icon { font-size: 48px; margin-bottom: 16px; }
  .upload-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
  .upload-sub { color: var(--muted); font-size: 14px; margin-bottom: 24px; }
  .btn-upload { display: inline-block; padding: 12px 28px; background: var(--mint); color: var(--navy-deep); border: none; border-radius: 10px; font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; }
  .format-pills { display: flex; gap: 8px; justify-content: center; margin-top: 16px; }
  .format-pill { padding: 4px 12px; background: #00C89615; color: var(--mint); border-radius: 20px; font-size: 12px; font-weight: 600; }

  /* ── GOALS ── */
  .goals-grid { display: flex; flex-wrap: wrap; gap: 16px; }
  .goal-card { background: var(--surface); border-radius: 16px; padding: 24px; border: 1px solid var(--border); flex: 1; min-width: 260px; }
  .goal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .goal-name { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); }
  .goal-emoji { font-size: 24px; }
  .goal-amounts { display: flex; justify-content: space-between; margin-bottom: 10px; align-items: flex-end; }
  .goal-saved { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: var(--stat-value); }
  .goal-target { font-size: 13px; color: var(--muted); }
  .progress-bar { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-bottom: 10px; }
  .progress-fill { height: 100%; background: var(--mint); border-radius: 3px; transition: width 0.6s ease; }
  .goal-meta { font-size: 12px; color: var(--muted); }
  .add-goal-card { background: none; border: 2px dashed var(--border); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s; min-height: 160px; flex: 1; min-width: 260px; }
  .add-goal-card:hover { border-color: var(--mint); background: #00C89608; }
  .add-goal-icon { font-size: 28px; color: var(--muted); }
  .add-goal-text { font-size: 14px; color: var(--muted); font-weight: 500; }

  /* ── INSIGHTS ── */
  .insight-card { background: linear-gradient(135deg, #1A1A2E 0%, #0F0F1A 100%); border-radius: 16px; padding: 24px; color: white; margin-bottom: 20px; border: 1px solid #ffffff10; position: relative; overflow: hidden; }
  .insight-card::before { content: '💡'; position: absolute; right: 24px; top: 50%; transform: translateY(-50%); font-size: 48px; opacity: 0.15; }
  .insight-label { font-size: 11px; color: var(--mint); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .insight-text { font-size: 16px; font-weight: 500; line-height: 1.5; max-width: 80%; color: white; }

  /* ── SETTINGS ── */
  .settings-section { margin-bottom: 32px; }
  .settings-title { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
  .settings-card { background: var(--surface); border-radius: 16px; border: 1px solid var(--border); overflow: hidden; }
  .settings-row { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); gap: 12px; }
  .settings-row:last-child { border-bottom: none; }
  .settings-row-label { font-size: 14px; color: var(--text); font-weight: 500; }
  .settings-row-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .settings-select { padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text); background: var(--bg); outline: none; cursor: pointer; }
  .btn-danger { padding: 8px 16px; background: var(--danger); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .btn-danger:hover { opacity: 0.85; }
  .btn-outline { padding: 8px 16px; background: none; color: var(--mint); border: 1px solid var(--mint); border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .btn-outline:hover { background: var(--mint); color: var(--navy-deep); }

  /* ── THEME TOGGLE ── */
  .theme-toggle {
    display: flex; align-items: center; background: var(--bg);
    border: 1px solid var(--border); border-radius: 20px; padding: 3px;
    gap: 2px; cursor: pointer;
  }
  .theme-toggle-btn {
    padding: 6px 14px; border-radius: 16px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 500; transition: all 0.2s; background: none;
    color: var(--muted);
  }
  .theme-toggle-btn.active { background: var(--mint); color: var(--navy-deep); font-weight: 700; }

  /* ── MODAL ── */
  .modal-overlay { position: fixed; inset: 0; background: #00000070; z-index: 500; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .modal { background: var(--surface); border-radius: 20px; padding: 32px; width: 100%; max-width: 440px; box-shadow: 0 40px 80px #00000030; max-height: 90vh; overflow-y: auto; border: 1px solid var(--border); }
  .modal-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 24px; }
  .modal-input { width: 100%; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--text); background: var(--bg); outline: none; transition: border-color 0.2s; }
  .modal-input:focus { border-color: var(--mint); }
  .modal-label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; margin-top: 16px; }
  .modal-actions { display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end; }
  .btn-cancel { padding: 12px 20px; background: var(--bg); color: var(--muted); border: 1px solid var(--border); border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; cursor: pointer; }
  .btn-save { padding: 12px 24px; background: var(--mint); color: var(--navy-deep); border: none; border-radius: 10px; font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; }
  .btn-save:hover { background: #00e0aa; }

  /* ── SEARCH ── */
  .search-wrap { position: relative; margin-bottom: 20px; }
  .search-bar { width: 100%; padding: 12px 16px 12px 40px; border: 1px solid var(--border); border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; background: var(--surface); outline: none; color: var(--text); transition: border-color 0.2s; }
  .search-bar:focus { border-color: var(--mint); }
  .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 14px; pointer-events: none; }

  /* ── SUBSCRIPTION ── */
  .sub-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border); }
  .sub-item:last-child { border-bottom: none; }
  .sub-name { font-size: 14px; font-weight: 500; color: var(--text); }
  .sub-freq { font-size: 12px; color: var(--muted); }
  .sub-amount { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--danger); }

  /* ── TOAST ── */
  .toast { position: fixed; bottom: 24px; right: 24px; background: var(--navy-deep); color: white; padding: 14px 20px; border-radius: 12px; font-size: 14px; border-left: 3px solid var(--mint); box-shadow: 0 8px 24px #00000030; z-index: 999; animation: slideUp 0.3s ease; }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

  /* ── RESPONSIVE ── */
  @media (max-width: 768px) {
    .sidebar { transform: translateX(-100%); z-index: 300; pointer-events: none; }
    .sidebar.open { transform: translateX(0); pointer-events: all; }
    .mobile-overlay { display: none; position: fixed; inset: 0; background: #00000080; z-index: 250; pointer-events: none; }
    .mobile-overlay.open { display: block; pointer-events: all; }
    .mobile-header { display: flex !important; z-index: 200; }
    .app { display: block !important; }
    .main { margin-left: 0 !important; padding: 80px 16px 32px !important; width: 100vw !important; position: relative !important; z-index: 1 !important; pointer-events: all !important; }
    .stats-grid { grid-template-columns: 1fr !important; gap: 12px; }
    .dashboard-grid { grid-template-columns: 1fr !important; }
    .goals-grid { flex-direction: column !important; }
    .auth-card { padding: 32px 24px; }
    .donut-wrap { flex-direction: column; }
    .greeting { font-size: 22px !important; }
    .stat-value { font-size: 22px !important; }
    .income-banner { flex-direction: column; align-items: flex-start; gap: 10px; }
    .settings-row { flex-wrap: wrap; }
    .tx-item { gap: 8px; }
    .cat-badge { display: none; }
  }
`;

// ─── DONUT CHART ──────────────────────────────────────────────────────────────
function DonutChart({ data, currency }) {
  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📊</div>
        <div className="empty-text">Upload your first statement to get started</div>
      </div>
    );
  }
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 120; const r = 45; const cx = 60; const cy = 60;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const segments = data.map((d) => {
    const pct = d.value / total;
    const seg = { ...d, pct, offset, dash: pct * circumference, gap: (1 - pct) * circumference };
    offset += pct * circumference;
    return seg;
  });
  const c = CURRENCIES[currency] || CURRENCIES.BWP;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} className="donut-svg">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E2E8F0" strokeWidth="14" />
        {segments.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color}
            strokeWidth="14"
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.offset + circumference * 0.25} />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#00C896"
          style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 11 }}>Total</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="#00C896"
          style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 10 }}>
          {c.symbol}{(total * c.rate).toLocaleString("en-BW", { maximumFractionDigits: 0 })}
        </text>
      </svg>
      <div className="donut-legend">
        {segments.slice(0, 5).map((s, i) => (
          <div key={i} className="legend-item">
            <div className="legend-dot" style={{ background: s.color }} />
            <span className="legend-name">{s.name}</span>
            <span className="legend-val">{(s.pct * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BAR CHART ───────────────────────────────────────────────────────────────
function BarChart({ data }) {
  if (!data || data.every(d => d.value === 0)) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📈</div>
        <div className="empty-text">Upload your first statement to get started</div>
      </div>
    );
  }
  const max = Math.max(...data.map(d => d.value), 1);
  const current = new Date().getMonth();
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div key={i} className="bar-wrap">
          <div className={`bar ${i === current ? "active" : ""}`}
            style={{ height: `${(d.value / max) * 100}%` }} />
          <span className="bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// BATCH 1: Add Income Modal component
function AddIncomeModal({ onClose, onSave, currency }) {
  const [form, setForm] = useState({
    sourceType: "Salary",
    amount: "",
    label: "",
    date: new Date().toISOString().split("T")[0]
  });

  const incomeTypes = ["Salary", "Business", "Allowance", "Gift", "Side Hustle", "Other"];

  const handleSave = () => {
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) return;
    onSave({
      id: Date.now(),
      sourceType: form.sourceType,
      amount: amount,
      label: form.label.trim() || undefined,
      date: form.date
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">➕ Add Income</div>
        
        <label className="modal-label">Source Type</label>
        <select className="modal-input" value={form.sourceType} onChange={e => setForm(f => ({ ...f, sourceType: e.target.value }))}>
          {incomeTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <label className="modal-label">Amount ({currency})</label>
        <input className="modal-input" type="number" placeholder="e.g. 5000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />

        <label className="modal-label">Label (optional)</label>
        <input className="modal-input" placeholder="e.g. Freelance logo work" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />

        <label className="modal-label">Date</label>
        <input className="modal-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={handleSave}>Add Income</button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGES ───────────────────────────────────────────────────────────────────
// BATCH 1: Updated Dashboard with multi-source income
function Dashboard({ user, transactions, goals, incomes, onAddIncome, currency }) {
  const tagline = taglines[new Date().getDay() % taglines.length];
  const totalSpent = transactions.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const grossIncome = getGrossIncome(incomes, user.income);
  const freeCash = Math.max(0, grossIncome - totalSpent);
  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showCreditedIncome, setShowCreditedIncome] = useState(false);

  // BATCH 1: Get credited transactions (credit type with incomeType)
  const creditedTransactions = transactions.filter(t => t.type === "credit" && t.incomeType);
  
  // BATCH 1: Sort incomes by date (newest first)
  const sortedIncomes = [...(incomes || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  const catMap = {};
  transactions.filter(t => t.type === "debit").forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });
  const chartData = Object.entries(catMap).map(([name, value]) => {
    const cat = CATEGORIES.find(c => c.name === name) || CATEGORIES[7];
    return { name, value, color: cat.color };
  }).sort((a, b) => b.value - a.value);

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const barData = months.map((label, mi) => ({
    label,
    value: transactions.filter(t => t.type === "debit" && new Date(t.date).getMonth() === mi).reduce((s, t) => s + t.amount, 0)
  }));

  const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return (
    <div>
      <div className="page-header">
        <div className="greeting">
          {getGreeting()}, <span className="greeting-name">{user.name} 👋</span>
        </div>
        <div className="greeting-tagline">{tagline}</div>
      </div>

      {/* BATCH 1: Enhanced income banner */}
      <div className="income-banner">
        <div className="income-header">
          <div>
            <span className="income-total-label">💰 Gross Income</span>
            <span className="income-total">{formatMoney(grossIncome, currency)}</span>
          </div>
          <button className="btn-add-income" onClick={() => setShowIncomeModal(true)}>＋ Add Income</button>
        </div>
        
        {(sortedIncomes.length > 0 || creditedTransactions.length > 0) && (
          <div className="income-sources">
            {sortedIncomes.map(inc => (
              <div key={inc.id} className="income-source-row">
                <div className="income-source-type">
                  <span className="income-badge">{inc.sourceType}</span>
                  {inc.label && <span className="income-source-label">{inc.label}</span>}
                </div>
                <div className="income-source-amount">{formatMoney(inc.amount, currency)}</div>
              </div>
            ))}
            
            {creditedTransactions.length > 0 && (
              <div className="income-credited-section">
                <div className="income-toggle" onClick={() => setShowCreditedIncome(!showCreditedIncome)}>
                  {showCreditedIncome ? "▼" : "▶"} Credited Income ({creditedTransactions.length})
                </div>
                {showCreditedIncome && (
                  <div className="income-credited-list">
                    {creditedTransactions.map(tx => (
                      <div key={tx.id} className="income-source-row">
                        <div className="income-source-type">
                          <span className="income-badge">{tx.incomeType}</span>
                          <span className="income-source-label">{tx.description}</span>
                        </div>
                        <div className="income-source-amount">{formatMoney(tx.amount, currency)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card spent">
          <div className="stat-label">Total Spent</div>
          <div className="stat-value">{formatMoney(totalSpent, currency)}</div>
          <div className="stat-sub">This month</div>
        </div>
        <div className="stat-card free">
          <div className="stat-label">Free Cash</div>
          <div className="stat-value">{formatMoney(freeCash, currency)}</div>
          <div className="stat-sub">After essentials</div>
        </div>
        <div className="stat-card savings">
          <div className="stat-label">Savings Progress</div>
          <div className="stat-value">{formatMoney(totalSaved, currency)}</div>
          <div className="stat-sub">Across {goals.length} goal{goals.length !== 1 ? "s" : ""}</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-title">Spending by Category</div>
          <DonutChart data={chartData} currency={currency} />
        </div>
        <div className="card">
          <div className="card-title">Monthly Trend</div>
          <BarChart data={barData} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Recent Transactions</div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-text">No transactions yet</div>
            <div className="empty-sub">Upload a bank statement to see your transactions</div>
          </div>
        ) : (
          <div className="tx-list">
            {recent.map((t, i) => {
              const cat = CATEGORIES.find(c => c.name === t.category) || CATEGORIES[7];
              return (
                <div key={i} className="tx-item">
                  <div className="tx-icon" style={{ background: cat.color + "20" }}>{cat.icon}</div>
                  <div className="tx-info">
                    <div className="tx-name">{t.description}</div>
                    <div className="tx-date">{t.date}</div>
                  </div>
                  <span className="cat-badge" style={{ background: cat.color + "20", color: cat.color }}>{t.category}</span>
                  <div className={`tx-amount ${t.type}`}>
                    {t.type === "debit" ? "-" : "+"}{formatMoney(t.amount, currency)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showIncomeModal && (
        <AddIncomeModal
          onClose={() => setShowIncomeModal(false)}
          onSave={onAddIncome}
          currency={currency}
        />
      )}
    </div>
  );
}

function UploadPage({ onUpload }) {
  const [dragover, setDragover] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const mockTx = Array.from({ length: 8 }, (_, i) => ({
      id: `${file.name}-${file.size}-${i}`,
      date: new Date(Date.now() - i * 86400000 * 3).toISOString().split("T")[0],
      description: ["Choppies Supermarket","FNB Transfer","BPC Electricity","Orange Botswana","Pick n Pay","Debonairs Pizza","Shell Gaborone","Clicks Pharmacy"][i],
      amount: [340.50,1200,580.00,89.00,215.75,95.00,450.00,125.50][i],
      type: i === 1 ? "credit" : "debit",
      category: ["Groceries","Other","Bills","Bills","Groceries","Food & Dining","Transport","Health"][i],
    }));
    setPreview({ filename: file.name, fileKey: `${file.name}-${file.size}`, transactions: mockTx });
  };

  const handleDrop = (e) => { e.preventDefault(); setDragover(false); handleFile(e.dataTransfer.files[0]); };

  return (
    <div>
      <div className="page-header">
        <div className="greeting" style={{ fontSize: 24 }}>Upload Statement</div>
        <div className="greeting-tagline">PDF or CSV from your bank — processed right here in your browser</div>
      </div>
      {!preview ? (
        <div className={`upload-zone ${dragover ? "dragover" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
          onDragLeave={() => setDragover(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current.click()}>
          <div className="upload-icon">📂</div>
          <div className="upload-title">Drop your bank statement here</div>
          <div className="upload-sub">Your data is processed locally and never leaves your device</div>
          <button className="btn-upload" onClick={e => { e.stopPropagation(); fileRef.current.click(); }}>Choose File</button>
          <div className="format-pills">
            <span className="format-pill">PDF</span>
            <span className="format-pill">CSV</span>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.csv" style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])} />
        </div>
      ) : (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Preview — {preview.filename}</div>
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
              We found {preview.transactions.length} transactions. Review and confirm below.
            </p>
            <div className="tx-list">
              {preview.transactions.map((t, i) => {
                const cat = CATEGORIES.find(c => c.name === t.category) || CATEGORIES[7];
                return (
                  <div key={i} className="tx-item">
                    <div className="tx-icon" style={{ background: cat.color + "20" }}>{cat.icon}</div>
                    <div className="tx-info">
                      <div className="tx-name">{t.description}</div>
                      <div className="tx-date">{t.date}</div>
                    </div>
                    <span className="cat-badge" style={{ background: cat.color + "20", color: cat.color }}>{t.category}</span>
                    <div className={`tx-amount ${t.type}`}>{t.type === "debit" ? "-" : "+"}P {t.amount.toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn-cancel" onClick={() => setPreview(null)}>Cancel</button>
            <button className="btn-save" onClick={() => { onUpload(preview.transactions, preview.fileKey); setPreview(null); }}>
              Confirm & Save →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// BATCH 1: Updated TransactionsPage signature (added setTransactions prop for future features)
function TransactionsPage({ transactions, setTransactions, currency }) {
  const [search, setSearch] = useState("");
  const filtered = transactions.filter(t =>
    t.description.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div>
      <div className="page-header">
        <div className="greeting" style={{ fontSize: 24 }}>Transactions</div>
        <div className="greeting-tagline">{transactions.length} transaction{transactions.length !== 1 ? "s" : ""} recorded</div>
      </div>
      <div className="search-wrap">
        <span className="search-icon">🔍</span>
        <input className="search-bar" placeholder="Search by name or category..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-text">No transactions yet</div>
            <div className="empty-sub">Upload a bank statement to get started</div>
          </div>
        ) : (
          <div className="tx-list">
            {filtered.map((t, i) => {
              const cat = CATEGORIES.find(c => c.name === t.category) || CATEGORIES[7];
              return (
                <div key={t.id || i} className="tx-item">
                  <div className="tx-icon" style={{ background: cat.color + "20" }}>{cat.icon}</div>
                  <div className="tx-info">
                    <div className="tx-name">{t.description}</div>
                    <div className="tx-date">{t.date}</div>
                  </div>
                  <span className="cat-badge" style={{ background: cat.color + "20", color: cat.color }}>{t.category}</span>
                  <div className={`tx-amount ${t.type}`}>
                    {t.type === "debit" ? "-" : "+"}{formatMoney(t.amount, currency)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function InsightsPage({ transactions, currency }) {
  const totalSpent = transactions.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const catMap = {};
  transactions.filter(t => t.type === "debit").forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const subs = transactions.filter(t => ["Bills","Entertainment"].includes(t.category) && t.type === "debit");

  return (
    <div>
      <div className="page-header">
        <div className="greeting" style={{ fontSize: 24 }}>Insights</div>
        <div className="greeting-tagline">Patterns in your spending</div>
      </div>
      {transactions.length > 0 && (
        <div className="insight-card">
          <div className="insight-label">Key Insight</div>
          <div className="insight-text">
            {topCats[0]
              ? `Your biggest spend is ${topCats[0][0]} at ${formatMoney(topCats[0][1], currency)}. ${topCats[0][1] / totalSpent > 0.4 ? "Consider reviewing this category." : "You're keeping things balanced."}`
              : "Keep uploading statements to unlock insights."}
          </div>
        </div>
      )}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-title">Top Categories</div>
          {topCats.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <div className="empty-text">Upload your first statement to get started</div>
            </div>
          ) : topCats.map(([name, val], i) => {
            const cat = CATEGORIES.find(c => c.name === name) || CATEGORIES[7];
            const pct = totalSpent > 0 ? (val / totalSpent) * 100 : 0;
            return (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{cat.icon} {name}</span>
                  <span style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 14, color: "var(--stat-value)" }}>{formatMoney(val, currency)}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: cat.color }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="card">
          <div className="card-title">Recurring Subscriptions</div>
          {subs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔄</div>
              <div className="empty-text">No subscriptions detected yet</div>
            </div>
          ) : subs.slice(0, 5).map((s, i) => (
            <div key={i} className="sub-item">
              <div>
                <div className="sub-name">{s.description}</div>
                <div className="sub-freq">Monthly</div>
              </div>
              <div className="sub-amount">{formatMoney(s.amount, currency)}/mo</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GoalsPage({ goals, onAdd, currency }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", target: "", deadline: "", emoji: "🎯" });
  const emojis = ["🎯","✈️","🏠","🚗","📱","💍","🎓","💼","🏋️","🎸"];

  const handleSave = () => {
    if (!form.name || !form.target) return;
    onAdd({ ...form, target: parseFloat(form.target), saved: 0, id: Date.now() });
    setShowModal(false);
    setForm({ name: "", target: "", deadline: "", emoji: "🎯" });
  };

  return (
    <div>
      <div className="page-header">
        <div className="greeting" style={{ fontSize: 24 }}>Goals</div>
        <div className="greeting-tagline">Track what you're saving toward</div>
      </div>
      <div className="goals-grid">
        {goals.length === 0 && (
          <div style={{ gridColumn: "1/-1", width: "100%" }}>
            <div className="empty-state" style={{ padding: "60px 20px" }}>
              <div className="empty-icon">🎯</div>
              <div className="empty-text">No goals yet. Add one.</div>
              <div className="empty-sub">Set a saving target and track your progress</div>
            </div>
          </div>
        )}
        {goals.map((g) => {
          const pct = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0;
          const weekly = g.deadline
            ? Math.max(0, (g.target - g.saved) / Math.max(1, Math.ceil((new Date(g.deadline) - new Date()) / (7 * 86400000))))
            : null;
          return (
            <div key={g.id} className="goal-card">
              <div className="goal-header">
                <div className="goal-name">{g.name}</div>
                <div className="goal-emoji">{g.emoji}</div>
              </div>
              <div className="goal-amounts">
                <div className="goal-saved">{formatMoney(g.saved, currency)}</div>
                <div className="goal-target">of {formatMoney(g.target, currency)}</div>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="goal-meta">
                {pct.toFixed(0)}% complete
                {weekly !== null && ` · Save ${formatMoney(weekly, currency)}/week`}
                {g.deadline && ` · Due ${g.deadline}`}
              </div>
            </div>
          );
        })}
        <button className="add-goal-card" onClick={() => setShowModal(true)}>
          <div className="add-goal-icon">+</div>
          <div className="add-goal-text">Add a goal</div>
        </button>
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">New Saving Goal</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {emojis.map(e => (
                <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
                  style={{ fontSize: 22, background: form.emoji === e ? "#00C89620" : "none", border: `1px solid ${form.emoji === e ? "#00C896" : "var(--border)"}`, borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}>
                  {e}
                </button>
              ))}
            </div>
            <label className="modal-label">Goal Name</label>
            <input className="modal-input" placeholder="e.g. Trip to Cape Town"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <label className="modal-label">Target Amount (BWP)</label>
            <input className="modal-input" type="number" placeholder="5000"
              value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} />
            <label className="modal-label">Deadline (optional)</label>
            <input className="modal-input" type="date"
              value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-save" onClick={handleSave}>Save Goal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPage({ user, onLogout, onClearData, currency, onCurrencyChange, theme, onThemeChange }) {
  return (
    <div>
      <div className="page-header">
        <div className="greeting" style={{ fontSize: 24 }}>Settings</div>
        <div className="greeting-tagline">Manage your SpendSight preferences</div>
      </div>

      <div className="settings-section">
        <div className="settings-title">Account</div>
        <div className="settings-card">
          <div className="settings-row">
            <div><div className="settings-row-label">Name</div><div className="settings-row-sub">{user.name}</div></div>
          </div>
          <div className="settings-row">
            <div><div className="settings-row-label">Email</div><div className="settings-row-sub">{user.email}</div></div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-title">Preferences</div>
        <div className="settings-card">

          {/* DARK/LIGHT MODE TOGGLE */}
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Theme</div>
              <div className="settings-row-sub">Choose your display preference</div>
            </div>
            <div className="theme-toggle">
              <button
                className={`theme-toggle-btn ${theme === "light" ? "active" : ""}`}
                onClick={() => onThemeChange("light")}>
                ☀️ Light
              </button>
              <button
                className={`theme-toggle-btn ${theme === "system" ? "active" : ""}`}
                onClick={() => onThemeChange("system")}>
                Auto
              </button>
              <button
                className={`theme-toggle-btn ${theme === "dark" ? "active" : ""}`}
                onClick={() => onThemeChange("dark")}>
                🌙 Dark
              </button>
            </div>
          </div>

          {/* CURRENCY SELECTOR — changes all money displays app-wide */}
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Currency</div>
              <div className="settings-row-sub">All amounts convert from BWP at current rates</div>
            </div>
            <select
              className="settings-select"
              value={currency}
              onChange={e => onCurrencyChange(e.target.value)}>
              {Object.entries(CURRENCIES).map(([code, c]) => (
                <option key={code} value={code}>{c.name}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      <div className="settings-section">
        <div className="settings-title">Data</div>
        <div className="settings-card">
          <div className="settings-row">
            <div><div className="settings-row-label">Export Data</div><div className="settings-row-sub">Download all transactions as CSV</div></div>
            <button className="btn-outline">Export CSV</button>
          </div>
          <div className="settings-row">
            <div><div className="settings-row-label">Clear All Data</div><div className="settings-row-sub">Permanently delete all transactions and goals</div></div>
            <button className="btn-danger" onClick={onClearData}>Clear Data</button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-card">
          <div className="settings-row">
            <div><div className="settings-row-label">Sign Out</div></div>
            <button className="btn-cancel" style={{ cursor: "pointer" }} onClick={onLogout}>Sign Out</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function SpendSight() {
  const [user, setUser] = useLocalStorage("ss_user", null);
  const [transactions, setTransactions] = useLocalStorage("ss_transactions", []);
  const [importedFiles, setImportedFiles] = useLocalStorage("ss_imported_files", []);
  const [goals, setGoals] = useLocalStorage("ss_goals", []);
  // BATCH 1: New incomes array
  const [incomes, setIncomes] = useLocalStorage("ss_incomes", []);
  const [currency, setCurrency] = useLocalStorage("ss_currency", "BWP");
  // theme: "light" | "dark" | "system"
  const [theme, setTheme] = useLocalStorage("ss_theme", "system");
  const [page, setPage] = useState("dashboard");
  const [authTab, setAuthTab] = useState("login");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  // Apply dark/light class to <html> whenever theme changes
  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
    } else if (theme === "light") {
      html.classList.remove("dark");
    } else {
      // "system" — follow OS preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) html.classList.add("dark");
      else html.classList.remove("dark");
    }
  }, [theme]);

  // Also listen for OS preference changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      if (e.matches) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const handleAuth = () => {
    if (!form.email || !form.password) return;
    if (authTab === "signup" && !form.name) return;
    const name = authTab === "signup" ? form.name : (form.name || form.email.split("@")[0]);
    setUser({ name, email: form.email, income: 0 });
    showToast(`Welcome${authTab === "signup" ? "" : " back"}, ${name}!`);
  };

  const handleUpload = (newTx, fileKey) => {
    if (importedFiles.includes(fileKey)) {
      showToast("⚠️ This statement has already been imported.");
      return;
    }
    setTransactions(t => [...t, ...newTx]);
    setImportedFiles(f => [...f, fileKey]);
    setPage("transactions");
    showToast(`${newTx.length} transactions imported!`);
  };

  // BATCH 1: Add income handler
  const handleAddIncome = (income) => {
    setIncomes(prev => [...prev, income]);
    showToast(`Added ${income.sourceType}: ${formatMoney(income.amount, currency)}`);
  };

  const navItems = [
    { id: "dashboard",    icon: "🏠", label: "Dashboard" },
    { id: "upload",       icon: "📂", label: "Upload" },
    { id: "transactions", icon: "📋", label: "Transactions" },
    { id: "insights",     icon: "📊", label: "Insights" },
    { id: "goals",        icon: "🎯", label: "Goals" },
    { id: "settings",     icon: "⚙️", label: "Settings" },
  ];

  if (!user) {
    return (
      <>
        <style>{css}</style>
        <div className="auth-screen">
          <div className="auth-card">
            <div className="auth-logo">
              <span className="auth-logo-text">Spend<span style={{ color: "#00C896" }}>Sight</span></span>
            </div>
            <div className="auth-tagline">Your money, your clarity.</div>
            <div className="auth-tabs">
              <button className={`auth-tab ${authTab === "login" ? "active" : ""}`} onClick={() => setAuthTab("login")}>Sign In</button>
              <button className={`auth-tab ${authTab === "signup" ? "active" : ""}`} onClick={() => setAuthTab("signup")}>Sign Up</button>
            </div>
            {authTab === "signup" && (
              <div className="form-group">
                <label className="form-label">Your Name</label>
                <input className="form-input" placeholder="e.g. El" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={handleAuth}>
              {authTab === "login" ? "Sign In →" : "Create Account →"}
            </button>
          </div>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className={`mobile-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

        <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-logo">
            <div className="logo-text">Spend<span className="logo-dot">Sight</span></div>
          </div>
          <nav className="sidebar-nav">
            {navItems.map(n => (
              <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`}
                onClick={() => { setPage(n.id); setSidebarOpen(false); }}>
                <span className="nav-icon">{n.icon}</span>
                {n.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="user-chip">
              <div className="user-avatar">{user.name[0].toUpperCase()}</div>
              <div className="user-name">{user.name}</div>
            </div>
          </div>
        </div>

        <div className="mobile-header">
          <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <span /><span /><span />
          </button>
          <span style={{ fontFamily: "Syne", fontWeight: 800, color: "white", fontSize: 18 }}>
            Spend<span style={{ color: "#00C896" }}>Sight</span>
          </span>
          <div style={{ width: 30 }} />
        </div>

        <main className="main">
          {/* BATCH 1: Pass incomes and onAddIncome to Dashboard */}
          {page === "dashboard" && <Dashboard user={user} transactions={transactions} goals={goals} incomes={incomes} onAddIncome={handleAddIncome} currency={currency} />}
          {page === "upload" && <UploadPage onUpload={handleUpload} />}
          {/* BATCH 1: Pass setTransactions to TransactionsPage */}
          {page === "transactions" && <TransactionsPage transactions={transactions} setTransactions={setTransactions} currency={currency} />}
          {page === "insights" && <InsightsPage transactions={transactions} currency={currency} />}
          {page === "goals" && <GoalsPage goals={goals} onAdd={(g) => setGoals(gs => [...gs, g])} currency={currency} />}
          {page === "settings" && (
            <SettingsPage
              user={user}
              onLogout={() => { setUser(null); setPage("dashboard"); }}
              onClearData={() => { setTransactions([]); setGoals([]); setImportedFiles([]); setIncomes([]); showToast("All data cleared."); }}
              currency={currency}
              onCurrencyChange={setCurrency}
              theme={theme}
              onThemeChange={setTheme}
            />
          )}
        </main>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}