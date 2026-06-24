import { useState, useEffect, useRef, useCallback } from "react";

// ─── CURRENCY CONFIG ──────────────────────────────────────────────────────────
const EXCHANGE_RATES = {
  BWP: 1,
  ZAR: 1.26,
  USD: 0.074,
  EUR: 0.068,
  GBP: 0.058,
};

const CURRENCIES = {
  BWP: { symbol: "P",  name: "BWP — Pula",    code: "BWP" },
  ZAR: { symbol: "R",  name: "ZAR — Rand",    code: "ZAR" },
  USD: { symbol: "$",  name: "USD — Dollar",  code: "USD" },
  EUR: { symbol: "€",  name: "EUR — Euro",    code: "EUR" },
  GBP: { symbol: "£",  name: "GBP — Pound",   code: "GBP" },
};

function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  const amountInBWP = amount / EXCHANGE_RATES[fromCurrency];
  return amountInBWP * EXCHANGE_RATES[toCurrency];
}

function formatMoney(amount, currencyCode) {
  const c = CURRENCIES[currencyCode] || CURRENCIES.BWP;
  return `${c.symbol} ${amount.toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── THEME (Phase 2: OKLCH colors) ──────────────────────────────────────────
const COLORS = {
  mint: "oklch(0.78 0.18 170)",
  mintHover: "oklch(0.85 0.20 170)",
  mintDim: "oklch(0.78 0.18 170 / 0.15)",
  navy: "oklch(0.18 0.02 260)",
  navyDeep: "oklch(0.12 0.02 260)",
  bg: "oklch(0.98 0.01 260)",
  surface: "oklch(1.00 0.00 0)",
  text: "oklch(0.25 0.02 260)",
  textMuted: "oklch(0.55 0.02 260)",
  border: "oklch(0.90 0.01 260)",
  danger: "oklch(0.60 0.22 25)",
  success: "oklch(0.70 0.18 150)",
  mintHex: "#00C896",
  dangerHex: "#FF4757",
};

const taglines = [
  "Here's where your money went this month.",
  "Small steps, big savings.",
  "Your money, your clarity.",
  "Know more. Spend smarter.",
  "Every pula tells a story.",
];

const DEFAULT_CATEGORIES = [
  { name: "Groceries",    icon: "🛒", color: "#00C896" },
  { name: "Transport",    icon: "🚗", color: "#4299E1" },
  { name: "Entertainment",icon: "🎬", color: "#9F7AEA" },
  { name: "Bills",        icon: "📄", color: "#ED8936" },
  { name: "Health",       icon: "💊", color: "#FC8181" },
  { name: "Shopping",     icon: "🛍️", color: "#F6C90E" },
  { name: "Food & Dining",icon: "🍽️", color: "#68D391" },
  { name: "Savings",      icon: "🐷", color: "#F6C90E" },
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

function getTxTags(tx) { return tx.tags || []; }
function getTxNotes(tx) { return tx.notes || ""; }
function getTxSplits(tx) { return tx.splits || []; }
function getTxIncomeType(tx) { return tx.incomeType || ""; }
function getTxIsRecurring(tx) { return tx.isRecurring || false; }

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getDayName(dayIndex) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayIndex];
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ─── CSV PARSING ──────────────────────────────────────────────────────────────
function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(/[,\t]/).map(h => h.trim().toLowerCase());
  const dateIdx = headers.findIndex(h => h.includes('date') || h === 'date' || h === 'transaction date');
  const descIdx = headers.findIndex(h => h.includes('description') || h.includes('narrative') || h === 'description' || h === 'particulars');
  const debitIdx = headers.findIndex(h => h.includes('debit') || h === 'debit' || h.includes('withdrawal'));
  const creditIdx = headers.findIndex(h => h.includes('credit') || h === 'credit' || h.includes('deposit'));
  const amountIdx = headers.findIndex(h => h === 'amount');
  
  const transactions = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,\t]/);
    if (cols.length < 2) continue;
    
    let date = dateIdx >= 0 ? cols[dateIdx] : new Date().toISOString().split("T")[0];
    let description = descIdx >= 0 ? cols[descIdx] : "Unknown";
    let amount = 0;
    let type = "debit";
    
    if (debitIdx >= 0 && cols[debitIdx] && parseFloat(cols[debitIdx])) {
      amount = Math.abs(parseFloat(cols[debitIdx]));
      type = "debit";
    } else if (creditIdx >= 0 && cols[creditIdx] && parseFloat(cols[creditIdx])) {
      amount = Math.abs(parseFloat(cols[creditIdx]));
      type = "credit";
    } else if (amountIdx >= 0 && cols[amountIdx]) {
      amount = Math.abs(parseFloat(cols[amountIdx]));
      type = parseFloat(cols[amountIdx]) < 0 ? "debit" : "credit";
    }
    
    if (amount === 0) continue;
    
    if (date && !date.includes("-")) {
      const parts = date.split(/[\/\.]/);
      if (parts.length === 3) {
        date = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
      }
    }
    
    transactions.push({
      id: simpleHash(`${description}-${amount}-${date}-${i}`),
      date: date,
      description: description.substring(0, 50),
      amount: amount,
      type: type,
      category: "Other",
      customCategory: "",
      tags: [],
      notes: "",
      splits: [],
      incomeType: type === "credit" ? "Other" : "",
      isRecurring: false
    });
  }
  return transactions;
}

// ─── AI SERVICE (Phase 1: removed hardcoded API key; mock only) ────────────
async function callAIService(prompt) {
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
  if (prompt.includes("financial advisor")) {
    return {
      summary: "Your spending this month is within your income range.",
      opportunity: "Consider reviewing your Groceries category to find potential savings.",
      encouragement: "Every small step counts toward financial freedom!"
    };
  }
  if (prompt.includes("weekly report")) {
    return {
      topCategory: "Groceries",
      trend: "stable",
      assessment: "Your spending is stable — good job!",
      recommendations: [
        "Review your subscriptions for unused services.",
        "Set up automatic transfers to your savings account."
      ]
    };
  }
  if (prompt.includes("Explain this transaction")) {
    return { raw: "This transaction appears to be a standard purchase. No specific insights available." };
  }
  return { raw: "I'm analyzing your financial data and will provide insights shortly." };
}
// ─── FINANCIAL HEALTH ENGINE ──────────────────────────────────────────────
function calculateFinancialHealth(transactions, incomes, goals, budgets) {
  const hasData = transactions.length > 0 || incomes.length > 0 || goals.length > 0;
  if (!hasData) {
    return {
      score: 0,
      grade: "No Data",
      savingsRate: 0,
      savingsScore: 0,
      budgetScore: 0,
      stabilityScore: 0,
      goalScore: 0,
      debtScore: 0,
      riskLevel: "green",
      riskLabel: "No Data",
      riskFactors: [],
      totalIncome: 0,
      totalSpent: 0,
      savings: 0,
      monthOverMonthChange: 0,
      hasData: false
    };
  }
  
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const monthTxs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const prevMonthTxs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  });
  
  const monthlyIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);
  const creditTransactions = monthTxs.filter(t => t.type === "credit").reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = monthlyIncome + creditTransactions;
  const totalSpent = monthTxs.filter(t => t.type === "debit").reduce((sum, t) => sum + t.amount, 0);
  const savings = Math.max(0, totalIncome - totalSpent);
  const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;
  
  const savingsScore = Math.min(100, (savingsRate / 20) * 100);
  
  let budgetScore = 0;
  if (budgets.length > 0) {
    const categorySpending = {};
    monthTxs.filter(t => t.type === "debit").forEach(t => {
      const cat = t.customCategory || t.category;
      categorySpending[cat] = (categorySpending[cat] || 0) + t.amount;
    });
    
    let totalBudget = 0;
    let totalSpentBudgeted = 0;
    budgets.forEach(b => {
      const spent = categorySpending[b.category] || 0;
      totalBudget += b.amount;
      totalSpentBudgeted += Math.min(spent, b.amount);
    });
    
    budgetScore = totalBudget > 0 ? (totalSpentBudgeted / totalBudget) * 100 : 100;
    budgetScore = Math.min(100, budgetScore);
  } else {
    budgetScore = 0;
  }
  
  const prevMonthSpent = prevMonthTxs.filter(t => t.type === "debit").reduce((sum, t) => sum + t.amount, 0);
  let stabilityScore = 100;
  if (prevMonthSpent > 0 && totalSpent > 0) {
    const variance = Math.abs((totalSpent - prevMonthSpent) / prevMonthSpent);
    stabilityScore = Math.max(0, 100 - (variance * 100));
    stabilityScore = Math.min(100, stabilityScore);
  } else if (totalSpent > 0 && prevMonthSpent === 0) {
    stabilityScore = 50;
  } else {
    stabilityScore = 0;
  }
  
  let goalScore = 0;
  if (goals.length > 0) {
    const goalProgress = goals.reduce((sum, g) => {
      const pct = g.target > 0 ? (g.saved / g.target) * 100 : 0;
      return sum + Math.min(pct, 100);
    }, 0);
    goalScore = goalProgress / goals.length;
  } else {
    goalScore = 0;
  }
  
  const totalCredit = transactions.filter(t => t.type === "credit").reduce((sum, t) => sum + t.amount, 0);
  const debtScore = totalIncome > 0 ? Math.max(0, 100 - (totalCredit / totalIncome) * 100) : 100;
  
  const weights = { savings: 0.30, budget: 0.25, stability: 0.20, goals: 0.15, debt: 0.10 };
  const overallScore = Math.round(
    savingsScore * weights.savings +
    budgetScore * weights.budget +
    stabilityScore * weights.stability +
    goalScore * weights.goals +
    debtScore * weights.debt
  );
  
  const riskFactors = [];
  if (savingsRate < 10 && totalIncome > 0) riskFactors.push("Low savings rate");
  if (budgetScore < 70 && budgetScore > 0) riskFactors.push("Budget overruns");
  if (stabilityScore < 60 && stabilityScore > 0) riskFactors.push("Unstable spending");
  if (debtScore < 50 && totalIncome > 0) riskFactors.push("High debt burden");
  
  let riskLevel = "green";
  let riskLabel = "Low Risk";
  if (riskFactors.length >= 3) { riskLevel = "red"; riskLabel = "High Risk"; }
  else if (riskFactors.length >= 1) { riskLevel = "yellow"; riskLabel = "Medium Risk"; }
  
  let grade = "F";
  if (overallScore >= 95) grade = "A+";
  else if (overallScore >= 85) grade = "A";
  else if (overallScore >= 70) grade = "B";
  else if (overallScore >= 55) grade = "C";
  else if (overallScore >= 40) grade = "D";
  
  return {
    score: overallScore,
    grade: grade,
    savingsRate: Math.round(savingsRate),
    savingsScore: Math.round(savingsScore),
    budgetScore: Math.round(budgetScore),
    stabilityScore: Math.round(stabilityScore),
    goalScore: Math.round(goalScore),
    debtScore: Math.round(debtScore),
    riskLevel: riskLevel,
    riskLabel: riskLabel,
    riskFactors: riskFactors,
    totalIncome: totalIncome,
    totalSpent: totalSpent,
    savings: savings,
    monthOverMonthChange: prevMonthSpent > 0 ? Math.round(((totalSpent - prevMonthSpent) / prevMonthSpent) * 100) : 0,
    hasData: true
  };
}

// ─── STYLES (Phase 2 & 3: Brutalist, glass, touch targets, animations) ──
// Mobile touch fixes integrated: touch-action: manipulation, -webkit-appearance: none, pointer-events control
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --mint: oklch(0.78 0.18 170);
    --mint-hover: oklch(0.85 0.20 170);
    --mint-dim: oklch(0.78 0.18 170 / 0.15);
    --navy: oklch(0.18 0.02 260);
    --navy-deep: oklch(0.12 0.02 260);
    --bg: oklch(0.98 0.01 260);
    --surface: oklch(1.00 0.00 0);
    --text: oklch(0.25 0.02 260);
    --muted: oklch(0.55 0.02 260);
    --border: oklch(0.90 0.01 260);
    --danger: oklch(0.60 0.22 25);
    --success: oklch(0.70 0.18 150);
    --stat-value: var(--text);
    --greeting-name: var(--navy);
    --card-bg: var(--surface);
    --risk-green: oklch(0.70 0.18 150);
    --risk-yellow: oklch(0.85 0.20 95);
    --risk-red: var(--danger);

    --font-sans: 'DM Sans', sans-serif;
    --font-display: 'Syne', sans-serif;
    --text-scale: 1;
    --font-size-h1: clamp(1.8rem, 5vw, 2.8rem);
    --font-size-h2: clamp(1.2rem, 3vw, 1.6rem);
    --font-size-body: clamp(0.9rem, 2.5vw, 1.0rem);
    --font-size-small: clamp(0.75rem, 2vw, 0.85rem);

    --space-1: 8px;
    --space-2: 16px;
    --space-3: 24px;
    --space-4: 32px;
    --space-5: 40px;
    --space-6: 48px;
  }

  html.dark {
    --bg: oklch(0.12 0.02 260);
    --surface: oklch(0.18 0.02 260);
    --text: oklch(0.92 0.01 260);
    --muted: oklch(0.70 0.01 260);
    --border: oklch(0.30 0.02 260);
    --stat-value: var(--text);
    --greeting-name: var(--mint);
    --card-bg: var(--surface);
    --risk-green: oklch(0.75 0.18 150);
    --risk-yellow: oklch(0.85 0.20 95);
    --risk-red: oklch(0.65 0.22 25);
  }

  html.text-small { --text-scale: 0.85; }
  html.text-normal { --text-scale: 1; }
  html.text-large { --text-scale: 1.15; }
  html.text-xlarge { --text-scale: 1.3; }

  body {
    font-family: var(--font-sans);
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    transition: background 0.25s, color 0.25s;
    font-size: calc(14px * var(--text-scale));
    line-height: 1.6;
    -webkit-tap-highlight-color: transparent;
  }

  /* ---- MOBILE TOUCH FIXES (applied to all interactive elements) ---- */
  button,
  input[type="button"],
  input[type="submit"],
  input[type="reset"],
  .nav-item,
  .filter-chip,
  .category-pill,
  .btn-add-income,
  .tx-menu-btn,
  .auth-tab,
  .size-btn,
  .theme-toggle-btn,
  .btn-upload,
  .btn-cancel,
  .btn-save,
  .btn-outline,
  .btn-danger,
  .btn-primary,
  .income-delete,
  .split-remove,
  .bulk-cancel,
  .bulk-delete,
  .bulk-recategorise,
  .ai-refresh-btn,
  .credited-toggle,
  .goal-card .btn-outline,
  .add-goal-card,
  .upload-zone,
  .currency-selector,
  .settings-select,
  .modal-input,
  .search-bar,
  .form-input {
    -webkit-appearance: none !important;
    -moz-appearance: none !important;
    appearance: none !important;
    touch-action: manipulation !important;
    -webkit-tap-highlight-color: transparent !important;
    cursor: pointer;
  }

  /* Ensure all buttons get pointer events */
  button {
    cursor: pointer;
    touch-action: manipulation;
  }

  /* Overlay and sidebar pointer-event control for mobile */
  .mobile-overlay {
    display: none;
    pointer-events: none;
    position: fixed;
    inset: 0;
    background: #00000080;
    z-index: 150;
  }
  .mobile-overlay.open {
    display: block;
    pointer-events: auto;
  }

  .sidebar {
    pointer-events: none;
    transition: transform 0.3s ease;
  }
  .sidebar.open {
    pointer-events: auto;
  }
  @media (min-width: 769px) {
    .sidebar {
      pointer-events: auto !important;
    }
  }

  .main {
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }

  /* ---- END MOBILE TOUCH FIXES ---- */

  .card, .modal, .health-score-card, .ai-advisor-card, .stat-card, .income-banner, .upload-zone {
    border-radius: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    padding: var(--space-3);
    box-shadow: none;
  }

  /* Touch targets: min-height 44px (already handled above) */
  button, .nav-item, .filter-chip, .category-pill, .btn-add-income, .tx-menu-btn,
  .auth-tab, .size-btn, .theme-toggle-btn, .upload-zone, .btn-upload,
  .btn-cancel, .btn-save, .btn-outline, .btn-danger, .btn-primary,
  .income-delete, .split-remove, .bulk-cancel, .bulk-delete, .bulk-recategorise {
    min-height: 44px;
    min-width: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    border-radius: 10px;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .glass-hover:hover {
    backdrop-filter: blur(4px);
    background: var(--mint-dim);
  }
  .glass-active:active {
    backdrop-filter: blur(2px);
    background: var(--mint-dim);
  }
  .ai-refresh-btn {
    background: none;
    border: 1px solid var(--border);
    transition: all 0.2s;
  }
  .ai-refresh-btn:hover {
    backdrop-filter: blur(4px);
    background: var(--mint-dim);
  }
  .filter-chip.active {
    backdrop-filter: blur(2px);
    background: var(--mint);
    color: var(--navy-deep);
  }
  .bulk-add-btn:hover {
    backdrop-filter: blur(4px);
    background: var(--mint-dim);
  }

  .ai-advisor-badge {
    background: var(--mint);
    color: var(--navy-deep);
    padding: 2px 12px;
    border-radius: 20px;
    font-size: var(--font-size-small);
    font-weight: 700;
    text-transform: uppercase;
    background: oklch(0.78 0.18 170);
    color: oklch(0.15 0.02 260);
  }

  .health-metric {
    position: relative;
  }
  .health-metric .tooltip {
    display: none;
    font-size: var(--font-size-small);
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 8px 12px;
    border-radius: 8px;
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    width: 200px;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  .health-metric:hover .tooltip {
    display: block;
  }

  .budget-fill {
    transition: width 0.6s ease;
    background: var(--mint);
    border-radius: 4px;
  }
  .budget-fill.stagger {
    animation: growBar 0.3s ease-out forwards;
  }
  @keyframes growBar {
    from { width: 0%; }
    to { width: var(--final-width); }
  }

  @keyframes pulseGold {
    0% { transform: scale(1); color: var(--mint); }
    50% { transform: scale(1.15); color: oklch(0.85 0.20 95); }
    100% { transform: scale(1); color: var(--mint); }
  }
  .savings-pulse {
    animation: pulseGold 0.8s ease;
  }

  .whatif-slider-container {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .whatif-slider-tooltip {
    position: absolute;
    top: -30px;
    transform: translateX(-50%);
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 4px 8px;
    border-radius: 6px;
    font-size: var(--font-size-small);
    color: var(--text);
    pointer-events: none;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    z-index: 5;
  }

  @media (max-width: 768px) {
    .card, .modal, .health-score-card, .ai-advisor-card, .stat-card, .income-banner {
      padding: var(--space-2);
    }
    .dashboard-grid {
      grid-template-columns: 1fr !important;
    }
    .stats-grid {
      grid-template-columns: 1fr !important;
      gap: var(--space-2);
    }
    .sidebar {
      transform: translateX(-100%);
      pointer-events: none;
    }
    .sidebar.open {
      transform: translateX(0);
      pointer-events: auto;
    }
    .mobile-header {
      display: flex !important;
    }
    .main {
      margin-left: 0 !important;
      padding: 80px var(--space-2) var(--space-4) !important;
    }
    .filter-chips {
      flex-wrap: wrap;
    }
    .tx-item {
      flex-wrap: wrap;
    }
    .tx-amount {
      margin-left: auto;
    }
    .cat-badge {
      font-size: var(--font-size-small);
    }
    .modal {
      max-width: 100%;
      border-radius: 0;
      padding: var(--space-2);
    }
    .whatif-input-group {
      flex-direction: column;
    }
    .income-row {
      flex-direction: column;
      align-items: stretch;
    }
    .health-score-main {
      flex-direction: column;
      text-align: center;
    }
    .donut-wrap {
      flex-direction: column;
    }
    .bulk-bar {
      left: 0 !important;
    }
    .install-banner {
      left: 20px !important;
      right: 20px !important;
    }
  }

  /* --- Original layout styles (kept from your file) --- */
  .app { display: flex; min-height: 100vh; }
  .sidebar { width: 240px; min-height: 100vh; background: var(--navy-deep); display: flex; flex-direction: column; padding: 32px 0; position: fixed; left: 0; top: 0; z-index: 100; transition: transform 0.3s ease; }
  .sidebar-logo { padding: 0 24px 32px; border-bottom: 1px solid #ffffff10; }
  .logo-text { font-family: var(--font-display); font-size: calc(22px * var(--text-scale)); font-weight: 800; color: white; letter-spacing: -0.5px; }
  .logo-dot { color: var(--mint); }
  .sidebar-nav { flex: 1; padding: 24px 12px; display: flex; flex-direction: column; gap: 4px; }
  .nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; cursor: pointer; transition: all 0.2s; color: #ffffff60; font-size: calc(14px * var(--text-scale)); font-weight: 500; border: none; background: none; width: 100%; text-align: left; }
  .nav-item:hover { background: #ffffff10; color: white; }
  .nav-item.active { background: var(--mint-dim); color: var(--mint); }
  .nav-item .nav-icon { font-size: calc(18px * var(--text-scale)); width: 24px; text-align: center; }
  .sidebar-footer { padding: 24px; border-top: 1px solid #ffffff10; }
  .user-chip { display: flex; align-items: center; gap: 10px; background: #ffffff08; border-radius: 10px; padding: 10px 12px; }
  .user-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--mint); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 700; font-size: calc(13px * var(--text-scale)); color: var(--navy-deep); flex-shrink: 0; }
  .user-name { color: white; font-size: calc(13px * var(--text-scale)); font-weight: 500; }

  .mobile-header { display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 200; background: var(--navy-deep); padding: 16px 20px; align-items: center; justify-content: space-between; border-bottom: 1px solid #ffffff10; height: 60px; }
  .hamburger { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; gap: 5px; padding: 4px; touch-action: manipulation; }
  .hamburger span { display: block; width: 22px; height: 2px; background: white; border-radius: 2px; }
  .mobile-overlay { display: none; pointer-events: none; position: fixed; inset: 0; background: #00000080; z-index: 150; }
  .mobile-overlay.open { display: block; pointer-events: auto; }

  .main { margin-left: 240px; flex: 1; padding: 40px; min-height: 100vh; background: var(--bg); position: relative; z-index: 1; pointer-events: auto; }

  .install-banner { position: fixed; bottom: 20px; left: 260px; right: 20px; background: var(--navy-deep); border-radius: 12px; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; z-index: 400; border-left: 3px solid var(--mint); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
  .install-banner p { color: white; font-size: calc(13px * var(--text-scale)); margin: 0; }
  .install-banner button { padding: 6px 16px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; touch-action: manipulation; }
  .install-btn { background: var(--mint); color: var(--navy-deep); }
  .dismiss-btn { background: none; color: var(--muted); border: 1px solid var(--border) !important; }

  .session-overlay { position: fixed; inset: 0; background: var(--navy-deep); z-index: 600; display: flex; align-items: center; justify-content: center; background-image: radial-gradient(ellipse at 20% 50%, var(--mint-dim) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #4299E110 0%, transparent 60%); }
  .session-card { background: var(--navy); border: 1px solid #ffffff10; border-radius: 20px; padding: 48px 40px; width: 100%; max-width: 400px; text-align: center; }
  .session-logo { font-family: var(--font-display); font-size: calc(32px * var(--text-scale)); font-weight: 800; color: white; margin-bottom: 24px; }
  .session-message { color: #ffffffb0; font-size: calc(14px * var(--text-scale)); margin-bottom: 32px; }
  .session-btn { padding: 14px 28px; background: var(--mint); color: var(--navy-deep); border: none; border-radius: 12px; font-family: var(--font-display); font-weight: 700; font-size: calc(16px * var(--text-scale)); cursor: pointer; touch-action: manipulation; }

  .auth-screen { min-height: 100vh; background: var(--navy-deep); display: flex; align-items: center; justify-content: center; padding: 20px; background-image: radial-gradient(ellipse at 20% 50%, var(--mint-dim) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #4299E110 0%, transparent 60%); }
  .auth-card { background: var(--navy); border: 1px solid #ffffff10; border-radius: 20px; padding: 48px 40px; width: 100%; max-width: 420px; box-shadow: 0 40px 80px #00000060; }
  .auth-logo { text-align: center; margin-bottom: 8px; }
  .auth-logo-text { font-family: var(--font-display); font-size: calc(28px * var(--text-scale)); font-weight: 800; color: white; }
  .auth-tagline { text-align: center; color: #ffffff50; font-size: calc(13px * var(--text-scale)); margin-bottom: 36px; }
  .auth-tabs { display: flex; background: #ffffff08; border-radius: 10px; padding: 4px; margin-bottom: 28px; }
  .auth-tab { flex: 1; padding: 10px; border: none; border-radius: 8px; cursor: pointer; font-family: var(--font-sans); font-size: calc(14px * var(--text-scale)); font-weight: 500; background: none; color: #ffffff50; transition: all 0.2s; touch-action: manipulation; }
  .auth-tab.active { background: var(--mint); color: var(--navy-deep); }
  .form-group { margin-bottom: 16px; }
  .form-label { display: block; color: #ffffff70; font-size: calc(12px * var(--text-scale)); font-weight: 500; margin-bottom: 8px; letter-spacing: 0.5px; text-transform: uppercase; }
  .form-input { width: 100%; padding: 14px 16px; background: #ffffff08; border: 1px solid #ffffff15; border-radius: 10px; color: white; font-family: var(--font-sans); font-size: calc(14px * var(--text-scale)); outline: none; transition: all 0.2s; -webkit-appearance: none; appearance: none; }
  .form-input:focus { border-color: var(--mint); background: #ffffff10; }
  .form-input::placeholder { color: #ffffff30; }
  .btn-primary { width: 100%; padding: 15px; background: var(--mint); color: var(--navy-deep); border: none; border-radius: 10px; font-family: var(--font-display); font-size: calc(15px * var(--text-scale)); font-weight: 700; cursor: pointer; margin-top: 8px; transition: all 0.2s; touch-action: manipulation; }
  .btn-primary:hover { background: var(--mint-hover); transform: translateY(-1px); }
  .btn-primary:active { transform: translateY(0); }

  .page-header { margin-bottom: 32px; }
  .greeting { font-family: var(--font-display); font-size: var(--font-size-h1); font-weight: 700; color: var(--text); }
  .greeting-name { color: var(--greeting-name); }
  .greeting-tagline { color: var(--muted); font-size: var(--font-size-body); margin-top: 4px; }

  .currency-banner { background: linear-gradient(135deg, var(--mint-dim), var(--surface)); border: 1px solid var(--mint); border-radius: 14px; padding: 16px 24px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
  .currency-banner-label { font-size: var(--font-size-small); color: var(--muted); }
  .currency-banner-value { font-family: var(--font-display); font-weight: 700; color: var(--mint); font-size: calc(14px * var(--text-scale)); }
  .currency-selector { padding: 8px 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text); font-family: var(--font-sans); font-size: calc(14px * var(--text-scale)); cursor: pointer; touch-action: manipulation; }

  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
  .stat-card { background: var(--surface); border-radius: 16px; padding: 24px; border: 1px solid var(--border); position: relative; overflow: hidden; transition: transform 0.2s; }
  .stat-card:hover { transform: translateY(-2px); }
  .stat-card::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
  .stat-card.spent::after { background: var(--danger); }
  .stat-card.free::after { background: var(--mint); }
  .stat-card.savings::after { background: #F6C90E; }
  .stat-label { font-size: var(--font-size-small); font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
  .stat-label small { font-size: calc(10px * var(--text-scale)); text-transform: none; font-weight: normal; color: var(--muted); }
  .stat-value { font-family: var(--font-display); font-size: var(--font-size-h1); font-weight: 700; color: var(--stat-value); }
  .stat-sub { font-size: var(--font-size-small); color: var(--muted); margin-top: 6px; }

  .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
  .card { background: var(--surface); border-radius: 16px; padding: 24px; border: 1px solid var(--border); }
  .card-title { font-family: var(--font-display); font-size: var(--font-size-h2); font-weight: 700; color: var(--text); margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }

  .budget-item { margin-bottom: 16px; }
  .budget-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: var(--font-size-body); }
  .budget-name { font-weight: 500; color: var(--text); }
  .budget-amount { color: var(--muted); }
  .budget-bar { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
  .budget-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
  .budget-warning { margin-top: 4px; font-size: var(--font-size-small); color: var(--danger); }

  .donut-wrap { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
  .donut-svg { flex-shrink: 0; }
  .donut-legend { display: flex; flex-direction: column; gap: 10px; flex: 1; }
  .legend-item { display: flex; align-items: center; gap: 8px; font-size: var(--font-size-body); }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .legend-name { color: var(--muted); flex: 1; }
  .legend-val { font-weight: 600; color: var(--text); font-size: var(--font-size-small); }

  .income-banner { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 24px; }
  .income-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
  .income-title { font-family: var(--font-display); font-size: var(--font-size-h2); font-weight: 700; color: var(--text); }
  .btn-add-income { padding: 8px 16px; background: var(--mint); color: var(--navy-deep); border: none; border-radius: 8px; font-size: var(--font-size-body); font-weight: 600; cursor: pointer; touch-action: manipulation; }
  .income-total { font-family: var(--font-display); font-size: var(--font-size-h1); font-weight: 800; color: var(--mint); margin-bottom: 12px; }
  .income-list { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
  .income-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: var(--font-size-body); }
  .income-type-badge { background: var(--mint-dim); color: var(--mint); padding: 2px 8px; border-radius: 20px; font-size: var(--font-size-small); font-weight: 600; }
  .income-amount { font-weight: 600; color: var(--mint); }
  .income-delete { background: none; border: none; color: var(--danger); cursor: pointer; font-size: calc(14px * var(--text-scale)); padding: 0 4px; touch-action: manipulation; }
  .credited-section { margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--border); }
  .credited-toggle { background: none; border: none; color: var(--mint); font-size: var(--font-size-small); cursor: pointer; display: flex; align-items: center; gap: 4px; touch-action: manipulation; }

  .filter-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
  .filter-chip { padding: 6px 14px; border-radius: 20px; font-size: var(--font-size-small); font-weight: 500; cursor: pointer; background: var(--bg); border: 1px solid var(--border); color: var(--text); touch-action: manipulation; }
  .filter-chip.active { background: var(--mint); border-color: var(--mint); color: var(--navy-deep); }

  .tx-list { display: flex; flex-direction: column; }
  .tx-item { display: flex; align-items: flex-start; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--border); position: relative; }
  .tx-content { flex: 1; min-width: 0; }
  .tx-main { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .tx-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: calc(16px * var(--text-scale)); flex-shrink: 0; }
  .tx-info { flex: 1; min-width: 0; }
  .tx-name { font-size: var(--font-size-body); font-weight: 500; color: var(--text); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .tx-name-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tx-notes-icon { font-size: var(--font-size-small); color: var(--mint); cursor: help; }
  .tx-date { font-size: var(--font-size-small); color: var(--muted); margin-top: 2px; }
  .tx-amount { font-family: var(--font-display); font-size: var(--font-size-body); font-weight: 700; white-space: nowrap; }
  .tx-amount.debit { color: var(--danger); }
  .tx-amount.credit { color: var(--mint); }
  .cat-badge { font-size: var(--font-size-small); padding: 3px 8px; border-radius: 20px; font-weight: 500; white-space: nowrap; }
  .tx-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .tx-tag { background: var(--mint-dim); color: var(--mint); padding: 2px 8px; border-radius: 12px; font-size: calc(10px * var(--text-scale)); font-weight: 500; }
  .split-badge { background: var(--mint-dim); color: var(--mint); padding: 2px 6px; border-radius: 4px; font-size: calc(9px * var(--text-scale)); font-weight: 600; margin-left: 6px; }
  .tx-menu { position: relative; flex-shrink: 0; }
  .tx-menu-btn { background: none; border: none; color: var(--muted); font-size: calc(18px * var(--text-scale)); cursor: pointer; padding: 4px 8px; border-radius: 6px; touch-action: manipulation; }
  .tx-menu-btn:hover { background: var(--border); color: var(--text); }
  .tx-dropdown { position: absolute; right: 0; top: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10; min-width: 140px; }
  .tx-dropdown button { display: block; width: 100%; text-align: left; padding: 8px 12px; background: none; border: none; font-size: var(--font-size-body); color: var(--text); cursor: pointer; touch-action: manipulation; }
  .tx-dropdown button:hover { background: var(--bg); }
  .split-row { margin-left: 50px; padding: 8px 0 8px 12px; border-left: 2px solid var(--mint); margin-top: -4px; margin-bottom: 4px; background: var(--bg); border-radius: 0 8px 8px 0; }
  .split-details { font-size: var(--font-size-small); color: var(--muted); display: flex; gap: 12px; flex-wrap: wrap; }

  .bulk-bar { position: fixed; bottom: 0; left: 240px; right: 0; background: var(--navy-deep); padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; z-index: 400; border-top: 1px solid var(--mint); flex-wrap: wrap; gap: 12px; }
  .bulk-bar .selected-count { color: white; font-size: var(--font-size-body); }
  .bulk-bar .bulk-actions { display: flex; gap: 12px; }
  .bulk-bar .bulk-actions button { padding: 8px 16px; border-radius: 8px; font-size: var(--font-size-body); font-weight: 600; cursor: pointer; border: none; touch-action: manipulation; }
  .bulk-recategorise { background: var(--mint); color: var(--navy-deep); }
  .bulk-delete { background: var(--danger); color: white; }
  .bulk-cancel { background: var(--surface); color: var(--text); border: 1px solid var(--border); }

  .upload-zone { border: 2px dashed var(--border); border-radius: 20px; padding: 60px 40px; text-align: center; cursor: pointer; transition: all 0.3s; background: var(--surface); margin-bottom: 24px; touch-action: manipulation; }
  .upload-zone:hover, .upload-zone.dragover { border-color: var(--mint); background: var(--mint-dim); }
  .upload-icon { font-size: calc(48px * var(--text-scale)); margin-bottom: 16px; }
  .upload-title { font-family: var(--font-display); font-size: calc(20px * var(--text-scale)); font-weight: 700; color: var(--text); margin-bottom: 8px; }
  .upload-sub { color: var(--muted); font-size: var(--font-size-body); margin-bottom: 24px; }
  .btn-upload { display: inline-block; padding: 12px 28px; background: var(--mint); color: var(--navy-deep); border: none; border-radius: 10px; font-family: var(--font-display); font-size: calc(14px * var(--text-scale)); font-weight: 700; cursor: pointer; touch-action: manipulation; }

  .upload-history { margin-top: 16px; }
  .history-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: var(--font-size-small); }

  .goals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
  .goal-card { background: var(--surface); border-radius: 16px; padding: 24px; border: 1px solid var(--border); }
  .goal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .goal-name { font-family: var(--font-display); font-size: var(--font-size-h2); font-weight: 700; color: var(--text); }
  .goal-emoji { font-size: calc(24px * var(--text-scale)); }
  .goal-amounts { display: flex; justify-content: space-between; margin-bottom: 10px; align-items: flex-end; }
  .goal-saved { font-family: var(--font-display); font-size: calc(18px * var(--text-scale)); font-weight: 700; color: var(--stat-value); }
  .goal-target { font-size: var(--font-size-body); color: var(--muted); }
  .progress-bar { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-bottom: 10px; }
  .progress-fill { height: 100%; background: var(--mint); border-radius: 3px; transition: width 0.6s ease; }
  .goal-meta { font-size: var(--font-size-small); color: var(--muted); }
  .add-goal-card { background: none; border: 2px dashed var(--border); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s; min-height: 160px; width: 100%; touch-action: manipulation; }
  .add-goal-card:hover { border-color: var(--mint); background: var(--mint-dim); }
  .add-goal-icon { font-size: calc(28px * var(--text-scale)); color: var(--muted); }
  .add-goal-text { font-size: var(--font-size-body); color: var(--muted); font-weight: 500; }

  .insight-card { background: linear-gradient(135deg, var(--navy) 0%, var(--navy-deep) 100%); border-radius: 16px; padding: 24px; color: white; margin-bottom: 20px; border: 1px solid #ffffff10; position: relative; overflow: hidden; }
  .insight-card::before { content: '💡'; position: absolute; right: 24px; top: 50%; transform: translateY(-50%); font-size: calc(48px * var(--text-scale)); opacity: 0.15; }
  .insight-label { font-size: var(--font-size-small); color: var(--mint); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .insight-text { font-size: var(--font-size-body); font-weight: 500; line-height: 1.5; max-width: 80%; color: white; }

  .whatif-scenario { margin-bottom: 32px; padding: 20px; background: var(--bg); border-radius: 16px; border: 1px solid var(--border); }
  .whatif-title { font-family: var(--font-display); font-size: var(--font-size-h2); font-weight: 700; color: var(--text); margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
  .whatif-input-group { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; align-items: flex-end; }
  .whatif-field { flex: 1; min-width: 120px; }
  .whatif-field label { display: block; font-size: var(--font-size-small); font-weight: 600; color: var(--muted); text-transform: uppercase; margin-bottom: 4px; }
  .whatif-field input, .whatif-field select { width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); font-size: var(--font-size-body); -webkit-appearance: none; appearance: none; }
  .whatif-output { margin-top: 16px; padding: 16px; background: var(--surface); border-radius: 12px; border-left: 3px solid var(--mint); }
  .whatif-output-text { font-size: var(--font-size-body); color: var(--text); }
  .whatif-output-value { font-family: var(--font-display); font-size: calc(20px * var(--text-scale)); font-weight: 800; color: var(--mint); }
  .custom-scenario-card { background: var(--surface); border-radius: 12px; padding: 16px; margin-bottom: 12px; border: 1px solid var(--border); }
  .custom-scenario-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .custom-scenario-text { font-size: var(--font-size-body); color: var(--text); }
  .custom-scenario-output { font-family: var(--font-display); font-size: calc(18px * var(--text-scale)); font-weight: 800; color: var(--mint); margin-top: 8px; }
  .delete-scenario { background: none; border: none; color: var(--danger); cursor: pointer; font-size: calc(16px * var(--text-scale)); padding: 4px; touch-action: manipulation; }

  .settings-section { margin-bottom: 32px; }
  .settings-title { font-family: var(--font-display); font-size: var(--font-size-small); font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
  .settings-card { background: var(--surface); border-radius: 16px; border: 1px solid var(--border); overflow: hidden; }
  .settings-row { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); gap: 12px; flex-wrap: wrap; }
  .settings-row:last-child { border-bottom: none; }
  .settings-row-label { font-size: var(--font-size-body); color: var(--text); font-weight: 500; }
  .settings-row-sub { font-size: var(--font-size-small); color: var(--muted); margin-top: 2px; }
  .settings-select { padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-family: var(--font-sans); font-size: var(--font-size-body); color: var(--text); background: var(--bg); outline: none; cursor: pointer; touch-action: manipulation; -webkit-appearance: none; appearance: none; }
  .btn-danger { padding: 8px 16px; background: var(--danger); color: white; border: none; border-radius: 8px; font-size: var(--font-size-body); font-weight: 600; cursor: pointer; white-space: nowrap; touch-action: manipulation; }
  .btn-danger:hover { opacity: 0.85; }
  .btn-outline { padding: 8px 16px; background: none; color: var(--mint); border: 1px solid var(--mint); border-radius: 8px; font-size: var(--font-size-body); font-weight: 600; cursor: pointer; white-space: nowrap; touch-action: manipulation; }
  .btn-outline:hover { background: var(--mint); color: var(--navy-deep); }

  .theme-toggle { display: flex; align-items: center; background: var(--bg); border: 1px solid var(--border); border-radius: 20px; padding: 3px; gap: 2px; cursor: pointer; }
  .theme-toggle-btn { padding: 6px 14px; border-radius: 16px; border: none; cursor: pointer; font-size: var(--font-size-body); font-weight: 500; transition: all 0.2s; background: none; color: var(--muted); touch-action: manipulation; }
  .theme-toggle-btn.active { background: var(--mint); color: var(--navy-deep); font-weight: 700; }

  .text-size-selector { display: flex; gap: 8px; }
  .size-btn { padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); cursor: pointer; font-size: var(--font-size-body); touch-action: manipulation; }
  .size-btn.active { background: var(--mint); color: var(--navy-deep); border-color: var(--mint); }

  .modal-overlay { position: fixed; inset: 0; background: #00000070; z-index: 500; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .modal { background: var(--surface); border-radius: 20px; padding: 32px; width: 100%; max-width: 500px; box-shadow: 0 40px 80px #00000030; max-height: 90vh; overflow-y: auto; border: 1px solid var(--border); }
  .modal-title { font-family: var(--font-display); font-size: calc(20px * var(--text-scale)); font-weight: 700; color: var(--text); margin-bottom: 24px; }
  .modal-input { width: 100%; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; font-family: var(--font-sans); font-size: var(--font-size-body); color: var(--text); background: var(--bg); outline: none; transition: border-color 0.2s; -webkit-appearance: none; appearance: none; }
  .modal-input:focus { border-color: var(--mint); }
  .modal-label { display: block; font-size: var(--font-size-small); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; margin-top: 16px; }
  .modal-actions { display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end; }
  .btn-cancel { padding: 12px 20px; background: var(--bg); color: var(--muted); border: 1px solid var(--border); border-radius: 10px; font-family: var(--font-sans); font-size: var(--font-size-body); cursor: pointer; touch-action: manipulation; }
  .btn-save { padding: 12px 24px; background: var(--mint); color: var(--navy-deep); border: none; border-radius: 10px; font-family: var(--font-display); font-size: var(--font-size-body); font-weight: 700; cursor: pointer; touch-action: manipulation; }
  .btn-save:hover { background: var(--mint-hover); }

  .category-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; margin-bottom: 16px; }
  .category-pill { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 30px; font-size: var(--font-size-body); font-weight: 500; cursor: pointer; transition: all 0.2s; background: var(--bg); border: 1px solid var(--border); color: var(--text); touch-action: manipulation; }
  .category-pill.active { border-color: var(--mint); background: var(--mint-dim); }
  .category-pill:hover { transform: scale(0.98); }

  .tags-input { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; border: 1px solid var(--border); border-radius: 10px; padding: 8px; background: var(--bg); }
  .tag-chip { background: var(--mint-dim); color: var(--mint); padding: 4px 8px; border-radius: 16px; font-size: var(--font-size-small); display: inline-flex; align-items: center; gap: 6px; }
  .tag-chip button { background: none; border: none; color: var(--mint); cursor: pointer; font-size: var(--font-size-small); padding: 0 2px; touch-action: manipulation; }
  .tags-input-field { border: none; background: none; padding: 4px; flex: 1; min-width: 80px; outline: none; color: var(--text); font-size: var(--font-size-body); -webkit-appearance: none; appearance: none; }

  .split-line { background: var(--bg); border-radius: 12px; padding: 12px; margin-bottom: 12px; border: 1px solid var(--border); }
  .split-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .split-title { font-size: var(--font-size-body); font-weight: 600; color: var(--muted); }
  .split-remove { background: none; border: none; color: var(--danger); cursor: pointer; font-size: calc(16px * var(--text-scale)); touch-action: manipulation; }
  .split-fields { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .split-fields input, .split-fields select { padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); font-size: var(--font-size-body); -webkit-appearance: none; appearance: none; }
  .split-total { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; font-size: var(--font-size-body); }
  .split-remainder { color: var(--mint); font-weight: 600; }

  .search-wrap { position: relative; margin-bottom: 20px; }
  .search-bar { width: 100%; padding: 12px 16px 12px 40px; border: 1px solid var(--border); border-radius: 10px; font-family: var(--font-sans); font-size: var(--font-size-body); background: var(--surface); outline: none; color: var(--text); transition: border-color 0.2s; -webkit-appearance: none; appearance: none; }
  .search-bar:focus { border-color: var(--mint); }
  .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: var(--font-size-body); pointer-events: none; }

  .sub-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border); }
  .sub-item:last-child { border-bottom: none; }
  .sub-name { font-size: var(--font-size-body); font-weight: 500; color: var(--text); }
  .sub-freq { font-size: var(--font-size-small); color: var(--muted); }
  .sub-amount { font-family: var(--font-display); font-size: var(--font-size-body); font-weight: 700; color: var(--danger); }

  .contact-links { display: flex; gap: 16px; justify-content: center; margin-top: 20px; flex-wrap: wrap; }
  .contact-card { background: var(--bg); border-radius: 12px; padding: 20px; text-align: center; flex: 1; border: 1px solid var(--border); }
  .contact-icon { font-size: calc(40px * var(--text-scale)); margin-bottom: 12px; }
  .contact-title { font-weight: 700; margin-bottom: 8px; }
  .whatsapp-link { display: inline-block; margin-top: 12px; padding: 8px 20px; background: #25D366; color: white; border-radius: 30px; text-decoration: none; font-weight: 600; touch-action: manipulation; }

  .toast { position: fixed; bottom: 24px; right: 24px; background: var(--navy-deep); color: white; padding: 14px 20px; border-radius: 12px; font-size: var(--font-size-body); border-left: 3px solid var(--mint); box-shadow: 0 8px 24px #00000030; z-index: 999; animation: slideUp 0.3s ease; }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
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
          {c.symbol}{(total * EXCHANGE_RATES[currency] / EXCHANGE_RATES[currency]).toLocaleString("en-BW", { maximumFractionDigits: 0 })}
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

// ─── AI ADVISOR (Phase 1: mock, Phase 2: redesigned) ──────────────────────
function AIAdvisor({ transactions, incomes, goals, budgets, currency }) {
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [aiStatus, setAiStatus] = useState("idle");

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const monthTxs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  
  const grossIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);
  const creditTransactions = monthTxs.filter(t => t.type === "credit").reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = grossIncome + creditTransactions;
  const totalSpent = monthTxs.filter(t => t.type === "debit").reduce((sum, t) => sum + t.amount, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpent) / totalIncome) * 100 : 0;
  
  const catMap = {};
  monthTxs.filter(t => t.type === "debit").forEach(t => {
    const cat = t.customCategory || t.category;
    catMap[cat] = (catMap[cat] || 0) + t.amount;
  });
  const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
  
  const categorySpending = {};
  monthTxs.filter(t => t.type === "debit").forEach(t => {
    const cat = t.customCategory || t.category;
    categorySpending[cat] = (categorySpending[cat] || 0) + t.amount;
  });
  const overBudget = budgets.filter(b => {
    const spent = categorySpending[b.category] || 0;
    return spent > b.amount;
  }).map(b => b.category);
  
  const generateAdvice = useCallback(async () => {
    if (transactions.length === 0) {
      setAiStatus("offline");
      setAdvice({
        summary: "No transactions to analyze yet.",
        opportunity: "Upload a bank statement or add transactions manually.",
        encouragement: "Start tracking your finances today!"
      });
      return;
    }
    
    setLoading(true);
    setAiStatus("thinking");
    try {
      const prompt = `You are a financial advisor for SpendSight users. 
Analyze this user's spending data and provide personalized advice.

User financial data:
- Monthly income: ${formatMoney(totalIncome, currency)}
- Total spent: ${formatMoney(totalSpent, currency)}
- Savings rate: ${savingsRate.toFixed(1)}%
- Top spending category: ${topCat ? topCat[0] : "None"} (${formatMoney(topCat ? topCat[1] : 0, currency)})
- Categories over budget: ${overBudget.length > 0 ? overBudget.join(", ") : "None"}

Return a JSON object with exactly these keys:
{
  "summary": "A one-sentence summary of their spending this month",
  "opportunity": "One specific savings opportunity with a suggested amount",
  "encouragement": "A brief encouraging message"
}`;

      const result = await callAIService(prompt);
      
      let parsedResult = result;
      if (result.raw) {
        try {
          const jsonMatch = result.raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedResult = JSON.parse(jsonMatch[0]);
          } else {
            parsedResult = {
              summary: result.raw.substring(0, 100) + "...",
              opportunity: "Review your spending categories for potential savings.",
              encouragement: "Every small step counts!"
            };
          }
        } catch (e) {
          parsedResult = {
            summary: "AI is having trouble generating advice right now.",
            opportunity: "Try refreshing or check your internet connection.",
            encouragement: "Keep tracking your finances!"
          };
        }
      }
      
      setAdvice(parsedResult);
      setAiStatus("live");
    } catch (error) {
      console.error('AI advisor error:', error);
      setAiStatus("error");
      setAdvice({
        summary: "Unable to connect to AI service. Using offline mode.",
        opportunity: "Review your top spending categories for potential savings.",
        encouragement: "Your financial journey continues regardless!"
      });
    }
    setLoading(false);
  }, [transactions, incomes, goals, budgets, currency, totalIncome, totalSpent, savingsRate, topCat, overBudget]);
  
  const generateReport = async () => {
    if (transactions.length === 0) {
      setReport({
        topCategory: "No data",
        trend: "unknown",
        assessment: "Add transactions to generate a report.",
        recommendations: ["Upload your first bank statement."]
      });
      setShowReport(true);
      return;
    }
    
    setReportLoading(true);
    setShowReport(true);
    try {
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const prevMonthSpent = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === prevMonth && d.getFullYear() === prevYear && t.type === "debit";
      }).reduce((sum, t) => sum + t.amount, 0);
      
      const prompt = `Generate a weekly spending report for a user with:
- Top spending category: ${topCat ? topCat[0] : "None"}
- Spending trend: ${totalSpent > prevMonthSpent ? "up" : "down"} (${totalSpent > prevMonthSpent ? "increasing" : "decreasing"})
- Current savings rate: ${savingsRate.toFixed(1)}%

Return a JSON object with:
{
  "topCategory": "The user's top spending category",
  "trend": "up" or "down",
  "assessment": "A brief assessment of their spending health",
  "recommendations": ["recommendation 1", "recommendation 2"]
}`;

      const result = await callAIService(prompt);
      
      let parsedResult = result;
      if (result.raw) {
        try {
          const jsonMatch = result.raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedResult = JSON.parse(jsonMatch[0]);
          } else {
            parsedResult = {
              topCategory: topCat ? topCat[0] : "None",
              trend: totalSpent > prevMonthSpent ? "up" : "down",
              assessment: "Your spending is within normal ranges.",
              recommendations: ["Review your subscriptions for unused services."]
            };
          }
        } catch (e) {
          parsedResult = {
            topCategory: topCat ? topCat[0] : "None",
            trend: totalSpent > prevMonthSpent ? "up" : "down",
            assessment: "Your spending is within normal ranges.",
            recommendations: ["Review your subscriptions for unused services."]
          };
        }
      }
      
      setReport(parsedResult);
    } catch (error) {
      console.error('AI report error:', error);
      setReport({
        topCategory: "Unable to analyze",
        trend: "unknown",
        assessment: "We're having trouble generating your report.",
        recommendations: ["Please try again later."]
      });
    }
    setReportLoading(false);
  };
  
  useEffect(() => {
    generateAdvice();
  }, [transactions.length, generateAdvice]);
  
  if (transactions.length === 0) {
    return (
      <div className="ai-advisor-card" style={{ borderLeft: '3px solid var(--mint)' }}>
        <div className="ai-advisor-header" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="ai-advisor-badge">Your Financial Advisor</span>
          <span className="ai-advisor-status offline" style={{ fontSize: 'var(--font-size-small)', color: 'var(--muted)' }}>⏸ No Data</span>
        </div>
        <div className="ai-advisor-summary" style={{ fontSize: 'var(--font-size-body)', fontWeight: 600, marginBottom: 8 }}>Upload transactions to get personalized financial advice.</div>
        <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--muted)' }}>Your advisor will analyze your spending patterns and suggest improvements.</div>
      </div>
    );
  }
  
  const statusClass = aiStatus === "live" ? "live" : 
                      aiStatus === "thinking" ? "thinking" : 
                      aiStatus === "error" || aiStatus === "offline" ? "error" : "ready";
  
  return (
    <div>
      <div className="ai-advisor-card" style={{ borderLeft: '3px solid var(--mint)' }}>
        <div className="ai-advisor-header" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <span className="ai-advisor-badge">Your Financial Advisor</span>
          <span className={`ai-advisor-status ${statusClass}`} style={{ fontSize: 'var(--font-size-small)', fontWeight: 600, color: aiStatus === 'live' ? 'var(--mint)' : 'var(--muted)' }}>
            {aiStatus === "thinking" ? "⏳ Thinking" : 
             aiStatus === "live" ? "✓ Live" : 
             aiStatus === "error" ? "✗ Offline" : 
             aiStatus === "offline" ? "⏸ No Data" : "Ready"}
          </span>
          <button className="ai-refresh-btn" onClick={generateAdvice} disabled={loading} style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 'var(--font-size-small)' }}>
            {loading ? "⏳" : "⟳ Refresh Advice"}
          </button>
        </div>
        
        {loading ? (
          <div className="ai-report-loading" style={{ textAlign: 'center', padding: '20px 0' }}>
            <div className="spinner" style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid var(--border)', borderTop: '3px solid var(--mint)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ marginTop: 12, color: 'var(--muted)' }}>Analyzing your finances...</div>
          </div>
        ) : advice ? (
          <>
            <div className="ai-advisor-summary" style={{ fontSize: 'var(--font-size-body)', fontWeight: 600, marginBottom: 8 }}>💡 {advice.summary}</div>
            <div className="ai-advisor-opportunity" style={{ fontSize: 'var(--font-size-body)', color: 'var(--text)', marginBottom: 6 }}>📌 {advice.opportunity}</div>
            <div className="ai-advisor-encouragement" style={{ fontSize: 'var(--font-size-body)', color: 'var(--mint)', fontWeight: 500 }}>🌟 {advice.encouragement}</div>
          </>
        ) : null}
      </div>
      
      <div style={{ marginBottom: 24 }}>
        <button className="btn-outline" onClick={() => setShowReport(!showReport)}>
          📊 {showReport ? "Hide" : "Generate"} Weekly Report
        </button>
      </div>
      
      {showReport && (
        <div className="ai-report-card card">
          <div className="card-title">📊 Weekly Spending Report</div>
          {reportLoading ? (
            <div className="ai-report-loading" style={{ textAlign: 'center', padding: '20px' }}>
              <div className="spinner" style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid var(--border)', borderTop: '3px solid var(--mint)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ marginTop: 12, color: 'var(--muted)' }}>Generating your report...</div>
            </div>
          ) : report ? (
            <div className="ai-report-content" style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--font-size-body)', lineHeight: 1.6 }}>
              <p><strong>Top Category:</strong> {report.topCategory}</p>
              <p><strong>Spending Trend:</strong> {report.trend === "up" ? "📈 Increasing" : report.trend === "down" ? "📉 Decreasing" : "➡️ Stable"}</p>
              <p><strong>Assessment:</strong> {report.assessment}</p>
              <div style={{ marginTop: 12 }}>
                <strong>Recommendations:</strong>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  {report.recommendations && report.recommendations.map((rec, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── FINANCIAL HEALTH (Phase 1: tooltips, Phase 3: savings pulse) ──────────
function FinancialHealth({ transactions, incomes, goals, budgets, currency }) {
  const health = calculateFinancialHealth(transactions, incomes, goals, budgets);
  const [pulse, setPulse] = useState(false);
  
  useEffect(() => {
    if (health.hasData && health.savingsRate >= 20) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [health.savingsRate, health.hasData]);
  
  if (!health.hasData) {
    return (
      <div className="health-score-card">
        <div className="health-no-data" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div className="empty-text">No financial data yet</div>
          <div className="empty-sub">Upload transactions or add income to see your financial health score</div>
        </div>
      </div>
    );
  }
  
  const scoreColor = health.score >= 70 ? "var(--mint)" : health.score >= 40 ? "#F6C90E" : "var(--danger)";
  
  const getInsights = () => {
    const insights = [];
    if (health.savingsRate >= 20) insights.push({ icon: "💰", text: `You saved ${health.savingsRate}% of income this month — Excellent!` });
    else if (health.savingsRate >= 10) insights.push({ icon: "💪", text: `Savings rate of ${health.savingsRate}% — Keep going!` });
    else if (health.savingsRate > 0) insights.push({ icon: "📈", text: `Try to save at least 10% of income (currently ${health.savingsRate}%)` });
    
    if (health.budgetScore >= 90 && health.budgetScore > 0) insights.push({ icon: "✅", text: "All categories within budget — Great discipline!" });
    else if (health.budgetScore >= 70 && health.budgetScore > 0) insights.push({ icon: "⚠️", text: "Some categories over budget — Review spending" });
    else if (health.budgetScore > 0) insights.push({ icon: "🔴", text: "Multiple categories over budget — Consider adjustments" });
    
    if (health.stabilityScore >= 80 && health.stabilityScore > 0) insights.push({ icon: "📊", text: "Spending stable — no major fluctuations" });
    else if (health.stabilityScore >= 50 && health.stabilityScore > 0) insights.push({ icon: "📉", text: "Spending fluctuating — review irregular expenses" });
    else if (health.stabilityScore > 0) insights.push({ icon: "📊", text: "Significant spending changes — investigate" });
    
    if (goals.length > 0) {
      const onTrack = goals.filter(g => (g.saved / g.target) * 100 >= 50).length;
      insights.push({ icon: "🎯", text: `${onTrack}/${goals.length} goals on track` });
    }
    
    return insights.slice(0, 4);
  };
  
  const insights = getInsights();
  
  return (
    <div className="health-score-card">
      <div className="health-score-main" style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
        <div className="health-score-circle" style={{ width: 100, height: 100, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: scoreColor, color: 'white', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--font-size-h1)' }}>
          {health.score}
          <span className="grade" style={{ fontSize: 'var(--font-size-small)', fontWeight: 600, opacity: 0.9 }}>Grade {health.grade}</span>
        </div>
        <div className="health-score-details" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
          <div className="health-metric">
            <div className="health-metric-label" style={{ fontSize: 'var(--font-size-small)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Savings Rate</div>
            <div className={`health-metric-value ${pulse ? 'savings-pulse' : ''}`} style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-h2)', fontWeight: 700, color: 'var(--text)' }}>
              {health.savingsRate}%
            </div>
            <div className="health-metric-bar" style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
              <div className="health-metric-bar-fill" style={{ height: '100%', width: `${health.savingsScore}%`, background: 'var(--mint)', borderRadius: 2, transition: 'width 0.6s ease' }} />
            </div>
            <div className="tooltip">Percentage of income saved this month. Aim for ≥20%.</div>
          </div>
          <div className="health-metric">
            <div className="health-metric-label" style={{ fontSize: 'var(--font-size-small)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Budget</div>
            <div className="health-metric-value" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-h2)', fontWeight: 700, color: 'var(--text)' }}>{health.budgetScore}%</div>
            <div className="health-metric-bar" style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
              <div className="health-metric-bar-fill" style={{ height: '100%', width: `${health.budgetScore}%`, background: 'var(--mint)', borderRadius: 2, transition: 'width 0.6s ease' }} />
            </div>
            <div className="tooltip">How well you're staying within your set budgets. 100% = perfect.</div>
          </div>
          <div className="health-metric">
            <div className="health-metric-label" style={{ fontSize: 'var(--font-size-small)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stability</div>
            <div className="health-metric-value" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-h2)', fontWeight: 700, color: 'var(--text)' }}>{health.stabilityScore}%</div>
            <div className="health-metric-bar" style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
              <div className="health-metric-bar-fill" style={{ height: '100%', width: `${health.stabilityScore}%`, background: 'var(--mint)', borderRadius: 2, transition: 'width 0.6s ease' }} />
            </div>
            <div className="tooltip">Measures month-to-month spending fluctuation. Higher = more predictable.</div>
          </div>
          <div className="health-metric">
            <div className="health-metric-label" style={{ fontSize: 'var(--font-size-small)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Goals</div>
            <div className="health-metric-value" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-h2)', fontWeight: 700, color: 'var(--text)' }}>{health.goalScore}%</div>
            <div className="health-metric-bar" style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
              <div className="health-metric-bar-fill" style={{ height: '100%', width: `${health.goalScore}%`, background: 'var(--mint)', borderRadius: 2, transition: 'width 0.6s ease' }} />
            </div>
            <div className="tooltip">Average progress toward your saving goals.</div>
          </div>
        </div>
      </div>
      
      <div className="risk-meter" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, padding: '12px 16px', borderRadius: 8, background: 'var(--bg)' }}>
        <div className={`risk-dot ${health.riskLevel}`} style={{ width: 12, height: 12, borderRadius: '50%', background: health.riskLevel === 'green' ? 'var(--risk-green)' : health.riskLevel === 'yellow' ? 'var(--risk-yellow)' : 'var(--risk-red)', flexShrink: 0 }} />
        <span className="risk-label" style={{ fontWeight: 600, fontSize: 'var(--font-size-body)' }}>{health.riskLabel}</span>
        {health.riskFactors.length > 0 && (
          <span className="risk-factors" style={{ fontSize: 'var(--font-size-small)', color: 'var(--muted)' }}>• {health.riskFactors.join(" • ")}</span>
        )}
        {health.riskFactors.length === 0 && health.hasData && (
          <span className="risk-factors" style={{ fontSize: 'var(--font-size-small)', color: 'var(--muted)' }}>• All metrics look good!</span>
        )}
      </div>
      
      {insights.length > 0 && (
        <div className="insight-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 12 }}>
          {insights.map((insight, idx) => (
            <div key={idx} className="insight-mini-card" style={{ background: 'var(--bg)', padding: '12px 16px', borderRadius: 8, borderLeft: '3px solid var(--mint)' }}>
              <span className="icon" style={{ fontSize: 'var(--font-size-body)', marginRight: 8 }}>{insight.icon}</span>
              <span className="text" style={{ fontSize: 'var(--font-size-body)' }}>{insight.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CONTACT PAGE ─────────────────────────────────────────────────────────────
function ContactPage() {
  return (
    <div>
      <div className="page-header">
        <div className="greeting" style={{ fontSize: 24 }}>📞 Contact Developer</div>
        <div className="greeting-tagline">Report bugs, suggest features, or just say hello</div>
      </div>
      <div className="contact-links">
        <div className="contact-card">
          <div className="contact-icon">💬</div>
          <div className="contact-title">WhatsApp</div>
          <p>Chat with me directly on WhatsApp</p>
          <a href="https://wa.me/qr/Q3V42P52MH4OA1" target="_blank" rel="noopener noreferrer" className="whatsapp-link">Message on WhatsApp →</a>
        </div>
        <div className="contact-card">
          <div className="contact-icon">📧</div>
          <div className="contact-title">Email</div>
          <p>Send me an email with your feedback</p>
          <a href="mailto:spendsight@example.com?subject=SpendSight Feedback" className="btn-outline" style={{ marginTop: 12, display: "inline-block" }}>Send Email →</a>
        </div>
      </div>
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title">Common Issues</div>
        <ul style={{ listStyle: "none", padding: 0 }}>
          <li style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>🔍 <strong>Transactions not showing?</strong> Check your CSV format or upload a different file</li>
          <li style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>💰 <strong>Wrong currency conversion?</strong> Make sure you selected your preferred currency at the top</li>
          <li style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>📊 <strong>Data lost?</strong> Use Backup/Restore in Settings to save your data</li>
          <li style={{ padding: "8px 0" }}>💡 <strong>Feature request?</strong> I'd love to hear your ideas!</li>
        </ul>
      </div>
    </div>
  );
}
// ─── WHAT-IF PAGE (Phase 3: slider tooltip) ────────────────────────────────
function WhatIfPage({ transactions, incomes, currency, customScenarios, onAddScenario, onDeleteScenario }) {
  const [habitName, setHabitName] = useState("");
  const [habitDays, setHabitDays] = useState(30);
  const [habitCost, setHabitCost] = useState("");
  const [habitTimesPerWeek, setHabitTimesPerWeek] = useState(1);
  const [reduceCategory, setReduceCategory] = useState("Groceries");
  const [reducePercent, setReducePercent] = useState(10);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customForm, setCustomForm] = useState({ action: "", amount: "", frequency: "monthly", duration: "", durationUnit: "months" });
  const [tooltipPosition, setTooltipPosition] = useState(0);
  const sliderRef = useRef(null);
  
  const grossIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);
  const monthlyIncome = grossIncome;
  
  const categorySpend = {};
  transactions.filter(t => t.type === "debit").forEach(t => {
    const cat = t.customCategory || t.category;
    categorySpend[cat] = (categorySpend[cat] || 0) + t.amount;
  });
  const monthlyCategorySpend = categorySpend[reduceCategory] || 0;
  
  const habitTotalCost = parseFloat(habitCost) || 0;
  const habitTotal = habitTotalCost * habitTimesPerWeek * (habitDays / 7);
  const habitPercentOfIncome = monthlyIncome > 0 ? (habitTotal / monthlyIncome) * 100 : 0;
  
  const reducedAmount = monthlyCategorySpend * (reducePercent / 100);
  const yearlySavings = reducedAmount * 12;
  
  const handleReduceChange = (e) => {
    const val = parseInt(e.target.value);
    setReducePercent(val);
    if (sliderRef.current) {
      const pct = (val - 0) / (50 - 0);
      const width = sliderRef.current.offsetWidth;
      setTooltipPosition(pct * width);
    }
  };
  
  const calculateCustomScenario = (scenario) => {
    const amount = parseFloat(scenario.amount) || 0;
    let multiplier = 1;
    switch (scenario.frequency) {
      case "daily": multiplier = scenario.durationUnit === "days" ? scenario.duration : scenario.duration * 30; break;
      case "weekly": multiplier = scenario.durationUnit === "weeks" ? scenario.duration : scenario.duration * 4; break;
      case "monthly": multiplier = scenario.durationUnit === "months" ? scenario.duration : scenario.duration * 12; break;
      case "yearly": multiplier = scenario.durationUnit === "years" ? scenario.duration : scenario.duration; break;
      default: multiplier = 1;
    }
    const total = amount * multiplier;
    return { total, multiplier };
  };
  
  const handleAddCustomScenario = () => {
    if (!customForm.action || !customForm.amount) return;
    const result = calculateCustomScenario(customForm);
    onAddScenario({
      id: Date.now(),
      ...customForm,
      amount: parseFloat(customForm.amount),
      duration: parseInt(customForm.duration) || 1,
      calculatedTotal: result.total
    });
    setCustomForm({ action: "", amount: "", frequency: "monthly", duration: "", durationUnit: "months" });
    setShowCustomModal(false);
  };
  
  return (
    <div>
      <div className="page-header">
        <div className="greeting" style={{ fontSize: 24 }}>🧮 What-If Calculator</div>
        <div className="greeting-tagline">See how small changes can make a big difference</div>
      </div>
      
      <div className="whatif-scenario">
        <div className="whatif-title">Scenario A: Skip a habit</div>
        <div className="whatif-input-group">
          <div className="whatif-field"><label>Habit name</label><input placeholder="e.g. Coffee, Takeout" value={habitName} onChange={e => setHabitName(e.target.value)} /></div>
          <div className="whatif-field"><label>Days skipped</label><input type="number" value={habitDays} onChange={e => setHabitDays(parseInt(e.target.value) || 0)} /></div>
          <div className="whatif-field"><label>Cost per time ({CURRENCIES[currency]?.symbol || "P"})</label><input type="number" step="0.01" value={habitCost} onChange={e => setHabitCost(e.target.value)} /></div>
          <div className="whatif-field"><label>Times per week</label><input type="number" value={habitTimesPerWeek} onChange={e => setHabitTimesPerWeek(parseInt(e.target.value) || 0)} /></div>
        </div>
        {habitTotalCost > 0 && habitDays > 0 && (
          <div className="whatif-output">
            <div className="whatif-output-text">If you skip <strong>{habitName || "this habit"}</strong> for <strong>{habitDays} days</strong>:</div>
            <div className="whatif-output-value">You'd save {formatMoney(habitTotal, currency)}</div>
            <div className="whatif-output-text">That's <strong>{habitPercentOfIncome.toFixed(1)}%</strong> of your monthly income</div>
          </div>
        )}
      </div>
      
      <div className="whatif-scenario">
        <div className="whatif-title">Scenario B: Reduce a category</div>
        <div className="whatif-input-group">
          <div className="whatif-field"><label>Category</label><select value={reduceCategory} onChange={e => setReduceCategory(e.target.value)}>{DEFAULT_CATEGORIES.map(c => (<option key={c.name} value={c.name}>{c.icon} {c.name}</option>))}</select></div>
          <div className="whatif-field" style={{ flex: 2 }}>
            <label>Reduce by (%)</label>
            <div className="whatif-slider-container">
              <input type="range" ref={sliderRef} min="0" max="50" value={reducePercent} onChange={handleReduceChange} style={{ flex: 1, width: '100%' }} />
              <div className="whatif-slider-tooltip" style={{ left: tooltipPosition }}>{reducePercent}%</div>
            </div>
          </div>
        </div>
        <div className="whatif-output">
          <div className="whatif-output-text">Current monthly spend on {reduceCategory}: <strong>{formatMoney(monthlyCategorySpend, currency)}</strong></div>
          <div className="whatif-output-value">You'd save {formatMoney(reducedAmount, currency)}/month</div>
          <div className="whatif-output-text">That's <strong>{formatMoney(yearlySavings, currency)}/year</strong></div>
        </div>
      </div>
      
      <div className="whatif-scenario">
        <div className="whatif-title">
          <span>✨ Your Custom Scenarios</span>
          <button className="btn-outline" onClick={() => setShowCustomModal(true)}>+ Add Custom Scenario</button>
        </div>
        {customScenarios.length === 0 ? (
          <div className="empty-state"><div className="empty-text">No custom scenarios yet. Create your own "what-if" above.</div></div>
        ) : (
          customScenarios.map(scenario => {
            const result = calculateCustomScenario(scenario);
            return (
              <div key={scenario.id} className="custom-scenario-card">
                <div className="custom-scenario-header">
                  <div className="custom-scenario-text">
                    If I <strong>{scenario.action}</strong> <strong>{formatMoney(scenario.amount, currency)}</strong> {scenario.frequency}
                    {scenario.duration ? ` for ${scenario.duration} ${scenario.durationUnit}` : " (ongoing)"}
                  </div>
                  <button className="delete-scenario" onClick={() => onDeleteScenario(scenario.id)}>✕</button>
                </div>
                <div className="custom-scenario-output">
                  {scenario.duration ? `Total: ${formatMoney(result.total, currency)}` : `Save ${formatMoney(scenario.amount * (scenario.frequency === 'weekly' ? 52 : scenario.frequency === 'daily' ? 365 : 12), currency)}/year`}
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {showCustomModal && (
        <div className="modal-overlay" onClick={() => setShowCustomModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Create Custom Scenario</div>
            <label className="modal-label">Action description</label>
            <input className="modal-input" placeholder="e.g., save on eating out, invest in stocks" value={customForm.action} onChange={e => setCustomForm(f => ({ ...f, action: e.target.value }))} />
            <label className="modal-label">Amount ({CURRENCIES[currency]?.symbol || "P"})</label>
            <input className="modal-input" type="number" step="0.01" placeholder="0.00" value={customForm.amount} onChange={e => setCustomForm(f => ({ ...f, amount: e.target.value }))} />
            <label className="modal-label">Frequency</label>
            <select className="modal-input" value={customForm.frequency} onChange={e => setCustomForm(f => ({ ...f, frequency: e.target.value }))}>
              <option value="one-time">One-time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
            </select>
            <label className="modal-label">Duration (optional)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="modal-input" type="number" placeholder="Number" value={customForm.duration} onChange={e => setCustomForm(f => ({ ...f, duration: e.target.value }))} />
              <select className="modal-input" value={customForm.durationUnit} onChange={e => setCustomForm(f => ({ ...f, durationUnit: e.target.value }))}>
                <option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option><option value="years">Years</option>
              </select>
            </div>
            <div className="modal-actions"><button className="btn-cancel" onClick={() => setShowCustomModal(false)}>Cancel</button><button className="btn-save" onClick={handleAddCustomScenario}>Add Scenario</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD PAGE (Phase 3: staggered budget bars) ─────────────────────────
function Dashboard({ user, transactions, goals, incomes, budgets, onUpdateBudget, onAddIncome, onDeleteIncome, currency, onCurrencyChange, showToast }) {
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showCreditedBreakdown, setShowCreditedBreakdown] = useState(false);
  const [incomeForm, setIncomeForm] = useState({ source: "Salary", amount: "", label: "", date: new Date().toISOString().split("T")[0] });
  const [budgetForm, setBudgetForm] = useState(DEFAULT_CATEGORIES.map(c => ({ category: c.name, amount: budgets.find(b => b.category === c.name)?.amount || "" })));
  const [customCategories, setCustomCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [currencyConfirmShown, setCurrencyConfirmShown] = useState(false);
  const [budgetBarsAnimated, setBudgetBarsAnimated] = useState(false);
  
  useEffect(() => {
    if (budgets.length > 0) {
      const timer = setTimeout(() => setBudgetBarsAnimated(true), 100);
      return () => clearTimeout(timer);
    }
  }, [budgets]);
  
  const tagline = taglines[new Date().getDay() % taglines.length];
  
  const grossIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);
  const creditTransactionsSum = transactions.filter(t => t.type === "credit").reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = grossIncome + creditTransactionsSum;
  const totalSpent = transactions.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const freeCash = Math.max(0, totalIncome - totalSpent);
  
  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const savingsProgress = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
  
  const creditedTransactions = transactions.filter(t => t.type === "credit" && t.incomeType);
  
  const categorySpending = {};
  transactions.filter(t => t.type === "debit").forEach(t => {
    const cat = t.customCategory || t.category;
    categorySpending[cat] = (categorySpending[cat] || 0) + t.amount;
  });
  
  const catMap = {};
  transactions.filter(t => t.type === "debit").forEach(t => {
    const cat = t.customCategory || t.category;
    catMap[cat] = (catMap[cat] || 0) + t.amount;
  });
  const chartData = Object.entries(catMap).map(([name, value]) => {
    const cat = DEFAULT_CATEGORIES.find(c => c.name === name) || { name, color: "#CBD5E0", icon: "📦" };
    return { name, value, color: cat.color };
  }).sort((a, b) => b.value - a.value);
  
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const barData = months.map((label, mi) => ({
    label,
    value: transactions.filter(t => t.type === "debit" && new Date(t.date).getMonth() === mi).reduce((s, t) => s + t.amount, 0)
  }));
  
  const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  
  // Spending alerts (unchanged)
  useEffect(() => {
    if (transactions.length > 0) {
      const lastTx = transactions[0];
      if (lastTx && lastTx.amount > 1000 && lastTx.type === "debit") {
        const alertShown = localStorage.getItem(`alert_${lastTx.id}`);
        if (!alertShown) {
          showToast(`⚠️ Large transaction: ${formatMoney(lastTx.amount, currency)} at ${lastTx.description}`);
          localStorage.setItem(`alert_${lastTx.id}`, "true");
        }
      }
    }
  }, [transactions, currency, showToast]);
  
  const handleCurrencyChange = (newCurrency) => {
    if (!currencyConfirmShown) {
      showToast(`✅ Currency selected: ${CURRENCIES[newCurrency].name}. All amounts will be treated and registered as ${CURRENCIES[newCurrency].symbol}.`);
      setCurrencyConfirmShown(true);
    }
    onCurrencyChange(newCurrency);
  };
  
  const handleAddIncome = () => {
    if (!incomeForm.amount || incomeForm.amount <= 0) {
      showToast("Please enter a valid amount");
      return;
    }
    onAddIncome({
      id: Date.now(),
      source: incomeForm.source,
      amount: parseFloat(incomeForm.amount),
      label: incomeForm.label || "",
      date: incomeForm.date
    });
    setIncomeForm({ source: "Salary", amount: "", label: "", date: new Date().toISOString().split("T")[0] });
    setShowIncomeModal(false);
    showToast(`💰 Added ${formatMoney(parseFloat(incomeForm.amount), currency)} from ${incomeForm.source}`);
  };
  
  const handleAddCustomCategory = () => {
    if (!newCategoryName.trim()) return;
    const name = newCategoryName.trim();
    if (customCategories.includes(name) || DEFAULT_CATEGORIES.some(c => c.name === name)) {
      showToast("Category already exists");
      return;
    }
    setCustomCategories([...customCategories, name]);
    setBudgetForm([...budgetForm, { category: name, amount: "" }]);
    setNewCategoryName("");
    showToast(`Added category: ${name}`);
  };
  
  const handleSaveAllBudgets = () => {
    const newBudgets = budgetForm.filter(b => b.amount && b.amount > 0).map(b => ({ category: b.category, amount: parseFloat(b.amount) }));
    onUpdateBudget(newBudgets);
    setShowBudgetModal(false);
    showToast(`Budgets saved for ${newBudgets.length} categories`);
  };
  
  const incomeSources = ["Salary", "Business", "Allowance", "Gift", "Side Hustle", "Other"];
  const allCategories = [...DEFAULT_CATEGORIES.map(c => c.name), ...customCategories];
  
  return (
    <div>
      <div className="currency-banner">
        <div><div className="currency-banner-label">Your preferred currency</div><div className="currency-banner-value">{CURRENCIES[currency]?.name || "BWP — Pula"}</div></div>
        <select className="currency-selector" value={currency} onChange={(e) => handleCurrencyChange(e.target.value)}>{Object.entries(CURRENCIES).map(([code, c]) => (<option key={code} value={code}>{c.name}</option>))}</select>
      </div>
      
      <div className="page-header"><div className="greeting">{getGreeting()}, <span className="greeting-name">{user.name} 👋</span></div><div className="greeting-tagline">{tagline}</div></div>
      
      <AIAdvisor 
        transactions={transactions}
        incomes={incomes}
        goals={goals}
        budgets={budgets}
        currency={currency}
      />
      
      <FinancialHealth 
        transactions={transactions}
        incomes={incomes}
        goals={goals}
        budgets={budgets}
        currency={currency}
      />
      
      <div className="income-banner">
        <div className="income-header"><div className="income-title">💰 Income Sources</div><button className="btn-add-income" onClick={() => setShowIncomeModal(true)}>+ Add Income</button></div>
        <div className="income-total">{formatMoney(grossIncome, currency)}</div>
        <div className="income-list">
          {incomes.length === 0 && (<div className="empty-text" style={{ textAlign: "center", padding: "12px" }}>No income sources added yet. Click + Add Income.</div>)}
          {incomes.map(inc => (<div key={inc.id} className="income-row"><div><span className="income-type-badge">{inc.source}</span>{inc.label && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--muted)" }}>— {inc.label}</span>}<div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{inc.date}</div></div><div><span className="income-amount">{formatMoney(inc.amount, currency)}</span><button className="income-delete" onClick={() => onDeleteIncome(inc.id)}>✕</button></div></div>))}
        </div>
        {creditedTransactions.length > 0 && (
          <div className="credited-section">
            <button className="credited-toggle" onClick={() => setShowCreditedBreakdown(!showCreditedBreakdown)}>
              {showCreditedBreakdown ? "▼" : "▶"} Credited Income ({creditedTransactions.length})
            </button>
            {showCreditedBreakdown && (
              <div className="income-list" style={{ marginTop: 8 }}>
                {creditedTransactions.map(tx => (
                  <div key={tx.id} className="income-row">
                    <div>
                      <span className="income-type-badge">{tx.incomeType || "Other"}</span>
                      <span style={{ marginLeft: 8, fontSize: 13 }}>{tx.description}</span>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{tx.date}</div>
                    </div>
                    <div className="income-amount">+{formatMoney(tx.amount, currency)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="stats-grid">
        <div className="stat-card spent"><div className="stat-label">Total Spent</div><div className="stat-value">{formatMoney(totalSpent, currency)}</div><div className="stat-sub">This month</div></div>
        <div className="stat-card free"><div className="stat-label">Free Cash <small style={{ display: "block", fontSize: 10, marginTop: 2 }}>(money left after expenses)</small></div><div className="stat-value">{formatMoney(freeCash, currency)}</div><div className="stat-sub">Income + Credits - Spending</div></div>
        <div className="stat-card savings"><div className="stat-label">Savings Progress</div><div className="stat-value">{savingsProgress}%</div><div className="stat-sub">{formatMoney(totalSaved, currency)} saved of {formatMoney(totalTarget, currency)} target</div></div>
      </div>
      
      <div className="dashboard-grid">
        <div className="card"><div className="card-title">Spending by Category</div><DonutChart data={chartData} currency={currency} /></div>
        <div className="card"><div className="card-title">Monthly Budgets <button className="btn-outline" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => setShowBudgetModal(true)}>Edit All Budgets</button></div>
          {budgets.length === 0 ? (<div className="empty-state"><div className="empty-text">No budgets set. Click "Edit All Budgets" to start planning.</div></div>) : (
            budgets.map((b, idx) => {
              const spent = categorySpending[b.category] || 0;
              const percent = Math.min((spent / b.amount) * 100, 100);
              const isOver = spent > b.amount;
              return (<div key={b.category} className="budget-item"><div className="budget-header"><span className="budget-name">{b.category}</span><span className="budget-amount">{formatMoney(spent, currency)} / {formatMoney(b.amount, currency)}</span></div><div className="budget-bar"><div className={`budget-fill ${budgetBarsAnimated ? 'stagger' : ''}`} style={{ '--final-width': `${percent}%`, width: budgetBarsAnimated ? 0 : `${percent}%`, animationDelay: `${idx * 100}ms`, background: isOver ? 'var(--danger)' : 'var(--mint)' }} /></div>{percent > 90 && <div className="budget-warning">{percent > 100 ? "⚠️ Over budget!" : "⚠️ Near limit"}</div>}</div>);
            })
          )}
        </div>
      </div>
      
      <div className="card">
        <div className="card-title">Recent Transactions</div>
        {recent.length === 0 ? (<div className="empty-state"><div className="empty-icon">📋</div><div className="empty-text">No transactions yet</div><div className="empty-sub">Upload a bank statement to see your transactions</div></div>) : (
          <div className="tx-list">{recent.map((t, i) => { const cat = t.customCategory || t.category; const catObj = DEFAULT_CATEGORIES.find(c => c.name === cat) || { color: "#CBD5E0", icon: "📦" }; return (<div key={i} className="tx-item"><div className="tx-icon" style={{ background: catObj.color + "20" }}>{catObj.icon}</div><div className="tx-info"><div className="tx-name">{t.description}</div><div className="tx-date">{t.date}</div></div><span className="cat-badge" style={{ background: catObj.color + "20", color: catObj.color }}>{cat}</span><div className={`tx-amount ${t.type}`}>{t.type === "debit" ? "-" : "+"}{formatMoney(t.amount, currency)}</div></div>);})}</div>
        )}
      </div>
      
      {showIncomeModal && (<div className="modal-overlay" onClick={() => setShowIncomeModal(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-title">Add Income</div><label className="modal-label">Source Type</label><select className="modal-input" value={incomeForm.source} onChange={e => setIncomeForm(f => ({ ...f, source: e.target.value }))} style={{ appearance: "auto" }}>{incomeSources.map(s => <option key={s} value={s}>{s}</option>)}</select><label className="modal-label">Amount ({CURRENCIES[currency]?.symbol || "P"})</label><input className="modal-input" type="number" placeholder="e.g. 5000" step="0.01" value={incomeForm.amount} onChange={e => setIncomeForm(f => ({ ...f, amount: e.target.value }))} /><label className="modal-label">Label (optional)</label><input className="modal-input" placeholder="e.g. Freelance project" value={incomeForm.label} onChange={e => setIncomeForm(f => ({ ...f, label: e.target.value }))} /><label className="modal-label">Date</label><input className="modal-input" type="date" value={incomeForm.date} onChange={e => setIncomeForm(f => ({ ...f, date: e.target.value }))} /><div className="modal-actions"><button className="btn-cancel" onClick={() => setShowIncomeModal(false)}>Cancel</button><button className="btn-save" onClick={handleAddIncome}>Add Income</button></div></div></div>)}
      
      {showBudgetModal && (<div className="modal-overlay" onClick={() => setShowBudgetModal(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}><div className="modal-title">Set Monthly Budgets</div><p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Set your spending limits for each category. Click "Save All Budgets" when done.</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input className="modal-input" style={{ flex: 1 }} placeholder="Add custom category..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
          <button className="btn-outline" onClick={handleAddCustomCategory}>+ Add</button>
        </div>
        <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
          {budgetForm.map((b, idx) => (<div key={b.category} className="budget-item" style={{ marginBottom: 12 }}><div className="budget-header"><span className="budget-name">{b.category}</span></div><input className="modal-input" type="number" step="0.01" placeholder="Budget amount" value={b.amount} onChange={e => { const newForm = [...budgetForm]; newForm[idx].amount = e.target.value; setBudgetForm(newForm); }} /></div>))}
        </div>
        <div className="modal-actions"><button className="btn-cancel" onClick={() => setShowBudgetModal(false)}>Cancel</button><button className="btn-save" onClick={handleSaveAllBudgets}>Save All Budgets</button></div></div></div>)}
    </div>
  );
}

// ─── UPLOAD PAGE (Phase 1: removed PDF mock and receipt scanner) ──────────
function UploadPage({ onUpload, uploadedFiles, currency, showToast }) {
  const [dragover, setDragover] = useState(false);
  const [preview, setPreview] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [multipleTransactions, setMultipleTransactions] = useState([
    { id: Date.now(), description: "", amount: "", date: new Date().toISOString().split("T")[0], type: "debit", category: "Other", customCategory: "", tags: [], notes: "" }
  ]);
  const fileRef = useRef();
  
  const handleAddTag = (e, setter, currentTags) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val && !currentTags.includes(val)) {
        setter([...currentTags, val]);
        e.target.value = "";
      }
    }
  };
  
  const removeTag = (tag, currentTags, setter) => setter(currentTags.filter(t => t !== tag));
  
  const addTransactionRow = () => {
    setMultipleTransactions([
      ...multipleTransactions,
      { id: Date.now(), description: "", amount: "", date: new Date().toISOString().split("T")[0], type: "debit", category: "Other", customCategory: "", tags: [], notes: "" }
    ]);
  };
  
  const removeTransactionRow = (id) => {
    if (multipleTransactions.length <= 1) return;
    setMultipleTransactions(multipleTransactions.filter(t => t.id !== id));
  };
  
  const updateTransactionRow = (id, field, value) => {
    setMultipleTransactions(multipleTransactions.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };
  
  const handleAddMultipleTransactions = () => {
    const validTx = multipleTransactions.filter(t => t.description && t.amount && t.amount > 0);
    if (validTx.length === 0) {
      showToast("Please fill in at least one transaction with description and amount");
      return;
    }
    const newTx = validTx.map(t => ({
      id: Date.now() + Math.random() * 1000,
      date: t.date,
      description: t.description,
      amount: parseFloat(t.amount),
      type: t.type,
      category: t.category === "Other" && t.customCategory ? t.customCategory : t.category,
      customCategory: t.category === "Other" && t.customCategory ? t.customCategory : "",
      tags: t.tags || [],
      notes: t.notes || "",
      splits: [],
      incomeType: t.type === "credit" ? "Other" : "",
      isRecurring: false
    }));
    onUpload(newTx, `manual-${Date.now()}`, "Manual Entry");
    setMultipleTransactions([
      { id: Date.now(), description: "", amount: "", date: new Date().toISOString().split("T")[0], type: "debit", category: "Other", customCategory: "", tags: [], notes: "" }
    ]);
    setShowAddModal(false);
    showToast(`${newTx.length} transactions added!`);
  };
  
  const handleFile = (file) => {
    if (!file) return;
    
    // PDF handling – now only shows warning, no auto-generation
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      showToast("📄 PDF support: PDF extraction is experimental. Please use CSV for accurate results.");
      // No longer generates mock transactions.
      return;
    }
    
    // CSV handling
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      let transactions = [];
      if (file.name.endsWith('.csv')) {
        transactions = parseCSV(content);
        const fileKey = simpleHash(content.substring(0, 1000) + file.lastModified + Date.now());
        setCsvPreview({ filename: file.name, transactions, fileKey });
      }
    };
    reader.readAsText(file);
  };
  
  const handleConfirmUpload = (transactions, fileKey, filename) => {
    const existing = uploadedFiles.find(f => f.hash === fileKey);
    if (existing) {
      showToast(`⚠️ "${filename}" has already been imported on ${new Date(existing.dateUploaded).toLocaleDateString()}.`);
      return;
    }
    onUpload(transactions, fileKey, filename);
    setPreview(null);
    setCsvPreview(null);
  };
  
  const handleDrop = (e) => { e.preventDefault(); setDragover(false); handleFile(e.dataTransfer.files[0]); };
  
  return (
    <div>
      <div className="page-header">
        <div className="greeting" style={{ fontSize: 24 }}>Upload & Add Transactions</div>
        <div className="greeting-tagline">Import bank statements (CSV recommended) or add transactions manually</div>
      </div>
      
      {!preview && !csvPreview ? (
        <>
          <div className={`upload-zone ${dragover ? "dragover" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragover(true); }} onDragLeave={() => setDragover(false)} onDrop={handleDrop} onClick={() => fileRef.current.click()}>
            <div className="upload-icon">📂</div><div className="upload-title">Drop your bank statement here</div>
            <div className="upload-sub"><strong>CSV files</strong> work best. PDF support is experimental and may not extract all transactions.</div>
            <button className="btn-upload" onClick={e => { e.stopPropagation(); fileRef.current.click(); }}>Choose File</button>
            <div className="format-pills" style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}><span className="format-pill" style={{ padding: '4px 12px', borderRadius: 20, background: 'var(--mint-dim)', fontSize: 'var(--font-size-small)' }}>CSV ✓</span><span className="format-pill" style={{ padding: '4px 12px', borderRadius: 20, background: 'var(--danger-dim)', fontSize: 'var(--font-size-small)', opacity: 0.7 }}>PDF ⚠️</span></div>
            <input ref={fileRef} type="file" accept=".csv,.pdf" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
          </div>
          
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-title">✏️ Add Multiple Transactions</div>
            <button className="btn-save" onClick={() => setShowAddModal(true)} style={{ width: "100%" }}>+ Add Transaction(s)</button>
          </div>
          
          {/* Receipt scanner removed – "Coming soon" badge only */}
          <div className="card scan-card"><div className="card-title">📷 Scan a Receipt</div><div style={{ textAlign: "center" }}><div className="empty-sub" style={{ marginTop: 12 }}>📸 Receipt scanning is coming soon! For now, please add transactions manually or upload a CSV.</div></div></div>
          
          {uploadedFiles.length > 0 && (<div className="card"><div className="card-title">📋 Upload History</div><div className="upload-history">{uploadedFiles.map((f, i) => (<div key={i} className="history-item"><span>{f.name}</span><span>{new Date(f.dateUploaded).toLocaleDateString()} · {f.txCount} transactions</span></div>))}</div></div>)}
        </>
      ) : (
        <div>
          <div className="card" style={{ marginBottom: 20 }}><div className="card-title">Preview — {(preview?.filename || csvPreview?.filename)}</div><p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>Found {(preview?.transactions || csvPreview?.transactions).length} transactions. Review and confirm below.</p>
            <div className="tx-list">{(preview?.transactions || csvPreview?.transactions).map((t, i) => { const cat = t.customCategory || t.category; const catObj = DEFAULT_CATEGORIES.find(c => c.name === cat) || { color: "#CBD5E0", icon: "📦" }; return (<div key={i} className="tx-item"><div className="tx-icon" style={{ background: catObj.color + "20" }}>{catObj.icon}</div><div className="tx-info"><div className="tx-name">{t.description}</div><div className="tx-date">{t.date}</div></div><span className="cat-badge" style={{ background: catObj.color + "20", color: catObj.color }}>{cat}</span><div className={`tx-amount ${t.type}`}>{t.type === "debit" ? "-" : "+"}{formatMoney(t.amount, currency)}</div></div>);})}</div>
          </div>
          <div style={{ display: "flex", gap: 12 }}><button className="btn-cancel" onClick={() => { setPreview(null); setCsvPreview(null); }}>Cancel</button><button className="btn-save" onClick={() => handleConfirmUpload(preview?.transactions || csvPreview?.transactions, preview?.fileKey || csvPreview?.fileKey, preview?.filename || csvPreview?.filename)}>Confirm & Save →</button></div>
        </div>
      )}
      
      {showAddModal && (<div className="modal-overlay" onClick={() => setShowAddModal(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: "80vh", overflowY: "auto" }}><div className="modal-title">Add Multiple Transactions</div>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Add multiple transactions at once. All fields are editable.</p>
        {multipleTransactions.map((tx, idx) => (
          <div key={tx.id} style={{ background: "var(--bg)", padding: 12, borderRadius: 8, marginBottom: 12, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Transaction {idx + 1}</span>
              {multipleTransactions.length > 1 && (
                <button className="btn-cancel" style={{ padding: "2px 12px", fontSize: 12 }} onClick={() => removeTransactionRow(tx.id)}>✕ Remove</button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><label className="modal-label" style={{ marginTop: 0 }}>Description</label><input className="modal-input" placeholder="Description" value={tx.description} onChange={e => updateTransactionRow(tx.id, "description", e.target.value)} /></div>
              <div><label className="modal-label" style={{ marginTop: 0 }}>Amount ({CURRENCIES[currency]?.symbol || "P"})</label><input className="modal-input" type="number" step="0.01" placeholder="0.00" value={tx.amount} onChange={e => updateTransactionRow(tx.id, "amount", e.target.value)} /></div>
              <div><label className="modal-label" style={{ marginTop: 0 }}>Date</label><input className="modal-input" type="date" value={tx.date} onChange={e => updateTransactionRow(tx.id, "date", e.target.value)} /></div>
              <div><label className="modal-label" style={{ marginTop: 0 }}>Type</label><div style={{ display: "flex", gap: 4 }}><button className={`auth-tab ${tx.type === "debit" ? "active" : ""}`} style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => updateTransactionRow(tx.id, "type", "debit")}>Debit</button><button className={`auth-tab ${tx.type === "credit" ? "active" : ""}`} style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => updateTransactionRow(tx.id, "type", "credit")}>Credit</button></div></div>
              <div><label className="modal-label" style={{ marginTop: 0 }}>Category</label><select className="modal-input" value={tx.category} onChange={e => updateTransactionRow(tx.id, "category", e.target.value)} style={{ fontSize: 13 }}>{DEFAULT_CATEGORIES.map(c => (<option key={c.name} value={c.name}>{c.icon} {c.name}</option>))}</select></div>
              {tx.category === "Other" && (
                <div><label className="modal-label" style={{ marginTop: 0 }}>Custom Category</label><input className="modal-input" placeholder="e.g., Fuel, Gift" value={tx.customCategory} onChange={e => updateTransactionRow(tx.id, "customCategory", e.target.value)} /></div>
              )}
              <div style={{ gridColumn: "1/-1" }}><label className="modal-label" style={{ marginTop: 0 }}>Notes</label><input className="modal-input" placeholder="Optional notes" value={tx.notes} onChange={e => updateTransactionRow(tx.id, "notes", e.target.value)} /></div>
            </div>
          </div>
        ))}
        <button className="btn-outline" style={{ width: "100%", marginBottom: 12 }} onClick={addTransactionRow}>+ Add Another Transaction</button>
        <div className="modal-actions"><button className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button><button className="btn-save" onClick={handleAddMultipleTransactions}>Save All ({multipleTransactions.filter(t => t.description && t.amount).length} valid)</button></div>
      </div></div>)}
    </div>
  );
}

// ─── TRANSACTIONS PAGE (Phase 1: fix bulk selection) ──────────────────────
function TransactionsPage({ transactions, setTransactions, currency, showToast }) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showCalendar, setShowCalendar] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(null);
  const [showSplitModal, setShowSplitModal] = useState(null);
  const [showEditModal, setShowEditModal] = useState(null);
  const [showExplanation, setShowExplanation] = useState(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationText, setExplanationText] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState(new Set());
  const [openMenuId, setOpenMenuId] = useState(null);
  const [splitLines, setSplitLines] = useState([{ description: "", amount: "", category: "Other" }]);
  
  // Clear selection when filter changes (Phase 1 fix)
  useEffect(() => {
    setSelectedTxIds(new Set());
  }, [activeFilter]);
  
  const quickFilters = [
    { id: "all", label: "All", filter: () => true },
    { id: "month", label: "This Month", filter: (t) => new Date(t.date).getMonth() === new Date().getMonth() },
    { id: "groceries", label: "Groceries", filter: (t) => t.category === "Groceries" },
    { id: "large", label: ">P500", filter: (t) => t.amount > 500 },
    { id: "needs", label: "Needs", filter: (t) => ["Groceries","Bills","Transport","Health"].includes(t.category) },
    { id: "wants", label: "Wants", filter: (t) => ["Entertainment","Shopping","Food & Dining"].includes(t.category) }
  ];
  
  let filtered = transactions.filter(t =>
    t.description.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase()) ||
    getTxTags(t).some(tag => tag.toLowerCase().includes(search.toLowerCase()))
  );
  filtered = filtered.filter(quickFilters.find(f => f.id === activeFilter)?.filter || (() => true));
  
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getMonthTransactions = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const calendar = [];
    const firstDay = new Date(year, month, 1).getDay();
    for (let i = 0; i < firstDay; i++) calendar.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dayTxs = transactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate.getFullYear() === year && txDate.getMonth() === month && txDate.getDate() === d;
      });
      calendar.push({ day: d, transactions: dayTxs });
    }
    return calendar;
  };
  
  const handleUpdateNotesTags = (txId, notes, tags) => {
    setTransactions(transactions.map(tx => tx.id === txId ? { ...tx, notes, tags } : tx));
    setShowNoteModal(null);
    showToast("Updated");
  };
  
  const handleEditTransaction = (txId, updatedTx) => {
    setTransactions(transactions.map(tx => tx.id === txId ? updatedTx : tx));
    setShowEditModal(null);
    showToast("Transaction updated");
  };
  
  const handleSaveSplit = (tx) => {
    const totalSplit = splitLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
    if (Math.abs(totalSplit - tx.amount) > 0.01) {
      showToast(`Split total (${formatMoney(totalSplit, currency)}) does not match transaction amount (${formatMoney(tx.amount, currency)})`);
      return;
    }
    setTransactions(transactions.map(t => t.id === tx.id ? { ...t, splits: splitLines, notes: t.notes || "Split transaction" } : t));
    setShowSplitModal(null);
    setSplitLines([{ description: "", amount: "", category: "Other" }]);
    showToast("Split saved");
  };
  
  const handleBulkRecategorise = (newCategory) => {
    // Only act on selected IDs that are currently in the filtered list
    const idsToUpdate = new Set([...selectedTxIds].filter(id => filtered.some(t => t.id === id)));
    setTransactions(transactions.map(tx => idsToUpdate.has(tx.id) ? { ...tx, category: newCategory } : tx));
    setSelectedTxIds(new Set());
    setBulkMode(false);
    showToast(`Updated ${idsToUpdate.size} transactions`);
  };
  
  const handleBulkDelete = () => {
    const idsToDelete = new Set([...selectedTxIds].filter(id => filtered.some(t => t.id === id)));
    if (window.confirm(`Delete ${idsToDelete.size} transactions?`)) {
      setTransactions(transactions.filter(tx => !idsToDelete.has(tx.id)));
      setSelectedTxIds(new Set());
      setBulkMode(false);
      showToast(`Deleted ${idsToDelete.size} transactions`);
    }
  };
  
  const toggleSelect = (txId) => {
    const newSet = new Set(selectedTxIds);
    if (newSet.has(txId)) newSet.delete(txId);
    else newSet.add(txId);
    setSelectedTxIds(newSet);
  };
  
  const getExplanation = async (tx) => {
    setExplanationLoading(true);
    setExplanationText("");
    try {
      const prompt = `Explain this transaction to a user in a helpful way:
- Description: ${tx.description}
- Amount: ${formatMoney(tx.amount, currency)}
- Category: ${tx.category}
- Date: ${tx.date}

Provide a short, useful explanation of what this transaction represents in their financial picture.`;
      
      const result = await callAIService(prompt);
      let explanation = result.raw || JSON.stringify(result);
      explanation = explanation.replace(/\{[\s\S]*\}/, '').trim() || explanation;
      if (explanation.length > 500) explanation = explanation.substring(0, 500) + "...";
      setExplanationText(explanation || "This transaction appears to be a standard purchase. No specific insights available.");
    } catch (error) {
      console.error('Explanation error:', error);
      setExplanationText("This transaction appears to be a standard purchase. No specific insights available.");
    }
    setExplanationLoading(false);
  };
  
  const selectAll = () => {
    if (selectedTxIds.size === filtered.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filtered.map(t => t.id)));
    }
  };
  
  return (
    <div>
      <div className="page-header">
        <div className="greeting" style={{ fontSize: 24 }}>Transactions</div>
        <div className="greeting-tagline" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span>{transactions.length} transaction{transactions.length !== 1 ? "s" : ""} recorded</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-outline" onClick={() => setShowCalendar(!showCalendar)} style={{ padding: "6px 12px", fontSize: 12 }}>{showCalendar ? "Hide Calendar" : "📅 Calendar View"}</button>
            <button className="btn-outline" onClick={() => setBulkMode(!bulkMode)} style={{ padding: "6px 12px", fontSize: 12 }}>
              {bulkMode ? "Exit Select" : "Select Transaction(s)"}
            </button>
          </div>
        </div>
      </div>
      
      <div className="search-wrap"><span className="search-icon">🔍</span><input className="search-bar" placeholder="Search by name, category, or tag..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      
      <div className="filter-chips">{quickFilters.map(f => (<button key={f.id} className={`filter-chip ${activeFilter === f.id ? "active" : ""}`} onClick={() => setActiveFilter(f.id)}>{f.label}</button>))}</div>
      
      {showCalendar && (<div className="card" style={{ marginBottom: 20 }}><div className="card-title">📅 Calendar View - {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</div><div className="calendar-grid">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (<div key={d} className="calendar-day-header">{d}</div>))}{getMonthTransactions().map((day, idx) => (<div key={idx} className="calendar-day">{day ? (<><div className="calendar-day-num">{day.day}</div>{day.transactions.slice(0, 3).map(tx => (<div key={tx.id} className={`calendar-tx ${tx.type}`} title={`${tx.description}: ${formatMoney(tx.amount, currency)}`}>{tx.description.substring(0, 12)}</div>))}{day.transactions.length > 3 && <div style={{ fontSize: 10, color: "var(--muted)" }}>+{day.transactions.length - 3} more</div>}</>) : null}</div>))}</div></div>)}
      
      <div className="card">
        {filtered.length === 0 ? (<div className="empty-state"><div className="empty-icon">📋</div><div className="empty-text">No transactions found</div><div className="empty-sub">Try a different search or filter</div></div>) : (
          <div className="tx-list">{filtered.map((t) => { const cat = t.customCategory || t.category; const catObj = DEFAULT_CATEGORIES.find(c => c.name === cat) || { color: "#CBD5E0", icon: "📦" }; const tags = getTxTags(t); const notes = getTxNotes(t); const splits = getTxSplits(t); const isSplit = splits.length > 0; return (<div key={t.id}><div className="tx-item">{bulkMode && (<div className="tx-checkbox"><input type="checkbox" checked={selectedTxIds.has(t.id)} onChange={() => toggleSelect(t.id)} /></div>)}<div className="tx-icon" style={{ background: catObj.color + "20" }}>{catObj.icon}</div><div className="tx-content"><div className="tx-main"><div className="tx-info"><div className="tx-name"><span className="tx-name-text">{t.description}</span>{notes && <span className="tx-notes-icon" title={notes}>📝</span>}{isSplit && <span className="split-badge">split</span>}</div><div className="tx-date">{t.date}</div></div><span className="cat-badge" style={{ background: catObj.color + "20", color: catObj.color }}>{cat}</span><div className={`tx-amount ${t.type}`}>{t.type === "debit" ? "-" : "+"}{formatMoney(t.amount, currency)}</div><div className="tx-menu"><button className="tx-menu-btn" onClick={() => setOpenMenuId(openMenuId === t.id ? null : t.id)}>⋯</button>{openMenuId === t.id && (<div className="tx-dropdown"><button onClick={() => { setShowEditModal(t); setOpenMenuId(null); }}>✏️ Edit</button><button onClick={() => { setShowNoteModal({ txId: t.id, notes, tags }); setOpenMenuId(null); }}>📝 Add Note</button><button onClick={() => { setShowSplitModal(t); setOpenMenuId(null); }}>🔀 Split Transaction</button><button onClick={() => { setShowExplanation(t); getExplanation(t); setOpenMenuId(null); }}>🤖 Explain Transaction</button></div>)}</div></div>{tags.length > 0 && (<div className="tx-tags">{tags.map(tag => (<span key={tag} className="tx-tag">#{tag}</span>))}</div>)}</div></div>{isSplit && splits.map((split, idx) => { const splitCat = DEFAULT_CATEGORIES.find(c => c.name === split.category) || { color: "#CBD5E0", icon: "📦" }; return (<div key={idx} className="split-row"><div className="split-details"><span>{splitCat.icon} {split.description}</span><span>{formatMoney(split.amount, currency)}</span><span style={{ color: splitCat.color }}>{split.category}</span></div></div>); })}</div>);})}</div>
        )}
      </div>
      
      {bulkMode && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-outline" style={{ fontSize: 12 }} onClick={selectAll}>
            {selectedTxIds.size === filtered.length ? "Deselect All" : "Select All"}
          </button>
        </div>
      )}
      
      {bulkMode && selectedTxIds.size > 0 && (<div className="bulk-bar"><span className="selected-count">{selectedTxIds.size} selected</span><div className="bulk-actions"><button className="bulk-recategorise" onClick={() => { const cat = prompt("Enter new category name"); if (cat) handleBulkRecategorise(cat); }}>Recategorise</button><button className="bulk-delete" onClick={handleBulkDelete}>Delete</button><button className="bulk-cancel" onClick={() => { setBulkMode(false); setSelectedTxIds(new Set()); }}>Cancel</button></div></div>)}
      
      {showNoteModal && (<div className="modal-overlay" onClick={() => setShowNoteModal(null)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-title">Add Note & Tags</div><label className="modal-label">Notes</label><textarea className="modal-input" rows="3" placeholder="Add a note..." defaultValue={showNoteModal.notes} onChange={e => showNoteModal.notes = e.target.value} /><label className="modal-label">Tags</label><div className="tags-input" id="note-tags-container">{showNoteModal.tags.map(tag => (<span key={tag} className="tag-chip">{tag}<button onClick={() => { showNoteModal.tags = showNoteModal.tags.filter(t => t !== tag); document.getElementById("note-tags-container").innerHTML = showNoteModal.tags.map(t => `<span class="tag-chip">${t}<button>✕</button></span>`).join(""); }}>✕</button></span>))}<input className="tags-input-field" placeholder="Type tag and press Enter" id="note-tag-input" onKeyDown={(e) => { if (e.key === "Enter" || e.key === "," || e.key === " ") { e.preventDefault(); const val = e.target.value.trim(); if (val && !showNoteModal.tags.includes(val)) { showNoteModal.tags.push(val); e.target.value = ""; document.getElementById("note-tags-container").innerHTML = showNoteModal.tags.map(t => `<span class="tag-chip">${t}<button>✕</button></span>`).join("") + '<input class="tags-input-field" placeholder="Type tag and press Enter" id="note-tag-input">'; const newInput = document.getElementById("note-tag-input"); if (newInput) newInput.focus(); } } }} /></div><div className="modal-actions"><button className="btn-cancel" onClick={() => setShowNoteModal(null)}>Cancel</button><button className="btn-save" onClick={() => { const notes = document.querySelector(".modal textarea").value; const tagChips = document.querySelectorAll("#note-tags-container .tag-chip"); const tags = Array.from(tagChips).map(chip => chip.childNodes[0].textContent); handleUpdateNotesTags(showNoteModal.txId, notes, tags); }}>Save</button></div></div></div>)}
      
      {showSplitModal && (<div className="modal-overlay" onClick={() => setShowSplitModal(null)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}><div className="modal-title">Split Transaction</div><div style={{ background: "var(--bg)", padding: 12, borderRadius: 8, marginBottom: 16 }}><div>Original: {showSplitModal.description}</div><div style={{ fontWeight: 700 }}>Amount: {formatMoney(showSplitModal.amount, currency)}</div></div>{splitLines.map((line, idx) => (<div key={idx} className="split-line"><div className="split-header"><span className="split-title">Split {idx + 1}</span>{splitLines.length > 1 && <button className="split-remove" onClick={() => setSplitLines(splitLines.filter((_, i) => i !== idx))}>✕</button>}</div><div className="split-fields"><input placeholder="Description" value={line.description} onChange={e => { const newLines = [...splitLines]; newLines[idx].description = e.target.value; setSplitLines(newLines); }} /><input type="number" step="0.01" placeholder="Amount" value={line.amount} onChange={e => { const newLines = [...splitLines]; newLines[idx].amount = e.target.value; setSplitLines(newLines); }} /><select value={line.category} onChange={e => { const newLines = [...splitLines]; newLines[idx].category = e.target.value; setSplitLines(newLines); }}>{DEFAULT_CATEGORIES.map(c => (<option key={c.name} value={c.name}>{c.icon} {c.name}</option>))}</select></div></div>))}<button className="btn-outline" style={{ width: "100%", marginBottom: 12 }} onClick={() => setSplitLines([...splitLines, { description: "", amount: "", category: "Other" }])}>+ Add Split Line</button><div className="split-total"><span>Total allocated:</span><span>{formatMoney(splitLines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0), currency)}</span></div><div className="split-total"><span>Unallocated:</span><span className="split-remainder">{formatMoney(showSplitModal.amount - splitLines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0), currency)}</span></div><div className="modal-actions"><button className="btn-cancel" onClick={() => setShowSplitModal(null)}>Cancel</button><button className="btn-save" onClick={() => handleSaveSplit(showSplitModal)}>Save Split</button></div></div></div>)}
      
      {showEditModal && (<div className="modal-overlay" onClick={() => setShowEditModal(null)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}><div className="modal-title">Edit Transaction</div><label className="modal-label">Description</label><input className="modal-input" placeholder="Description" defaultValue={showEditModal.description} id="edit-desc" /><label className="modal-label">Amount ({CURRENCIES[currency]?.symbol || "P"})</label><input className="modal-input" type="number" step="0.01" defaultValue={showEditModal.amount} id="edit-amount" /><label className="modal-label">Date</label><input className="modal-input" type="date" defaultValue={showEditModal.date} id="edit-date" /><label className="modal-label">Type</label><div style={{ display: "flex", gap: 8, marginBottom: 16 }}><button className={`auth-tab ${showEditModal.type === "debit" ? "active" : ""}`} id="edit-type-debit">Debit</button><button className={`auth-tab ${showEditModal.type === "credit" ? "active" : ""}`} id="edit-type-credit">Credit</button></div><label className="modal-label">Category</label><div className="category-grid" id="edit-category-grid">{DEFAULT_CATEGORIES.map(cat => (<button key={cat.name} className={`category-pill ${showEditModal.category === cat.name ? "active" : ""}`} data-cat={cat.name}><span>{cat.icon}</span> {cat.name}</button>))}</div>{showEditModal.category === "Other" && (<><label className="modal-label">Custom Category Name</label><input className="modal-input" placeholder="e.g., Fuel, Gift" defaultValue={showEditModal.customCategory || ""} id="edit-custom-cat" /></>)}<div className="modal-actions"><button className="btn-cancel" onClick={() => setShowEditModal(null)}>Cancel</button><button className="btn-save" onClick={() => { const newDesc = document.getElementById("edit-desc").value; const newAmount = parseFloat(document.getElementById("edit-amount").value); const newDate = document.getElementById("edit-date").value; let newType = showEditModal.type; if (document.getElementById("edit-type-debit").classList.contains("active")) newType = "debit"; if (document.getElementById("edit-type-credit").classList.contains("active")) newType = "credit"; const activeCat = Array.from(document.querySelectorAll("#edit-category-grid .category-pill.active"))[0]; const newCategory = activeCat ? activeCat.getAttribute("data-cat") : "Other"; const newCustomCat = document.getElementById("edit-custom-cat")?.value || ""; if (!newDesc || !newAmount) { showToast("Please fill in all fields"); return; } handleEditTransaction(showEditModal.id, { ...showEditModal, description: newDesc, amount: newAmount, date: newDate, type: newType, category: newCategory, customCategory: newCustomCat }); }}>Save Changes</button></div></div></div>)}
      
      {showExplanation && (<div className="modal-overlay" onClick={() => setShowExplanation(null)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}><div className="modal-title">🤖 AI Transaction Explanation</div><div style={{ background: "var(--bg)", padding: 16, borderRadius: 12, marginBottom: 16 }}><div><strong>Transaction:</strong> {showExplanation.description}</div><div><strong>Amount:</strong> {formatMoney(showExplanation.amount, currency)}</div><div><strong>Category:</strong> {showExplanation.category}</div></div><div className="tx-explanation"><div className="tx-explanation-label">AI Analysis</div>{explanationLoading ? (<div className="ai-report-loading"><div className="spinner" /><div style={{ marginTop: 12 }}>Analyzing transaction...</div></div>) : (<div className="tx-explanation-text">{explanationText}</div>)}</div><div className="modal-actions"><button className="btn-cancel" onClick={() => setShowExplanation(null)}>Close</button></div></div></div>)}
    </div>
  );
}

// ─── INSIGHTS PAGE (unchanged) ──────────────────────────────────────────────
function InsightsPage({ transactions, currency }) {
  const totalSpent = transactions.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const totalCredit = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const savings = totalCredit - totalSpent;
  const catMap = {};
  transactions.filter(t => t.type === "debit").forEach(t => {
    const cat = t.customCategory || t.category;
    catMap[cat] = (catMap[cat] || 0) + t.amount;
  });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  
  const detectSubscriptions = () => {
    const debitTx = transactions.filter(t => t.type === "debit");
    const groups = new Map();
    debitTx.forEach(tx => { const key = tx.description.trim().toLowerCase(); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(tx); });
    const subscriptions = [];
    for (const [desc, txList] of groups.entries()) {
      if (txList.length >= 2) {
        const amounts = txList.map(t => t.amount);
        const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const dates = txList.map(t => new Date(t.date)).sort((a, b) => a - b);
        let frequencyLabel = "Irregular";
        let multiplier = 12;
        if (dates.length >= 2) {
          let totalGap = 0;
          for (let i = 1; i < dates.length; i++) totalGap += (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24);
          const avgGap = totalGap / (dates.length - 1);
          if (avgGap >= 25 && avgGap <= 35) { frequencyLabel = "Monthly"; multiplier = 12; }
          else if (avgGap >= 6 && avgGap <= 8) { frequencyLabel = "Weekly"; multiplier = 52; }
        }
        const annualCost = avgAmount * multiplier;
        subscriptions.push({ name: txList[0].description, frequency: frequencyLabel, monthlyCost: avgAmount, annualCost, occurrences: txList.length });
      }
    }
    return subscriptions.sort((a, b) => b.annualCost - a.annualCost).slice(0, 10);
  };
  
  const subscriptions = detectSubscriptions();
  const totalAnnualSubs = subscriptions.reduce((sum, s) => sum + s.annualCost, 0);
  
  const detectAnomaly = () => {
    const debitTx = transactions.filter(t => t.type === "debit");
    if (debitTx.length < 6) return { hasData: false, message: "Add more transactions to detect anomalies." };
    const weeks = new Map();
    debitTx.forEach(tx => { const weekKey = `${new Date(tx.date).getFullYear()}-W${getWeekNumber(tx.date)}`; if (!weeks.has(weekKey)) weeks.set(weekKey, []); weeks.get(weekKey).push(tx.amount); });
    const weekTotals = Array.from(weeks.entries()).map(([week, amounts]) => ({ week, total: amounts.reduce((a, b) => a + b, 0), date: new Date(week.split("-W")[0], 0, 1) })).sort((a, b) => a.date - b.date);
    if (weekTotals.length < 3) return { hasData: false, message: "Add more transactions to detect anomalies." };
    const lastWeek = weekTotals[weekTotals.length - 1];
    const prevWeeks = weekTotals.slice(0, -1);
    const avgPrev = prevWeeks.reduce((sum, w) => sum + w.total, 0) / prevWeeks.length;
    if (lastWeek.total > avgPrev * 1.5) { const percentIncrease = ((lastWeek.total - avgPrev) / avgPrev) * 100; return { hasData: true, isAnomaly: true, message: `⚠️ You spent ${percentIncrease.toFixed(0)}% more than usual this week (${formatMoney(lastWeek.total, currency)} vs your avg ${formatMoney(avgPrev, currency)}).` }; }
    else { return { hasData: true, isAnomaly: false, message: `✅ Your spending this week (${formatMoney(lastWeek.total, currency)}) is within your normal range (avg ${formatMoney(avgPrev, currency)}).` }; }
  };
  
  const getTimingInsights = () => {
    const debitTx = transactions.filter(t => t.type === "debit");
    if (debitTx.length === 0) return null;
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    debitTx.forEach(tx => { const day = new Date(tx.date).getDay(); dayTotals[day] += tx.amount; });
    const maxDayIndex = dayTotals.indexOf(Math.max(...dayTotals));
    const highestDay = getDayName(maxDayIndex);
    const dayOfMonthTotals = {};
    debitTx.forEach(tx => { const dayNum = new Date(tx.date).getDate(); dayOfMonthTotals[dayNum] = (dayOfMonthTotals[dayNum] || 0) + tx.amount; });
    const topDays = Object.entries(dayOfMonthTotals).sort((a, b) => b[1] - a[1]).slice(0, 3).map(d => parseInt(d[0]));
    let earlyMonthInsight = null, lateMonthInsight = null;
    if (topDays.some(d => d >= 1 && d <= 5)) earlyMonthInsight = "You tend to overspend early in the month — common after payday.";
    if (topDays.some(d => d >= 25 && d <= 31)) lateMonthInsight = "You tend to overspend at month end.";
    const maxDayTotal = Math.max(...dayTotals);
    const barData = dayTotals.map((total, idx) => ({ label: getDayName(idx).slice(0, 3), value: total, percent: maxDayTotal > 0 ? (total / maxDayTotal) * 100 : 0 }));
    return { barData, highestDay, earlyMonthInsight, lateMonthInsight };
  };
  
  const anomaly = detectAnomaly();
  const timing = getTimingInsights();
  
  return (<div><div className="page-header"><div className="greeting" style={{ fontSize: 24 }}>Insights</div><div className="greeting-tagline">Patterns in your spending</div></div>{transactions.length > 0 && (<div className="insight-card"><div className="insight-label">Key Insight</div><div className="insight-text">{topCats[0] ? `Your biggest spend is ${topCats[0][0]} at ${formatMoney(topCats[0][1], currency)}. ${topCats[0][1] / totalSpent > 0.4 ? "Consider reviewing this category." : "You're keeping things balanced."}` : "Keep uploading statements to unlock insights."}</div></div>)}
  
  {transactions.length > 0 && (
    <div className="insight-card" style={{ background: savings > 0 ? "linear-gradient(135deg, #00C89620, var(--navy))" : "linear-gradient(135deg, var(--danger-dim), var(--navy))" }}>
      <div className="insight-label">{savings > 0 ? "💰 Savings" : "📊 Spending"}</div>
      <div className="insight-text">
        {savings > 0 
          ? `You've saved ${formatMoney(savings, currency)} this period. At this rate, you'd save ${formatMoney(savings * 12, currency)} in a year! 🎉`
          : `Your spending (${formatMoney(totalSpent, currency)}) exceeds your income (${formatMoney(totalCredit, currency)}). Consider reviewing your expenses.`
        }
      </div>
    </div>
  )}
  
  <div className="dashboard-grid"><div className="card"><div className="card-title">Top Categories</div>{topCats.length === 0 ? (<div className="empty-state"><div className="empty-icon">📊</div><div className="empty-text">Upload your first statement to get started</div></div>) : topCats.map(([name, val], i) => { const cat = DEFAULT_CATEGORIES.find(c => c.name === name) || { color: "#CBD5E0", icon: "📦" }; const pct = totalSpent > 0 ? (val / totalSpent) * 100 : 0; return (<div key={i} style={{ marginBottom: 16 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{cat.icon} {name}</span><span style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 14, color: "var(--stat-value)" }}>{formatMoney(val, currency)}</span></div><div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: cat.color }} /></div></div>); })}</div><div className="card"><div className="card-title">💰 Recurring Subscriptions</div>{subscriptions.length === 0 ? (<div className="empty-state"><div className="empty-icon">🔄</div><div className="empty-text">No recurring transactions detected yet</div><div className="empty-sub">Add at least 2 transactions with the same description</div></div>) : (<>{subscriptions.map((s, i) => (<div key={i} className="sub-item"><div><div className="sub-name">{s.name}</div><div className="sub-freq">{s.frequency} · {s.occurrences} occurrences</div></div><div><div className="sub-amount" style={{ color: "var(--mint)" }}>{formatMoney(s.monthlyCost, currency)}/mo</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{formatMoney(s.annualCost, currency)}/year</div></div></div>))}<div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)", textAlign: "right" }}><div className="stat-label">Estimated annual subscription spend</div><div className="stat-value" style={{ fontSize: 20 }}>{formatMoney(totalAnnualSubs, currency)}</div></div></>)}</div></div><div className="card" style={{ marginTop: 20 }}><div className="card-title">📈 Spending Patterns</div><div style={{ marginBottom: 24 }}><div style={{ fontWeight: 600, marginBottom: 12, color: "var(--text)" }}>Anomaly Detection</div><div className="insight-card" style={{ background: anomaly.isAnomaly ? "linear-gradient(135deg, #FF475720, var(--navy))" : "linear-gradient(135deg, var(--navy) 0%, var(--navy-deep) 100%)", marginBottom: 0 }}><div className="insight-text" style={{ maxWidth: "100%" }}>{anomaly.message}</div></div></div>{timing && (<div><div style={{ fontWeight: 600, marginBottom: 12, color: "var(--text)" }}>Timing Insights</div><div className="timing-bar-chart">{timing.barData.map((day, idx) => (<div key={idx} className="timing-bar-row"><div className="timing-bar-label">{day.label}</div><div className="timing-bar-bg"><div className="timing-bar-fill" style={{ width: `${day.percent}%` }}>{day.percent > 20 && formatMoney(day.value, currency)}</div></div></div>))}</div><div className="whatif-output" style={{ marginTop: 16 }}><div className="whatif-output-text">You spend most on <strong>{timing.highestDay}</strong>.</div>{timing.earlyMonthInsight && <div className="whatif-output-text" style={{ marginTop: 8, color: "#FFA500" }}>{timing.earlyMonthInsight}</div>}{timing.lateMonthInsight && <div className="whatif-output-text" style={{ marginTop: 4, color: "#FFA500" }}>{timing.lateMonthInsight}</div>}</div></div>)}</div></div>);
}

// ─── GOALS PAGE (unchanged) ──────────────────────────────────────────────────
function GoalsPage({ goals, onAdd, onContribute, currency, showToast }) {
  const [showModal, setShowModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(null);
  const [contributeAmount, setContributeAmount] = useState("");
  const [form, setForm] = useState({ name: "", target: "", deadline: "", emoji: "🎯" });
  const emojis = ["🎯","✈️","🏠","🚗","📱","💍","🎓","💼","🏋️","🎸"];
  
  const handleSave = () => { if (!form.name || !form.target) return; onAdd({ ...form, target: parseFloat(form.target), saved: 0, id: Date.now() }); setShowModal(false); setForm({ name: "", target: "", deadline: "", emoji: "🎯" }); };
  
  const handleContribute = (goalId) => {
    const amount = parseFloat(contributeAmount);
    if (!amount || amount <= 0) { showToast("Please enter a valid amount"); return; }
    onContribute(goalId, amount);
    setShowContributeModal(null);
    setContributeAmount("");
    showToast(`💰 Added ${formatMoney(amount, currency)} to goal!`);
  };
  
  return (<div><div className="page-header"><div className="greeting" style={{ fontSize: 24 }}>Goals</div><div className="greeting-tagline">Track what you're saving toward</div></div><div className="goals-grid">{goals.length === 0 && (<div style={{ gridColumn: "1/-1" }}><div className="empty-state" style={{ padding: "60px 20px" }}><div className="empty-icon">🎯</div><div className="empty-text">No goals yet. Add one.</div><div className="empty-sub">Set a saving target and track your progress</div></div></div>)}{goals.map((g) => { const pct = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0; const weekly = g.deadline ? Math.max(0, (g.target - g.saved) / Math.max(1, Math.ceil((new Date(g.deadline) - new Date()) / (7 * 86400000)))) : null; return (<div key={g.id} className="goal-card"><div className="goal-header"><div className="goal-name">{g.name}</div><div className="goal-emoji">{g.emoji}</div></div><div className="goal-amounts"><div className="goal-saved">{formatMoney(g.saved, currency)}</div><div className="goal-target">of {formatMoney(g.target, currency)}</div></div><div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div><div className="goal-meta">{pct.toFixed(0)}% complete{weekly !== null && ` · Save ${formatMoney(weekly, currency)}/week`}{g.deadline && ` · Due ${g.deadline}`}</div><button className="btn-outline" style={{ marginTop: 12, width: "100%" }} onClick={() => setShowContributeModal(g)}>+ Add to Goal</button></div>); })}<button className="add-goal-card" onClick={() => setShowModal(true)}><div className="add-goal-icon">+</div><div className="add-goal-text">Add a goal</div></button></div>
  {showModal && (<div className="modal-overlay" onClick={() => setShowModal(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-title">New Saving Goal</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>{emojis.map(e => (<button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))} style={{ fontSize: 22, background: form.emoji === e ? "var(--mint-dim)" : "none", border: `1px solid ${form.emoji === e ? "var(--mint)" : "var(--border)"}`, borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}>{e}</button>))}</div><label className="modal-label">Goal Name</label><input className="modal-input" placeholder="e.g. Trip to Cape Town" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /><label className="modal-label">Target Amount ({CURRENCIES[currency]?.symbol || "P"})</label><input className="modal-input" type="number" placeholder="5000" step="0.01" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} /><label className="modal-label">Deadline (optional)</label><input className="modal-input" type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} /><div className="modal-actions"><button className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button><button className="btn-save" onClick={handleSave}>Save Goal</button></div></div></div>)}
  {showContributeModal && (<div className="modal-overlay" onClick={() => setShowContributeModal(null)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-title">Add to {showContributeModal.name}</div><label className="modal-label">Amount to contribute ({CURRENCIES[currency]?.symbol || "P"})</label><input className="modal-input" type="number" step="0.01" placeholder="0.00" value={contributeAmount} onChange={e => setContributeAmount(e.target.value)} /><div className="modal-actions"><button className="btn-cancel" onClick={() => setShowContributeModal(null)}>Cancel</button><button className="btn-save" onClick={() => handleContribute(showContributeModal.id)}>Contribute</button></div></div></div>)}</div>);
}

// ─── SETTINGS PAGE (unchanged) ──────────────────────────────────────────────
function SettingsPage({ user, onLogout, onClearData, currency, onCurrencyChange, theme, onThemeChange, textSize, onTextSizeChange, transactions, goals, incomes, budgets, customScenarios, onRestoreData, showToast }) {
  const [currencyConfirmShown, setCurrencyConfirmShown] = useState(false);
  const handleCurrencyChange = (newCurrency) => { if (!currencyConfirmShown) { showToast(`✅ Currency selected: ${CURRENCIES[newCurrency].name}. All amounts will be treated and registered as ${CURRENCIES[newCurrency].symbol}.`); setCurrencyConfirmShown(true); } onCurrencyChange(newCurrency); };
  
  const handleBackup = () => {
    const backupData = { transactions, goals, incomes, budgets, customScenarios, currency, theme, textSize, version: "1.0", exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spendsight_backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup created!");
  };
  
  const handleRestore = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        onRestoreData(data);
        showToast("Data restored successfully!");
      } catch (err) { showToast("Invalid backup file"); }
    };
    reader.readAsText(file);
  };
  
  return (<div><div className="page-header"><div className="greeting" style={{ fontSize: 24 }}>Settings</div><div className="greeting-tagline">Manage your SpendSight preferences</div></div>
    <div className="settings-section"><div className="settings-title">Account</div><div className="settings-card"><div className="settings-row"><div><div className="settings-row-label">Name</div><div className="settings-row-sub">{user.name}</div></div></div><div className="settings-row"><div><div className="settings-row-label">Email</div><div className="settings-row-sub">{user.email}</div></div></div></div></div>
    <div className="settings-section"><div className="settings-title">Preferences</div><div className="settings-card"><div className="settings-row"><div><div className="settings-row-label">Currency</div><div className="settings-row-sub">All amounts stored and displayed in your chosen currency</div></div><select className="settings-select" value={currency} onChange={e => handleCurrencyChange(e.target.value)}>{Object.entries(CURRENCIES).map(([code, c]) => (<option key={code} value={code}>{c.name}</option>))}</select></div><div className="settings-row"><div><div className="settings-row-label">Text Size</div><div className="settings-row-sub">Adjust font size throughout the app</div></div><div className="text-size-selector"><button className={`size-btn ${textSize === "small" ? "active" : ""}`} onClick={() => onTextSizeChange("small")}>A⁻</button><button className={`size-btn ${textSize === "normal" ? "active" : ""}`} onClick={() => onTextSizeChange("normal")}>A</button><button className={`size-btn ${textSize === "large" ? "active" : ""}`} onClick={() => onTextSizeChange("large")}>A⁺</button><button className={`size-btn ${textSize === "xlarge" ? "active" : ""}`} onClick={() => onTextSizeChange("xlarge")}>A⁺⁺</button></div></div><div className="settings-row"><div><div className="settings-row-label">Theme</div><div className="settings-row-sub">Choose your display preference</div></div><div className="theme-toggle"><button className={`theme-toggle-btn ${theme === "light" ? "active" : ""}`} onClick={() => onThemeChange("light")}>☀️ Light</button><button className={`theme-toggle-btn ${theme === "system" ? "active" : ""}`} onClick={() => onThemeChange("system")}>Auto</button><button className={`theme-toggle-btn ${theme === "dark" ? "active" : ""}`} onClick={() => onThemeChange("dark")}>🌙 Dark</button></div></div></div></div>
    <div className="settings-section"><div className="settings-title">Data</div><div className="settings-card"><div className="settings-row"><div><div className="settings-row-label">Backup Data</div><div className="settings-row-sub">Download all your data as JSON</div></div><button className="btn-outline" onClick={handleBackup}>Backup</button></div><div className="settings-row"><div><div className="settings-row-label">Restore Data</div><div className="settings-row-sub">Upload a backup file to restore</div></div><input type="file" accept=".json" onChange={handleRestore} style={{ display: "none" }} id="restore-input" /><button className="btn-outline" onClick={() => document.getElementById("restore-input").click()}>Restore</button></div><div className="settings-row"><div><div className="settings-row-label">Export CSV</div><div className="settings-row-sub">Download all transactions as CSV</div></div><button className="btn-outline" onClick={() => { const csv = ["Date,Description,Amount,Type,Category,Tags,Notes", ...transactions.map(t => `${t.date},${t.description},${t.amount},${t.type},${t.customCategory || t.category},${(t.tags || []).join(";")},${t.notes || ""}`)].join("\n"); const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `spendsight_export_${new Date().toISOString().split("T")[0]}.csv`; a.click(); URL.revokeObjectURL(url); showToast("Export complete!"); }}>Export CSV</button></div><div className="settings-row"><div><div className="settings-row-label">Clear All Data</div><div className="settings-row-sub">Permanently delete all transactions, goals, and budgets</div></div><button className="btn-danger" onClick={onClearData}>Clear Data</button></div></div></div>
    <div className="settings-section"><div className="settings-card"><div className="settings-row"><div><div className="settings-row-label">Sign Out</div></div><button className="btn-cancel" style={{ cursor: "pointer" }} onClick={onLogout}>Sign Out</button></div></div></div></div>);
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function SpendSight() {
  const [user, setUser] = useLocalStorage("ss_user", null);
  const [transactions, setTransactions] = useLocalStorage("ss_transactions", []);
  const [uploadedFiles, setUploadedFiles] = useLocalStorage("ss_uploaded_files", []);
  const [goals, setGoals] = useLocalStorage("ss_goals", []);
  const [incomes, setIncomes] = useLocalStorage("ss_incomes", []);
  const [budgets, setBudgets] = useLocalStorage("ss_budgets", []);
  const [customScenarios, setCustomScenarios] = useLocalStorage("ss_custom_scenarios", []);
  const [currency, setCurrency] = useLocalStorage("ss_currency", null);
  const [theme, setTheme] = useLocalStorage("ss_theme", "system");
  const [textSize, setTextSize] = useLocalStorage("ss_text_size", "normal");
  const [page, setPage] = useState("dashboard");
  const [authTab, setAuthTab] = useState("login");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const lastActivityRef = useRef(Date.now());
  
  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem("install_dismissed");
      if (!dismissed && !window.matchMedia("(display-mode: standalone)").matches) {
        setShowInstallPrompt(true);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  
  const handleInstall = () => {
    if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.then(() => setDeferredPrompt(null)); }
    setShowInstallPrompt(false);
    localStorage.setItem("install_dismissed", "true");
  };
  
  const dismissInstall = () => { setShowInstallPrompt(false); localStorage.setItem("install_dismissed", "true"); };
  
  // Session timeout
  useEffect(() => {
    if (!user) return;
    const resetTimer = () => { lastActivityRef.current = Date.now(); if (sessionExpired) setSessionExpired(false); };
    const events = ["mousemove", "keydown", "touchstart", "click"];
    events.forEach(event => document.addEventListener(event, resetTimer));
    const interval = setInterval(() => { if (Date.now() - lastActivityRef.current > 15 * 60 * 1000 && !sessionExpired) setSessionExpired(true); }, 60000);
    return () => { events.forEach(event => document.removeEventListener(event, resetTimer)); clearInterval(interval); };
  }, [user, sessionExpired]);
  
  // Apply text size
  useEffect(() => { const html = document.documentElement; html.classList.remove("text-small", "text-normal", "text-large", "text-xlarge"); html.classList.add(`text-${textSize}`); }, [textSize]);
  useEffect(() => { const html = document.documentElement; if (theme === "dark") html.classList.add("dark"); else if (theme === "light") html.classList.remove("dark"); else { const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches; if (prefersDark) html.classList.add("dark"); else html.classList.remove("dark"); } }, [theme]);
  useEffect(() => { if (theme !== "system") return; const mq = window.matchMedia("(prefers-color-scheme: dark)"); const handler = (e) => { if (e.matches) document.documentElement.classList.add("dark"); else document.documentElement.classList.remove("dark"); }; mq.addEventListener("change", handler); return () => mq.removeEventListener("change", handler); }, [theme]);
  
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };
  const handleAuth = () => { if (!form.email || !form.password) return; if (authTab === "signup" && !form.name) return; const name = authTab === "signup" ? form.name : (form.name || form.email.split("@")[0]); setUser({ name, email: form.email, income: 0 }); showToast(`Welcome${authTab === "signup" ? "" : " back"}, ${name}!`); if (!currency) showToast("💰 Please select your preferred currency from the banner above."); };
  
  const handleUpload = (newTx, fileHash, filename) => {
    const existing = uploadedFiles.find(f => f.hash === fileHash);
    if (existing) { showToast(`⚠️ "${filename}" has already been imported.`); return; }
    setTransactions(t => [...t, ...newTx]);
    setUploadedFiles(f => [...f, { name: filename, hash: fileHash, dateUploaded: new Date().toISOString(), txCount: newTx.length }]);
    setPage("transactions");
    showToast(`${newTx.length} transactions imported from ${filename}!`);
  };
  
  const handleAddIncome = (income) => { setIncomes(i => [...i, income]); };
  const handleDeleteIncome = (id) => { setIncomes(i => i.filter(inc => inc.id !== id)); showToast("Income entry removed."); };
  const handleUpdateBudgets = (newBudgets) => { setBudgets(newBudgets); };
  const handleAddScenario = (scenario) => { setCustomScenarios(s => [...s, scenario]); showToast("Custom scenario added!"); };
  const handleDeleteScenario = (id) => { setCustomScenarios(s => s.filter(sc => sc.id !== id)); showToast("Scenario removed."); };
  
  const handleContributeToGoal = (goalId, amount) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    const newSaved = goal.saved + amount;
    setGoals(goals.map(g => g.id === goalId ? { ...g, saved: newSaved } : g));
    const contributionTx = {
      id: Date.now(),
      date: new Date().toISOString().split("T")[0],
      description: `Goal contribution: ${goal.name}`,
      amount: amount,
      type: "debit",
      category: "Savings",
      customCategory: "",
      tags: ["goal", "savings"],
      notes: `Contributed to ${goal.name}`,
      splits: [],
      incomeType: "",
      isRecurring: false
    };
    setTransactions(t => [contributionTx, ...t]);
    showToast(`🎯 Added ${formatMoney(amount, currency)} to ${goal.name}`);
  };
  
  const handleRestoreData = (data) => {
    if (data.transactions) setTransactions(data.transactions);
    if (data.goals) setGoals(data.goals);
    if (data.incomes) setIncomes(data.incomes);
    if (data.budgets) setBudgets(data.budgets);
    if (data.customScenarios) setCustomScenarios(data.customScenarios);
    if (data.currency) setCurrency(data.currency);
    if (data.theme) setTheme(data.theme);
    if (data.textSize) setTextSize(data.textSize);
  };
  
  const handleClearData = () => {
    if (window.confirm("⚠️ Delete ALL data? This cannot be undone.")) {
      setTransactions([]); setGoals([]); setUploadedFiles([]); setIncomes([]); setBudgets([]); setCustomScenarios([]);
      showToast("All data cleared.");
    }
  };
  
  const navItems = [
    { id: "dashboard", icon: "🏠", label: "Dashboard" },
    { id: "upload", icon: "📂", label: "Upload" },
    { id: "transactions", icon: "📋", label: "Transactions" },
    { id: "insights", icon: "📊", label: "Insights" },
    { id: "whatif", icon: "🧮", label: "What-If" },
    { id: "goals", icon: "🎯", label: "Goals" },
    { id: "contact", icon: "📞", label: "Contact" },
    { id: "settings", icon: "⚙️", label: "Settings" }
  ];
  
  if (!user) { return (<><style>{css}</style><div className="auth-screen"><div className="auth-card"><div className="auth-logo"><span className="auth-logo-text">Spend<span style={{ color: "#00C896" }}>Sight</span></span></div><div className="auth-tagline">Your money, your clarity.</div><div className="auth-tabs"><button className={`auth-tab ${authTab === "login" ? "active" : ""}`} onClick={() => setAuthTab("login")}>Sign In</button><button className={`auth-tab ${authTab === "signup" ? "active" : ""}`} onClick={() => setAuthTab("signup")}>Sign Up</button></div>{authTab === "signup" && (<div className="form-group"><label className="form-label">Your Name</label><input className="form-input" placeholder="e.g. El" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>)}<div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div><div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div><button className="btn-primary" onClick={handleAuth}>{authTab === "login" ? "Sign In →" : "Create Account →"}</button></div></div>{toast && <div className="toast">{toast}</div>}</>); }
  if (!currency) { return (<><style>{css}</style><div className="app"><main className="main" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}><div className="card" style={{ maxWidth: 500, textAlign: "center" }}><div className="card-title" style={{ fontSize: 24, marginBottom: 16 }}>🌍 Welcome to SpendSight</div><p style={{ marginBottom: 24, color: "var(--muted)" }}>Please select your preferred currency first. All your transactions and goals will be stored in this currency.</p><select className="currency-selector" style={{ padding: 12, fontSize: 16, width: "100%" }} onChange={(e) => { setCurrency(e.target.value); showToast(`✅ Currency selected: ${CURRENCIES[e.target.value].name}. All amounts will be treated and registered as ${CURRENCIES[e.target.value].symbol}.`); }} defaultValue=""><option value="" disabled>Select your currency...</option>{Object.entries(CURRENCIES).map(([code, c]) => (<option key={code} value={code}>{c.name}</option>))}</select></div></main></div>{toast && <div className="toast">{toast}</div>}</>); }
  if (sessionExpired) { return (<><style>{css}</style><div className="session-overlay"><div className="session-card"><div className="session-logo">Spend<span style={{ color: "#00C896" }}>Sight</span></div><div className="session-message">Your session has timed out for security.</div><button className="session-btn" onClick={() => { setSessionExpired(false); lastActivityRef.current = Date.now(); }}>Resume Session</button></div></div></>); }
  
  return (<><style>{css}</style><div className="app">{showInstallPrompt && (<div className="install-banner"><p>📲 Install SpendSight on your device for quick access and offline use.</p><div><button className="install-btn" onClick={handleInstall}>Install</button><button className="dismiss-btn" onClick={dismissInstall}>Not now</button></div></div>)}<div className={`mobile-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} /><div className={`sidebar ${sidebarOpen ? "open" : ""}`}><div className="sidebar-logo"><div className="logo-text">Spend<span className="logo-dot">Sight</span></div></div><nav className="sidebar-nav">{navItems.map(n => (<button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => { setPage(n.id); setSidebarOpen(false); }}><span className="nav-icon">{n.icon}</span>{n.label}</button>))}</nav><div className="sidebar-footer"><div className="user-chip"><div className="user-avatar">{user.name[0].toUpperCase()}</div><div className="user-name">{user.name}</div></div></div></div><div className="mobile-header"><button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}><span /><span /><span /></button><span style={{ fontFamily: "Syne", fontWeight: 800, color: "white", fontSize: 18 }}>Spend<span style={{ color: "#00C896" }}>Sight</span></span><div style={{ width: 30 }} /></div><main className="main">{page === "dashboard" && <Dashboard user={user} transactions={transactions} goals={goals} incomes={incomes} budgets={budgets} onUpdateBudget={handleUpdateBudgets} onAddIncome={handleAddIncome} onDeleteIncome={handleDeleteIncome} currency={currency} onCurrencyChange={setCurrency} showToast={showToast} />}{page === "upload" && <UploadPage onUpload={handleUpload} uploadedFiles={uploadedFiles} currency={currency} showToast={showToast} />}{page === "transactions" && <TransactionsPage transactions={transactions} setTransactions={setTransactions} currency={currency} showToast={showToast} />}{page === "insights" && <InsightsPage transactions={transactions} currency={currency} />}{page === "whatif" && <WhatIfPage transactions={transactions} incomes={incomes} currency={currency} customScenarios={customScenarios} onAddScenario={handleAddScenario} onDeleteScenario={handleDeleteScenario} />}{page === "goals" && <GoalsPage goals={goals} onAdd={(g) => setGoals(gs => [...gs, g])} onContribute={handleContributeToGoal} currency={currency} showToast={showToast} />}{page === "contact" && <ContactPage />}{page === "settings" && <SettingsPage user={user} onLogout={() => { setUser(null); setPage("dashboard"); }} onClearData={handleClearData} currency={currency} onCurrencyChange={setCurrency} theme={theme} onThemeChange={setTheme} textSize={textSize} onTextSizeChange={setTextSize} transactions={transactions} goals={goals} incomes={incomes} budgets={budgets} customScenarios={customScenarios} onRestoreData={handleRestoreData} showToast={showToast} />}</main></div>{toast && <div className="toast">{toast}</div>}</>);
}