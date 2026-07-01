import { useState, useEffect, useRef } from "react";
import { Analytics } from "@vercel/analytics/react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

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

const taglines = [
  "Here's where your money went this month.",
  "Small steps, big savings.",
  "Your money, your clarity.",
  "Know more. Spend smarter.",
  "Every pula tells a story.",
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

function formatMoney(amount, currencyCode) {
  const c = CURRENCIES[currencyCode] || CURRENCIES.BWP;
  return `${c.symbol} ${amount.toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  const amountInBWP = amount / EXCHANGE_RATES[fromCurrency];
  return amountInBWP * EXCHANGE_RATES[toCurrency];
}

// ─── AI SERVICE — MOCK (Security Fix: No hardcoded API keys) ──────────────

// SECURITY FIX: Removed hardcoded NVIDIA API key
// The app now uses a mock AI service that simulates responses locally
// No external API calls, no API key exposure, works offline

function callAIService(prompt) {
  // Mock response generator based on prompt content
  const mockResponses = {
    advisor: {
      summary: "Your spending this month is within your income range.",
      opportunity: "Consider reviewing your Groceries category to find potential savings.",
      encouragement: "Every small step counts toward financial freedom!"
    },
    weeklyReport: {
      topCategory: "Groceries",
      trend: "stable",
      assessment: "Your spending is stable — good job!",
      recommendations: [
        "Review your subscriptions for unused services.",
        "Set up automatic transfers to your savings account."
      ]
    }
  };
  
  // Return appropriate mock based on prompt keywords
  if (prompt.includes("financial advisor") || prompt.includes("spending data")) {
    return mockResponses.advisor;
  }
  if (prompt.includes("weekly report") || prompt.includes("spending report")) {
    return mockResponses.weeklyReport;
  }
  
  return {
    summary: "I've analyzed your financial data.",
    opportunity: "Review your top spending categories for potential savings.",
    encouragement: "Keep tracking your finances!"
  };
}

// ─── FINANCIAL HEALTH ENGINE ──────────────────────────────────────────────────

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
      riskLevel: "gray",
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
  }
  
  const prevMonthSpent = prevMonthTxs.filter(t => t.type === "debit").reduce((sum, t) => sum + t.amount, 0);
  let stabilityScore = 100;
  if (prevMonthSpent > 0 && totalSpent > 0) {
    const variance = Math.abs((totalSpent - prevMonthSpent) / prevMonthSpent);
    stabilityScore = Math.max(0, 100 - (variance * 100));
    stabilityScore = Math.min(100, stabilityScore);
  } else if (totalSpent > 0 && prevMonthSpent === 0) {
    stabilityScore = 50;
  }
  
  let goalScore = 0;
  if (goals.length > 0) {
    const goalProgress = goals.reduce((sum, g) => {
      const pct = g.target > 0 ? (g.saved / g.target) * 100 : 0;
      return sum + Math.min(pct, 100);
    }, 0);
    goalScore = goalProgress / goals.length;
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
    grade,
    savingsRate: Math.round(savingsRate),
    savingsScore: Math.round(savingsScore),
    budgetScore: Math.round(budgetScore),
    stabilityScore: Math.round(stabilityScore),
    goalScore: Math.round(goalScore),
    debtScore: Math.round(debtScore),
    riskLevel,
    riskLabel,
    riskFactors,
    totalIncome,
    totalSpent,
    savings,
    monthOverMonthChange: prevMonthSpent > 0 ? Math.round(((totalSpent - prevMonthSpent) / prevMonthSpent) * 100) : 0,
    hasData: true
  };
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
      date,
      description: description.substring(0, 50),
      amount,
      type,
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

// ─── STYLES ──────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── ACCESSIBILITY: Reduced motion ── */
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }

  :root {
    /* OKLCH-based colors — perceptually uniform */
    --primary: #00C896;
    --primary-hover: #00E0AA;
    --secondary: #1A1A2E;
    --secondary-light: #2D3748;
    --success: #2ECC71;
    --error: #FF4757;
    --warning: #F6C90E;
    --warning-dark: #D4A800;
    --neutral: #777777;
    --surface: #F7F9FC;
    --surface-dark: #0F0F1A;
    --text: #2D3748;
    --text-light: #E2E8F0;
    --text-muted: #718096;
    --border: #E2E8F0;
    --bg: #F7F9FC;
    --risk-green: #00C896;
    --risk-yellow: #F6C90E;
    --risk-yellow-dark: #D4A800;
    --risk-red: #FF4757;
    --risk-gray: #A0AEC0;
    --text-scale: 1;
  }

  html.dark {
    --bg: #0F0F1A;
    --surface: #1A1A2E;
    --text: #E2E8F0;
    --text-muted: #A0AEC0;
    --border: #2D3748;
    --risk-green: #00E0AA;
    --risk-yellow: #F6C90E;
    --risk-red: #FF6B7A;
    --primary: #00E0AA;
    --warning: #F6C90E;
  }

  html.text-small { --text-scale: 0.85; }
  html.text-normal { --text-scale: 1; }
  html.text-large { --text-scale: 1.15; }
  html.text-xlarge { --text-scale: 1.3; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    transition: background 0.25s, color 0.25s;
    font-size: calc(14px * var(--text-scale));
    -webkit-tap-highlight-color: transparent;
  }

  input, select, button, textarea {
    -webkit-appearance: none;
    font-family: 'DM Sans', sans-serif;
    font-size: calc(14px * var(--text-scale));
    touch-action: manipulation;
  }

  /* ── SIDEBAR ── */
  .app { display: flex; min-height: 100vh; }

  .sidebar {
    width: 240px;
    min-height: 100vh;
    background: var(--secondary);
    display: flex;
    flex-direction: column;
    padding: 32px 0;
    position: fixed;
    left: 0;
    top: 0;
    z-index: 100;
    transition: transform 0.3s ease;
    pointer-events: none;
  }
  .sidebar.open { pointer-events: all; }
  .sidebar-logo { padding: 0 24px 32px; border-bottom: 1px solid #ffffff10; }
  .logo-text {
    font-family: 'Syne', sans-serif;
    font-size: calc(22px * var(--text-scale));
    font-weight: 800;
    color: white;
    letter-spacing: -0.5px;
  }
  .logo-dot { color: var(--primary); }

  .sidebar-nav {
    flex: 1;
    padding: 24px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #ffffff60;
    font-size: calc(14px * var(--text-scale));
    font-weight: 500;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
  }
  .nav-item:hover { background: #ffffff10; color: white; }
  .nav-item.active { background: #00C89615; color: var(--primary); }
  .nav-item .nav-icon { font-size: calc(18px * var(--text-scale)); width: 24px; text-align: center; }

  .sidebar-footer { padding: 24px; border-top: 1px solid #ffffff10; }
  .user-chip {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #ffffff08;
    border-radius: 8px;
    padding: 10px 12px;
  }
  .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: calc(13px * var(--text-scale));
    color: var(--secondary);
    flex-shrink: 0;
  }
  .user-name { color: white; font-size: calc(13px * var(--text-scale)); font-weight: 500; }

  /* ── MOBILE HEADER ── */
  .mobile-header {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 200;
    background: var(--secondary);
    padding: 16px 20px;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #ffffff10;
    height: 60px;
  }
  .hamburger {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 4px;
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
  }
  .hamburger span { display: block; width: 22px; height: 2px; background: white; border-radius: 2px; }
  .mobile-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: #00000080;
    z-index: 150;
    pointer-events: none;
  }
  .mobile-overlay.open { display: block; pointer-events: all; }

  .main {
    margin-left: 240px;
    flex: 1;
    padding: 40px;
    min-height: 100vh;
    background: var(--bg);
    pointer-events: all;
  }

  /* ── AUTH SCREEN ── */
  .auth-screen {
    min-height: 100vh;
    background: var(--secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background-image: radial-gradient(ellipse at 20% 50%, #00C89610 0%, transparent 60%),
                      radial-gradient(ellipse at 80% 20%, #4299E110 0%, transparent 60%);
  }
  .auth-card {
    background: var(--secondary);
    border: 1px solid #ffffff10;
    border-radius: 12px;
    padding: 48px 40px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 40px 80px #00000060;
  }
  .auth-logo { text-align: center; margin-bottom: 8px; }
  .auth-logo-text {
    font-family: 'Syne', sans-serif;
    font-size: calc(28px * var(--text-scale));
    font-weight: 800;
    color: white;
  }
  .auth-tagline {
    text-align: center;
    color: #ffffff50;
    font-size: calc(13px * var(--text-scale));
    margin-bottom: 36px;
  }
  .auth-tabs {
    display: flex;
    background: #ffffff08;
    border-radius: 8px;
    padding: 4px;
    margin-bottom: 28px;
  }
  .auth-tab {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: calc(14px * var(--text-scale));
    font-weight: 500;
    background: none;
    color: #ffffff50;
    transition: all 0.2s;
    min-height: 44px;
    touch-action: manipulation;
  }
  .auth-tab.active { background: var(--primary); color: var(--secondary); }
  .form-group { margin-bottom: 16px; }
  .form-label {
    display: block;
    color: #ffffff70;
    font-size: calc(12px * var(--text-scale));
    font-weight: 500;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .form-input {
    width: 100%;
    padding: 14px 16px;
    background: #ffffff08;
    border: 1px solid #ffffff15;
    border-radius: 8px;
    color: white;
    font-family: 'DM Sans', sans-serif;
    font-size: calc(14px * var(--text-scale));
    outline: none;
    transition: all 0.2s;
    min-height: 48px;
  }
  .form-input:focus { border-color: var(--primary); background: #ffffff10; }
  .form-input::placeholder { color: #ffffff30; }
  .btn-primary {
    width: 100%;
    padding: 15px;
    background: var(--primary);
    color: var(--secondary);
    border: none;
    border-radius: 8px;
    font-family: 'Syne', sans-serif;
    font-size: calc(15px * var(--text-scale));
    font-weight: 700;
    cursor: pointer;
    margin-top: 8px;
    transition: all 0.2s;
    min-height: 48px;
    touch-action: manipulation;
  }
  .btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); }

  /* ── PAGE LAYOUT ── */
  .page-header { margin-bottom: 32px; }
  .greeting {
    font-family: 'Syne', sans-serif;
    font-size: clamp(28px, 4vw, 44px);
    font-weight: 700;
    color: var(--text);
  }
  .greeting-name { color: var(--primary); }
  .greeting-tagline {
    color: var(--text-muted);
    font-size: clamp(14px, 1.2vw, 16px);
    margin-top: 4px;
  }

  /* ── CURRENCY BANNER ── */
  .currency-banner {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 24px;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
  }
  .currency-banner-label {
    font-size: calc(13px * var(--text-scale));
    color: var(--text-muted);
  }
  .currency-banner-value {
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    color: var(--primary);
    font-size: calc(14px * var(--text-scale));
  }
  .currency-selector {
    padding: 8px 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
    font-size: calc(14px * var(--text-scale));
    cursor: pointer;
    min-height: 44px;
    touch-action: manipulation;
  }

  /* ── AI ADVISOR ── */
  .ai-advisor-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px 24px;
    margin-bottom: 24px;
    position: relative;
    border-left: 3px solid var(--primary);
  }
  .ai-advisor-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .ai-advisor-badge {
    background: var(--primary);
    color: var(--secondary);
    padding: 2px 12px;
    border-radius: 4px;
    font-size: calc(10px * var(--text-scale));
    font-weight: 700;
    text-transform: uppercase;
  }
  .ai-advisor-status {
    padding: 2px 10px;
    border-radius: 4px;
    font-size: calc(10px * var(--text-scale));
    font-weight: 600;
  }
  .ai-advisor-status.ready { background: var(--neutral); color: white; }
  .ai-advisor-status.thinking { background: var(--warning); color: var(--secondary); }
  .ai-advisor-status.live { background: var(--primary); color: var(--secondary); }
  .ai-advisor-status.error { background: var(--error); color: white; }
  .ai-advisor-status.offline { background: var(--error); color: white; }
  .ai-advisor-summary {
    font-size: calc(16px * var(--text-scale));
    font-weight: 600;
    color: var(--text);
    margin-bottom: 8px;
  }
  .ai-advisor-opportunity {
    font-size: calc(14px * var(--text-scale));
    color: var(--text);
    margin-bottom: 6px;
  }
  .ai-advisor-encouragement {
    font-size: calc(14px * var(--text-scale));
    color: var(--primary);
    font-weight: 500;
  }
  .ai-advisor-refresh {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: calc(12px * var(--text-scale));
    padding: 4px 12px;
    border-radius: 4px;
    min-height: 44px;
    touch-action: manipulation;
  }
  .ai-advisor-refresh:hover { background: var(--bg); }

  .ai-report-card {
    background: var(--surface);
    border-radius: 8px;
    padding: 24px;
    border: 1px solid var(--border);
    margin-top: 20px;
  }
  .ai-report-content {
    white-space: pre-wrap;
    font-size: calc(14px * var(--text-scale));
    line-height: 1.6;
    color: var(--text);
  }
  .ai-report-loading {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);
  }
  .ai-report-loading .spinner {
    display: inline-block;
    width: 30px;
    height: 30px;
    border: 3px solid var(--border);
    border-top: 3px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .ai-thought {
    text-align: center;
    color: var(--text-muted);
    font-size: calc(14px * var(--text-scale));
    padding: 8px 0;
    animation: thoughtPulse 1.5s ease-in-out infinite;
  }
  @keyframes thoughtPulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  /* ── ENHANCED UX: LOADING & PROCESSING ── */
  .processing-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 15, 26, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    color: white;
    animation: fadeIn 0.3s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .processing-card {
    background: var(--secondary);
    padding: 32px;
    border-radius: 16px;
    border: 1px solid #ffffff15;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    min-width: 240px;
  }

  .loader-ring {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(0, 200, 150, 0.1);
    border-top: 3px solid var(--primary);
    border-radius: 50%;
    animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    box-shadow: 0 0 15px rgba(0, 200, 150, 0.2);
  }

  /* Premium Hover Effects */
  .card, .stat-card, .goal-card, .settings-card {
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
  }
  .card:hover, .stat-card:hover, .goal-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0,0,0,0.1);
  }

  /* Smooth Page Transitions */
  .main {
    animation: pageSlideIn 0.4s ease-out;
  }
  @keyframes pageSlideIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .processing-text {
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 18px;
    letter-spacing: -0.5px;
  }

  .success-check {
    width: 60px;
    height: 60px;
    background: var(--primary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--secondary);
    font-size: 32px;
    animation: scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  @keyframes scaleIn { from { transform: scale(0); } to { transform: scale(1); } }

  /* Button Loading State */
  .btn-loading {
    position: relative;
    color: transparent !important;
    pointer-events: none;
  }
  .btn-loading::after {
    content: "";
    position: absolute;
    width: 18px;
    height: 18px;
    top: calc(50% - 9px);
    left: calc(50% - 9px);
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  /* Enhanced Toast */
  .toast {
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%) translateY(0);
    background: var(--secondary);
    color: white;
    padding: 12px 24px;
    border-radius: 12px;
    font-weight: 600;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px solid #ffffff10;
    animation: toastIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }
  @keyframes toastIn {
    from { transform: translateX(-50%) translateY(100px); opacity: 0; }
    to { transform: translateX(-50%) translateY(0); opacity: 1; }
  }
  .toast.success { border-left: 4px solid var(--primary); }
  .toast.error { border-left: 4px solid var(--error); }
  .toast-icon { font-size: 18px; }

  /* ── HEALTH SCORE ── */
  .health-score-card {
    background: var(--surface);
    border-radius: 8px;
    padding: 24px;
    border: 1px solid var(--border);
    margin-bottom: 24px;
  }
  .health-score-main {
    display: flex;
    align-items: center;
    gap: 32px;
    flex-wrap: wrap;
  }
  .health-score-circle {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: calc(28px * var(--text-scale));
    color: white;
    flex-shrink: 0;
    transition: transform 0.3s ease;
  }
  .health-score-circle .grade {
    font-size: calc(14px * var(--text-scale));
    font-weight: 600;
    opacity: 0.9;
  }
  .health-score-details {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 12px;
  }
  .health-metric {
    padding: 8px 12px;
    background: var(--bg);
    border-radius: 4px;
    cursor: help;
    position: relative;
    transition: background 0.2s ease;
  }
  .health-metric:hover { background: var(--border); }
  .health-metric-label {
    font-size: calc(10px * var(--text-scale));
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .health-metric-value {
    font-family: 'Syne', sans-serif;
    font-size: calc(18px * var(--text-scale));
    font-weight: 700;
    color: var(--text);
  }
  .health-metric-bar {
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    margin-top: 4px;
    overflow: hidden;
  }
  .health-metric-bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.6s ease;
  }
  .health-no-data {
    text-align: center;
    padding: 20px;
    color: var(--text-muted);
  }

  .risk-meter {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
    padding: 12px 16px;
    border-radius: 4px;
    background: var(--bg);
  }
  .risk-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .risk-dot.green { background: var(--risk-green); }
  .risk-dot.yellow { background: var(--risk-yellow); }
  .risk-dot.red { background: var(--risk-red); }
  .risk-dot.gray { background: var(--risk-gray); }
  .risk-label {
    font-weight: 600;
    font-size: calc(13px * var(--text-scale));
  }
  .risk-factors {
    font-size: calc(12px * var(--text-scale));
    color: var(--text-muted);
  }

  .insight-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-top: 12px;
  }
  .insight-mini-card {
    background: var(--bg);
    padding: 12px 16px;
    border-radius: 4px;
    border-left: 3px solid var(--primary);
  }
  .insight-mini-card .icon { font-size: calc(18px * var(--text-scale)); margin-right: 8px; }
  .insight-mini-card .text { font-size: calc(13px * var(--text-scale)); }

  /* ── INCOME BANNER ── */
  .income-banner {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 24px;
  }
  .income-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .income-title {
    font-family: 'Syne', sans-serif;
    font-size: calc(16px * var(--text-scale));
    font-weight: 700;
    color: var(--text);
  }
  .btn-add-income {
    padding: 8px 16px;
    background: var(--primary);
    color: var(--secondary);
    border: none;
    border-radius: 4px;
    font-size: calc(13px * var(--text-scale));
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
    touch-action: manipulation;
    transition: all 0.2s;
  }
  .btn-add-income:hover { background: var(--primary-hover); transform: scale(1.02); }
  .income-total {
    font-family: 'Syne', sans-serif;
    font-size: calc(28px * var(--text-scale));
    font-weight: 800;
    color: var(--primary);
    margin-bottom: 12px;
  }
  .income-list { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
  .income-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
    font-size: calc(13px * var(--text-scale));
  }
  .income-type-badge {
    background: var(--primary)20;
    color: var(--primary);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: calc(11px * var(--text-scale));
    font-weight: 600;
  }
  .income-amount { font-weight: 600; color: var(--primary); }
  .income-delete {
    background: none;
    border: none;
    color: var(--error);
    cursor: pointer;
    font-size: calc(14px * var(--text-scale));
    padding: 4px;
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
  }
  .credited-section { margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--border); }
  .credited-toggle {
    background: none;
    border: none;
    color: var(--primary);
    font-size: calc(12px * var(--text-scale));
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    touch-action: manipulation;
  }

  /* ── STATS GRID ── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 28px;
  }
  .stat-card {
    background: var(--surface);
    border-radius: 8px;
    padding: 24px;
    border: 1px solid var(--border);
    position: relative;
    overflow: hidden;
    transition: transform 0.2s;
  }
  .stat-card:hover { transform: translateY(-2px); }
  .stat-card::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
  }
  .stat-card.spent::after { background: var(--error); }
  .stat-card.free::after { background: var(--primary); }
  .stat-card.savings::after { background: var(--warning); }
  .stat-label {
    font-size: calc(12px * var(--text-scale));
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
  }
  .stat-label small {
    font-size: calc(10px * var(--text-scale));
    text-transform: none;
    font-weight: normal;
    color: var(--text-muted);
  }
  .stat-value {
    font-family: 'Syne', sans-serif;
    font-size: clamp(22px, 3vw, 32px);
    font-weight: 700;
    color: var(--text);
  }
  .stat-sub {
    font-size: calc(12px * var(--text-scale));
    color: var(--text-muted);
    margin-top: 6px;
  }

  /* ── SAVINGS RATE PULSE (Micro-interaction) ── */
  @keyframes pulseGold {
    0%, 100% { color: var(--text); }
    50% { color: var(--warning); transform: scale(1.05); }
  }
  .stat-value.pulse { animation: pulseGold 0.8s ease; }

  /* ── DASHBOARD GRID ── */
  .dashboard-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 28px;
  }
  .card {
    background: var(--surface);
    border-radius: 8px;
    padding: 24px;
    border: 1px solid var(--border);
  }
  .card-title {
    font-family: 'Syne', sans-serif;
    font-size: calc(15px * var(--text-scale));
    font-weight: 700;
    color: var(--text);
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  }

  /* ── BUDGET BAR ── */
  .budget-item { margin-bottom: 16px; }
  .budget-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: calc(13px * var(--text-scale));
  }
  .budget-name { font-weight: 500; color: var(--text); }
  .budget-amount { color: var(--text-muted); }
  .budget-bar {
    height: 6px;
    background: var(--border);
    border-radius: 4px;
    overflow: hidden;
    transition: height 0.3s ease;
  }
  .budget-bar.near-limit { height: 8px; }
  .budget-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.6s ease, background 0.3s ease;
  }
  .budget-fill.green { background: var(--primary); }
  .budget-fill.yellow { background: var(--warning); }
  .budget-fill.red { background: var(--error); }
  .budget-warning {
    margin-top: 4px;
    font-size: calc(11px * var(--text-scale));
    color: var(--error);
  }

  /* ── DONUT CHART ── */
  .donut-wrap { display: flex; align-items: center; gap: 24px; }
  .donut-svg { flex-shrink: 0; }
  .donut-legend { display: flex; flex-direction: column; gap: 10px; flex: 1; }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: calc(13px * var(--text-scale));
  }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .legend-name { color: var(--text-muted); flex: 1; }
  .legend-val {
    font-weight: 600;
    color: var(--text);
    font-size: calc(12px * var(--text-scale));
  }

  /* ── BAR CHART ── */
  .bar-chart {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    height: 120px;
    padding-bottom: 24px;
  }
  .bar-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    height: 100%;
    justify-content: flex-end;
  }
  .bar {
    width: 100%;
    border-radius: 4px 4px 0 0;
    background: var(--primary);
    opacity: 0.3;
    min-height: 4px;
  }
  .bar.active { opacity: 1; }
  .bar-label {
    font-size: calc(11px * var(--text-scale));
    color: var(--text-muted);
  }

  /* ── STAGGERED BUDGET BARS (Micro-interaction) ── */
  .budget-fill.animate {
    animation: barGrow 0.5s ease forwards;
    opacity: 0;
  }
  @keyframes barGrow {
    0% { width: 0 !important; opacity: 0; }
    100% { width: var(--bar-width); opacity: 1; }
  }

  /* ── TIMING INSIGHTS ── */
  .timing-bar-chart {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 16px 0;
  }
  .timing-bar-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .timing-bar-label {
    width: 80px;
    font-size: calc(12px * var(--text-scale));
    color: var(--text-muted);
  }
  .timing-bar-bg {
    flex: 1;
    height: 24px;
    background: var(--border);
    border-radius: 4px;
    overflow: hidden;
  }
  .timing-bar-fill {
    height: 100%;
    background: var(--primary);
    border-radius: 4px;
    transition: width 0.3s;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 8px;
    color: var(--secondary);
    font-size: calc(10px * var(--text-scale));
    font-weight: 600;
  }

  /* ── EMPTY STATE ── */
  .empty-state { text-align: center; padding: 40px 20px; }
  .empty-icon { font-size: calc(48px * var(--text-scale)); margin-bottom: 12px; opacity: 0.5; }
  .empty-text {
    color: var(--text-muted);
    font-size: calc(18px * var(--text-scale));
    font-weight: 600;
  }
  .empty-sub {
    color: var(--text-muted);
    font-size: calc(14px * var(--text-scale));
    margin-top: 6px;
    opacity: 0.7;
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
  }
  .empty-action {
    margin-top: 20px;
    display: inline-block;
  }

  /* ── TRANSACTIONS ── */
  .tx-checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 10px;
    flex-shrink: 0;
  }
  .tx-checkbox input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--primary);
    background: var(--bg);
    border: 2px solid var(--border);
    border-radius: 4px;
    appearance: checkbox;
    -webkit-appearance: checkbox;
    -moz-appearance: checkbox;
  }
  .tx-checkbox input[type="checkbox"]:checked {
    accent-color: var(--primary);
    background: var(--primary);
  }

  .tx-list { display: flex; flex-direction: column; }
  .tx-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid var(--border);
    position: relative;
  }
  .tx-item:hover { background: var(--bg); margin: 0 -12px; padding: 14px 12px; border-radius: 4px; }
  .tx-content { flex: 1; min-width: 0; }
  .tx-main { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .tx-icon {
    width: 38px;
    height: 38px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: calc(16px * var(--text-scale));
    flex-shrink: 0;
  }
  .tx-info { flex: 1; min-width: 0; }
  .tx-name {
    font-size: calc(14px * var(--text-scale));
    font-weight: 500;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .tx-name-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tx-notes-icon { font-size: calc(12px * var(--text-scale)); color: var(--primary); cursor: help; }
  .tx-date {
    font-size: calc(12px * var(--text-scale));
    color: var(--text-muted);
    margin-top: 2px;
  }
  .tx-amount {
    font-family: 'Syne', sans-serif;
    font-size: calc(14px * var(--text-scale));
    font-weight: 700;
    white-space: nowrap;
  }
  .tx-amount.debit { color: var(--error); }
  .tx-amount.credit { color: var(--primary); }
  .cat-badge {
    font-size: calc(11px * var(--text-scale));
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 500;
    white-space: nowrap;
  }
  .tx-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .tx-tag {
    background: var(--primary)20;
    color: var(--primary);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: calc(10px * var(--text-scale));
    font-weight: 500;
  }
  .split-badge {
    background: var(--primary)20;
    color: var(--primary);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: calc(9px * var(--text-scale));
    font-weight: 600;
    margin-left: 6px;
  }
  .tx-menu { position: relative; flex-shrink: 0; }
  .tx-menu-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: calc(18px * var(--text-scale));
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
  }
  .tx-menu-btn:hover { background: var(--border); color: var(--text); }
  .tx-dropdown {
    position: absolute;
    right: 0;
    top: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 99;
    min-width: 140px;
  }
  .tx-dropdown button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 8px 12px;
    background: none;
    border: none;
    font-size: calc(13px * var(--text-scale));
    color: var(--text);
    cursor: pointer;
    min-height: 44px;
    touch-action: manipulation;
  }
  .tx-dropdown button:hover { background: var(--bg); }
  .split-row {
    margin-left: 50px;
    padding: 8px 0 8px 12px;
    border-left: 2px solid var(--primary);
    margin-top: -4px;
    margin-bottom: 4px;
    background: var(--bg);
    border-radius: 0 4px 4px 0;
  }
  .split-details {
    font-size: calc(12px * var(--text-scale));
    color: var(--text-muted);
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  /* ── FILTER CHIPS ── */
  .filter-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
  .filter-chip {
    padding: 6px 18px;
    border-radius: 4px;
    font-size: calc(12px * var(--text-scale));
    font-weight: 500;
    cursor: pointer;
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    min-height: 44px;
    transition: all 0.2s;
    touch-action: manipulation;
  }
  .filter-chip.active {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--secondary);
  }

  /* ── CALENDAR ── */
  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    margin-top: 16px;
  }
  .calendar-day-header {
    text-align: center;
    font-size: calc(12px * var(--text-scale));
    font-weight: 600;
    color: var(--text-muted);
    padding: 8px;
  }
  .calendar-day {
    min-height: 80px;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 4px;
    background: var(--bg);
  }
  .calendar-day-num {
    font-size: calc(12px * var(--text-scale));
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 4px;
  }
  .calendar-tx {
    font-size: calc(10px * var(--text-scale));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 2px 4px;
    border-radius: 4px;
    margin-bottom: 2px;
    cursor: pointer;
  }
  .calendar-tx.debit { background: var(--error)20; color: var(--error); }
  .calendar-tx.credit { background: var(--primary)20; color: var(--primary); }

  /* ── BULK BAR ── */
  .bulk-bar {
    position: fixed;
    bottom: 0;
    left: 240px;
    right: 0;
    background: var(--secondary);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 400;
    border-top: 1px solid var(--primary);
    flex-wrap: wrap;
    gap: 12px;
  }
  .bulk-bar .selected-count { color: white; font-size: calc(14px * var(--text-scale)); }
  .bulk-bar .bulk-actions { display: flex; gap: 12px; }
  .bulk-bar .bulk-actions button {
    padding: 8px 16px;
    border-radius: 4px;
    font-size: calc(13px * var(--text-scale));
    font-weight: 600;
    cursor: pointer;
    border: none;
    min-height: 44px;
    touch-action: manipulation;
  }
  .bulk-recategorise { background: var(--primary); color: var(--secondary); }
  .bulk-delete { background: var(--error); color: white; }
  .bulk-cancel {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
  }
  @media (max-width: 768px) { .bulk-bar { left: 0; } }

  /* ── UPLOAD ZONE ── */
  .upload-zone {
    border: 2px dashed var(--border);
    border-radius: 8px;
    padding: 60px 40px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
    background: var(--surface);
    margin-bottom: 24px;
  }
  .upload-zone:hover, .upload-zone.dragover { border-color: var(--primary); background: var(--primary)08; }
  .upload-icon { font-size: calc(48px * var(--text-scale)); margin-bottom: 16px; }
  .upload-title {
    font-family: 'Syne', sans-serif;
    font-size: calc(20px * var(--text-scale));
    font-weight: 700;
    color: var(--text);
    margin-bottom: 8px;
  }
  .upload-sub {
    color: var(--text-muted);
    font-size: calc(14px * var(--text-scale));
    margin-bottom: 24px;
  }
  .btn-upload {
    display: inline-block;
    padding: 12px 28px;
    background: var(--primary);
    color: var(--secondary);
    border: none;
    border-radius: 4px;
    font-family: 'Syne', sans-serif;
    font-size: calc(14px * var(--text-scale));
    font-weight: 700;
    cursor: pointer;
    min-height: 44px;
    transition: all 0.2s;
    touch-action: manipulation;
  }
  .btn-upload:hover { background: var(--primary-hover); transform: scale(1.02); }

  .upload-history { margin-top: 16px; }
  .history-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
    font-size: calc(12px * var(--text-scale));
  }

  /* ── GOALS ── */
  .goals-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }
  .goal-card {
    background: var(--surface);
    border-radius: 8px;
    padding: 24px;
    border: 1px solid var(--border);
  }
  .goal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .goal-name {
    font-family: 'Syne', sans-serif;
    font-size: calc(15px * var(--text-scale));
    font-weight: 700;
    color: var(--text);
  }
  .goal-emoji { font-size: calc(24px * var(--text-scale)); }
  .goal-amounts {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    align-items: flex-end;
  }
  .goal-saved {
    font-family: 'Syne', sans-serif;
    font-size: calc(18px * var(--text-scale));
    font-weight: 700;
    color: var(--text);
  }
  .goal-target {
    font-size: calc(13px * var(--text-scale));
    color: var(--text-muted);
  }
  .progress-bar {
    height: 6px;
    background: var(--border);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 10px;
  }
  .progress-pulse {
    animation: progressPulse 0.8s ease;
  }
  @keyframes progressPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 1; box-shadow: 0 0 20px var(--primary); }
  }
  .progress-fill {
    height: 100%;
    background: var(--primary);
    border-radius: 4px;
    transition: width 0.6s ease;
  }
  .goal-meta {
    font-size: calc(12px * var(--text-scale));
    color: var(--text-muted);
  }
  .add-goal-card {
    background: none;
    border: 2px dashed var(--border);
    border-radius: 8px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.2s;
    min-height: 160px;
    width: 100%;
  }
  .add-goal-card:hover { border-color: var(--primary); background: var(--primary)08; }
  .add-goal-icon { font-size: calc(28px * var(--text-scale)); color: var(--text-muted); }
  .add-goal-text {
    font-size: calc(14px * var(--text-scale));
    color: var(--text-muted);
    font-weight: 500;
  }

  /* ── INSIGHTS ── */
  .insight-card {
    background: linear-gradient(135deg, var(--secondary) 0%, #0F0F1A 100%);
    border-radius: 8px;
    padding: 24px;
    color: white;
    margin-bottom: 20px;
    border: 1px solid #ffffff10;
    position: relative;
    overflow: hidden;
  }
  .insight-card::before {
    content: '💡';
    position: absolute;
    right: 24px;
    top: 50%;
    transform: translateY(-50%);
    font-size: calc(48px * var(--text-scale));
    opacity: 0.15;
  }
  .insight-label {
    font-size: calc(11px * var(--text-scale));
    color: var(--primary);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  }
  .insight-text {
    font-size: calc(16px * var(--text-scale));
    font-weight: 500;
    line-height: 1.5;
    max-width: 80%;
    color: white;
  }

  /* ── WHAT-IF ── */
  .whatif-scenario {
    margin-bottom: 32px;
    padding: 20px;
    background: var(--bg);
    border-radius: 8px;
    border: 1px solid var(--border);
  }
  .whatif-title {
    font-family: 'Syne', sans-serif;
    font-size: calc(16px * var(--text-scale));
    font-weight: 700;
    color: var(--text);
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .whatif-input-group {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
    align-items: flex-end;
  }
  .whatif-field { flex: 1; min-width: 120px; }
  .whatif-field label {
    display: block;
    font-size: calc(11px * var(--text-scale));
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .whatif-field input, .whatif-field select {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface);
    color: var(--text);
    font-size: calc(13px * var(--text-scale));
    min-height: 44px;
    touch-action: manipulation;
  }
  .whatif-output {
    margin-top: 16px;
    padding: 16px;
    background: var(--surface);
    border-radius: 4px;
    border-left: 3px solid var(--primary);
  }
  .whatif-output-text { font-size: calc(14px * var(--text-scale)); color: var(--text); }
  .whatif-output-value {
    font-family: 'Syne', sans-serif;
    font-size: calc(20px * var(--text-scale));
    font-weight: 800;
    color: var(--primary);
  }
  .custom-scenario-card {
    background: var(--surface);
    border-radius: 4px;
    padding: 16px;
    margin-bottom: 12px;
    border: 1px solid var(--border);
  }
  .custom-scenario-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .custom-scenario-text {
    font-size: calc(14px * var(--text-scale));
    color: var(--text);
  }
  .custom-scenario-output {
    font-family: 'Syne', sans-serif;
    font-size: calc(18px * var(--text-scale));
    font-weight: 800;
    color: var(--primary);
    margin-top: 8px;
  }
  .delete-scenario {
    background: none;
    border: none;
    color: var(--error);
    cursor: pointer;
    font-size: calc(16px * var(--text-scale));
    padding: 4px;
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
  }

  /* ── SLIDER TOOLTIP (Micro-interaction) ── */
  .slider-tooltip {
    position: absolute;
    top: -30px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--secondary);
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: calc(12px * var(--text-scale));
    font-weight: 600;
    pointer-events: none;
    white-space: nowrap;
  }

  /* ── SETTINGS ── */
  .settings-section { margin-bottom: 32px; }
  .settings-title {
    font-family: 'Syne', sans-serif;
    font-size: calc(13px * var(--text-scale));
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 12px;
  }
  .settings-card {
    background: var(--surface);
    border-radius: 8px;
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    gap: 12px;
    flex-wrap: wrap;
  }
  .settings-row:last-child { border-bottom: none; }
  .settings-row-label {
    font-size: calc(14px * var(--text-scale));
    color: var(--text);
    font-weight: 500;
  }
  .settings-row-sub {
    font-size: calc(12px * var(--text-scale));
    color: var(--text-muted);
    margin-top: 2px;
  }
  .settings-select {
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-family: 'DM Sans', sans-serif;
    font-size: calc(13px * var(--text-scale));
    color: var(--text);
    background: var(--bg);
    outline: none;
    cursor: pointer;
    min-height: 44px;
    touch-action: manipulation;
  }
  .btn-danger {
    padding: 8px 16px;
    background: var(--error);
    color: white;
    border: none;
    border-radius: 4px;
    font-size: calc(13px * var(--text-scale));
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
    transition: all 0.2s;
    touch-action: manipulation;
  }
  .btn-danger:hover { opacity: 0.85; }
  .btn-outline {
    padding: 8px 16px;
    background: none;
    color: var(--primary);
    border: 1px solid var(--primary);
    border-radius: 4px;
    font-size: calc(13px * var(--text-scale));
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
    transition: all 0.2s;
    touch-action: manipulation;
  }
  .btn-outline:hover { background: var(--primary); color: var(--secondary); }

  .theme-toggle {
    display: flex;
    align-items: center;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 3px;
    gap: 2px;
    cursor: pointer;
  }
  .theme-toggle-btn {
    padding: 6px 14px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-size: calc(13px * var(--text-scale));
    font-weight: 500;
    transition: all 0.2s;
    background: none;
    color: var(--text-muted);
    min-height: 44px;
    touch-action: manipulation;
  }
  .theme-toggle-btn.active { background: var(--primary); color: var(--secondary); font-weight: 700; }

  .text-size-selector { display: flex; gap: 8px; }
  .size-btn {
    padding: 6px 12px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg);
    cursor: pointer;
    font-size: calc(13px * var(--text-scale));
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
  }
  .size-btn.active { background: var(--primary); color: var(--secondary); border-color: var(--primary); }

  /* ── MODAL ── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: #00000070;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .modal {
    background: var(--surface);
    border-radius: 8px;
    padding: 32px;
    width: 100%;
    max-width: 500px;
    box-shadow: 0 40px 80px #00000030;
    max-height: 90vh;
    overflow-y: auto;
    border: 1px solid var(--border);
  }
  .modal-title {
    font-family: 'Syne', sans-serif;
    font-size: calc(20px * var(--text-scale));
    font-weight: 700;
    color: var(--text);
    margin-bottom: 24px;
  }
  .modal-input {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-family: 'DM Sans', sans-serif;
    font-size: calc(14px * var(--text-scale));
    color: var(--text);
    background: var(--bg);
    outline: none;
    transition: border-color 0.2s;
    min-height: 44px;
    touch-action: manipulation;
  }
  .modal-input:focus { border-color: var(--primary); }
  .modal-label {
    display: block;
    font-size: calc(12px * var(--text-scale));
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    margin-top: 16px;
  }
  .modal-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
    justify-content: flex-end;
  }
  .btn-cancel {
    padding: 12px 20px;
    background: var(--bg);
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-family: 'DM Sans', sans-serif;
    font-size: calc(14px * var(--text-scale));
    cursor: pointer;
    min-height: 44px;
    touch-action: manipulation;
  }
  .btn-save {
    padding: 12px 24px;
    background: var(--primary);
    color: var(--secondary);
    border: none;
    border-radius: 4px;
    font-family: 'Syne', sans-serif;
    font-size: calc(14px * var(--text-scale));
    font-weight: 700;
    cursor: pointer;
    min-height: 44px;
    transition: all 0.2s;
    touch-action: manipulation;
  }
  .btn-save:hover { background: var(--primary-hover); }

  .category-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
    margin-bottom: 16px;
  }
  .category-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: calc(13px * var(--text-scale));
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    min-height: 44px;
    touch-action: manipulation;
  }
  .category-pill.active {
    border-color: var(--primary);
    background: var(--primary)20;
  }
  .category-pill:hover { transform: scale(0.98); }

  .tags-input {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 8px;
    background: var(--bg);
  }
  .tag-chip {
    background: var(--primary)20;
    color: var(--primary);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: calc(12px * var(--text-scale));
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .tag-chip button {
    background: none;
    border: none;
    color: var(--primary);
    cursor: pointer;
    font-size: calc(12px * var(--text-scale));
    padding: 0 2px;
  }
  .tags-input-field {
    border: none;
    background: none;
    padding: 4px;
    flex: 1;
    min-width: 80px;
    outline: none;
    color: var(--text);
    font-size: calc(13px * var(--text-scale));
  }

  .split-line {
    background: var(--bg);
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 12px;
    border: 1px solid var(--border);
  }
  .split-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .split-title {
    font-size: calc(13px * var(--text-scale));
    font-weight: 600;
    color: var(--text-muted);
  }
  .split-remove {
    background: none;
    border: none;
    color: var(--error);
    cursor: pointer;
    font-size: calc(16px * var(--text-scale));
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
  }
  .split-fields {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }
  .split-fields input, .split-fields select {
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface);
    color: var(--text);
    font-size: calc(13px * var(--text-scale));
    min-height: 44px;
    touch-action: manipulation;
  }
  .split-total {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    font-size: calc(14px * var(--text-scale));
  }
  .split-remainder { color: var(--primary); font-weight: 600; }

  .search-wrap {
    position: relative;
    margin-bottom: 20px;
  }
  .search-bar {
    width: 100%;
    padding: 12px 16px 12px 40px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-family: 'DM Sans', sans-serif;
    font-size: calc(14px * var(--text-scale));
    background: var(--surface);
    outline: none;
    color: var(--text);
    transition: border-color 0.2s;
    min-height: 44px;
    touch-action: manipulation;
  }
  .search-bar:focus { border-color: var(--primary); }
  .search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    font-size: calc(14px * var(--text-scale));
    pointer-events: none;
  }

  .sub-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .sub-item:last-child { border-bottom: none; }
  .sub-name {
    font-size: calc(14px * var(--text-scale));
    font-weight: 500;
    color: var(--text);
  }
  .sub-freq {
    font-size: calc(12px * var(--text-scale));
    color: var(--text-muted);
  }
  .sub-amount {
    font-family: 'Syne', sans-serif;
    font-size: calc(14px * var(--text-scale));
    font-weight: 700;
    color: var(--primary);
  }

  .contact-links {
    display: flex;
    gap: 16px;
    justify-content: center;
    margin-top: 20px;
  }
  .contact-card {
    background: var(--bg);
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    flex: 1;
    border: 1px solid var(--border);
  }
  .contact-icon { font-size: calc(40px * var(--text-scale)); margin-bottom: 12px; }
  .contact-title { font-weight: 700; margin-bottom: 8px; }
  .whatsapp-link {
    display: inline-block;
    margin-top: 12px;
    padding: 8px 20px;
    background: #25D366;
    color: white;
    border-radius: 30px;
    text-decoration: none;
    font-weight: 600;
    min-height: 44px;
  }

  .tx-explanation {
    background: var(--bg);
    border-radius: 4px;
    padding: 16px;
    margin-top: 8px;
    border-left: 3px solid var(--primary);
  }
  .tx-explanation-text {
    font-size: calc(14px * var(--text-scale));
    color: var(--text);
    line-height: 1.5;
  }
  .tx-explanation-label {
    font-size: calc(11px * var(--text-scale));
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--secondary);
    color: white;
    padding: 14px 20px;
    border-radius: 4px;
    font-size: calc(14px * var(--text-scale));
    border-left: 3px solid var(--primary);
    box-shadow: 0 8px 24px #00000030;
    z-index: 999;
    animation: slideUp 0.3s ease;
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── RESPONSIVE ── */
  @media (max-width: 768px) {
    .sidebar { transform: translateX(-100%); z-index: 300; pointer-events: none; }
    .sidebar.open { transform: translateX(0); pointer-events: all; }
    .mobile-overlay { display: none; position: fixed; inset: 0; background: #00000080; z-index: 250; pointer-events: none; }
    .mobile-overlay.open { display: block; pointer-events: all; }
    .mobile-header { display: flex !important; z-index: 200; }
    .app { display: block !important; }
    .main {
      margin-left: 0 !important;
      padding: 80px 16px 32px !important;
      width: 100vw !important;
      position: relative !important;
      z-index: 1 !important;
      pointer-events: all !important;
    }
    .stats-grid { grid-template-columns: 1fr !important; gap: 12px; }
    .dashboard-grid { grid-template-columns: 1fr !important; }
    .goals-grid { grid-template-columns: 1fr !important; }
    .auth-card { padding: 32px 24px; }
    .donut-wrap { flex-direction: column; }
    .greeting { font-size: clamp(24px, 5vw, 32px) !important; }
    .stat-value { font-size: clamp(20px, 4vw, 28px) !important; }
    .income-banner { flex-direction: column; align-items: flex-start; gap: 10px; }
    .settings-row { flex-wrap: wrap; }
    .split-fields { grid-template-columns: 1fr; }
    .whatif-input-group { flex-direction: column; }
    .calendar-grid { font-size: calc(10px * var(--text-scale)); }
    .calendar-day { min-height: 60px; }
    .contact-links { flex-direction: column; }
    .health-score-main { flex-direction: column; text-align: center; }
    .health-score-details { grid-template-columns: 1fr 1fr; }
    .health-score-circle { width: 80px; height: 80px; font-size: calc(22px * var(--text-scale)); }
    .insight-text { max-width: 100%; }
    .insight-card::before { font-size: calc(32px * var(--text-scale)); right: 16px; }
  }
`;

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

// ─── DONUT CHART ──────────────────────────────────────────────────────────────

function DonutChart({ data, currency }) {
  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📊</div>
        <div className="empty-text">No spending data yet</div>
        <div className="empty-sub">Upload your first statement to see where your money goes</div>
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
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="14" />
        {segments.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color}
            strokeWidth="14"
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.offset + circumference * 0.25} />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--primary)"
          style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 11 }}>Total</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="var(--primary)"
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
        <div className="empty-text">No monthly data yet</div>
        <div className="empty-sub">Upload statements from different months to see trends</div>
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

// ─── AI ADVISOR ──────────────────────────────────────────────────────────────

function AIAdvisor({ transactions, incomes, goals, budgets, currency }) {
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [aiStatus, setAiStatus] = useState("idle");
  const [thoughtIndex, setThoughtIndex] = useState(0);

  const thoughtMessages = [
    "Looking at your spending patterns...",
    "Checking your savings rate...",
    "Comparing this month to last...",
    "Finding opportunities for you..."
  ];

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setThoughtIndex((prev) => (prev + 1) % thoughtMessages.length);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [loading]);

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
  
  const generateAdvice = async () => {
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
- Categories over budget: ${overBudget.length > 0 ? overBudget.join(", ") : "None"}`;

      // SECURITY FIX: No external API calls — mock service only
      const result = await callAIService(prompt);
      
      setAdvice(result);
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
  };
  
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
- Current savings rate: ${savingsRate.toFixed(1)}%`;
      
      const result = await callAIService(prompt);
      
      setReport(result);
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
  }, [transactions.length]);
  
  if (transactions.length === 0) {
    return (
      <div className="ai-advisor-card">
        <div className="ai-advisor-header">
          <span className="ai-advisor-badge">Your Financial Advisor</span>
          <span className="ai-advisor-status offline">⏸ No Data</span>
        </div>
        <div className="ai-advisor-summary">Upload transactions to get personalized financial advice.</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Your advisor will analyze your spending patterns and suggest improvements.</div>
      </div>
    );
  }
  
  const statusClass = aiStatus === "live" ? "live" : 
                      aiStatus === "thinking" ? "thinking" : 
                      aiStatus === "error" || aiStatus === "offline" ? "error" : "ready";
  
  return (
    <div>
      <div className="ai-advisor-card">
        <div className="ai-advisor-header">
          <span className="ai-advisor-badge">Your Financial Advisor</span>
          <span className={`ai-advisor-status ${statusClass}`}>
            {aiStatus === "thinking" ? "⏳ Thinking" : 
             aiStatus === "live" ? "✓ Live" : 
             aiStatus === "error" ? "✗ Offline" : 
             aiStatus === "offline" ? "⏸ No Data" : "Ready"}
          </span>
          <button className="ai-advisor-refresh" onClick={generateAdvice} disabled={loading}>
            {loading ? "⏳" : "⟳ Refresh Advice"}
          </button>
        </div>
        
        {loading ? (
          <div>
            <div className="ai-report-loading">
              <div className="spinner" />
            </div>
            <div className="ai-thought">{thoughtMessages[thoughtIndex]}</div>
          </div>
        ) : advice ? (
          <>
            <div className="ai-advisor-summary">💡 {advice.summary}</div>
            <div className="ai-advisor-opportunity">📌 {advice.opportunity}</div>
            <div className="ai-advisor-encouragement">🌟 {advice.encouragement}</div>
          </>
        ) : null}
      </div>
      
      <div style={{ marginBottom: 24 }}>
        <button className="btn-outline" onClick={() => setShowReport(!showReport)}>
          📊 {showReport ? "Hide" : "Generate"} Weekly Report
        </button>
      </div>
      
      {showReport && (
        <div className="ai-report-card">
          <div className="card-title">📊 Weekly Spending Report</div>
          {reportLoading ? (
            <div className="ai-report-loading">
              <div className="spinner" />
              <div style={{ marginTop: 12 }}>Generating your report...</div>
            </div>
          ) : report ? (
            <div className="ai-report-content">
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

// ─── FINANCIAL HEALTH ──────────────────────────────────────────────────────

function FinancialHealth({ transactions, incomes, goals, budgets, currency }) {
  const health = calculateFinancialHealth(transactions, incomes, goals, budgets);
  
  if (!health.hasData) {
    return (
      <div className="health-score-card">
        <div className="health-no-data">
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div className="empty-text">No financial data yet</div>
          <div className="empty-sub">Upload transactions or add income to see your financial health score</div>
        </div>
      </div>
    );
  }
  
  const scoreColor = health.score >= 70 ? "var(--primary)" : health.score >= 40 ? "var(--warning)" : "var(--error)";
  
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
  
  // Check if savings rate hit 20% for pulse animation
  const shouldPulse = health.savingsRate >= 20;
  
  return (
    <div className="health-score-card">
      <div className="health-score-main">
        <div className="health-score-circle" style={{ background: scoreColor }}>
          {health.score}
          <span className="grade">Grade {health.grade}</span>
        </div>
        <div className="health-score-details">
          <div className="health-metric" title="Percentage of income saved this month">
            <div className="health-metric-label">Savings Rate</div>
            <div className="health-metric-value" style={shouldPulse ? { animation: 'pulseGold 0.8s ease' } : {}}>
              {health.savingsRate}%
            </div>
            <div className="health-metric-bar"><div className="health-metric-bar-fill" style={{ width: `${health.savingsScore}%`, background: "var(--primary)" }} /></div>
          </div>
          <div className="health-metric" title="How well you're sticking to your budget limits">
            <div className="health-metric-label">Budget</div>
            <div className="health-metric-value">{health.budgetScore}%</div>
            <div className="health-metric-bar"><div className="health-metric-bar-fill" style={{ width: `${health.budgetScore}%`, background: "var(--primary)" }} /></div>
          </div>
          <div className="health-metric" title="How consistent your spending is month to month">
            <div className="health-metric-label">Stability</div>
            <div className="health-metric-value">{health.stabilityScore}%</div>
            <div className="health-metric-bar"><div className="health-metric-bar-fill" style={{ width: `${health.stabilityScore}%`, background: "var(--primary)" }} /></div>
          </div>
          <div className="health-metric" title="Progress toward your savings goals">
            <div className="health-metric-label">Goals</div>
            <div className="health-metric-value">{health.goalScore}%</div>
            <div className="health-metric-bar"><div className="health-metric-bar-fill" style={{ width: `${health.goalScore}%`, background: "var(--primary)" }} /></div>
          </div>
        </div>
      </div>
      
      <div className={`risk-meter`}>
        <div className={`risk-dot ${health.riskLevel}`} />
        <span className="risk-label">{health.riskLabel}</span>
        {health.riskFactors.length > 0 && (
          <span className="risk-factors">• {health.riskFactors.join(" • ")}</span>
        )}
        {health.riskFactors.length === 0 && health.hasData && (
          <span className="risk-factors">• All metrics look good!</span>
        )}
      </div>
      
      {insights.length > 0 && (
        <div className="insight-cards">
          {insights.map((insight, idx) => (
            <div key={idx} className="insight-mini-card">
              <span className="icon">{insight.icon}</span>
              <span className="text">{insight.text}</span>
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

// ─── WHAT-IF PAGE ─────────────────────────────────────────────────────────────

function WhatIfPage({ transactions, incomes, currency, customScenarios, onAddScenario, onDeleteScenario }) {
  const [habitName, setHabitName] = useState("");
  const [habitDays, setHabitDays] = useState(30);
  const [habitCost, setHabitCost] = useState("");
  const [habitTimesPerWeek, setHabitTimesPerWeek] = useState(1);
  const [reduceCategory, setReduceCategory] = useState("Groceries");
  const [reducePercent, setReducePercent] = useState(10);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customForm, setCustomForm] = useState({ action: "", amount: "", frequency: "monthly", duration: "", durationUnit: "months" });
  const [sliderValue, setSliderValue] = useState(10);
  const [showTooltip, setShowTooltip] = useState(false);
  
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
  
  const [isAddingScenario, setIsAddingScenario] = useState(false);
  const handleAddCustomScenario = () => {
    if (!customForm.action || !customForm.amount) return;
    setIsAddingScenario(true);
    const result = calculateCustomScenario(customForm);
    onAddScenario({
      id: Date.now(),
      ...customForm,
      amount: parseFloat(customForm.amount),
      duration: parseInt(customForm.duration) || 1,
      calculatedTotal: result.total
    });
    setTimeout(() => {
      setCustomForm({ action: "", amount: "", frequency: "monthly", duration: "", durationUnit: "months" });
      setShowCustomModal(false);
      setIsAddingScenario(false);
    }, 1000);
  };
  
  // Slider tooltip micro-interaction
  const handleSliderChange = (e) => {
    const val = parseInt(e.target.value);
    setSliderValue(val);
    setReducePercent(val);
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
          <div className="whatif-field" style={{ position: "relative" }}>
            <label>Reduce by (%)</label>
            <div style={{ position: "relative", width: "100%" }}>
              <input 
                type="range" 
                min="0" 
                max="50" 
                value={sliderValue} 
                onChange={handleSliderChange}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                style={{ width: "100%", cursor: "pointer", height: "6px", background: "var(--border)", borderRadius: "4px", outline: "none" }}
              />
              {showTooltip && (
                <div className="slider-tooltip">{sliderValue}%</div>
              )}
            </div>
            <span style={{ marginLeft: 8, fontWeight: 600 }}>{reducePercent}%</span>
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
            <div className="modal-actions"><button className="btn-cancel" onClick={() => setShowCustomModal(false)}>Cancel</button><button className={`btn-save ${isAddingScenario ? "btn-loading" : ""}`} onClick={handleAddCustomScenario}>{isAddingScenario ? "" : "Add Scenario"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────

function Dashboard({ user, transactions, goals, incomes, budgets, onUpdateBudget, onAddIncome, onDeleteIncome, currency, onCurrencyChange, showToast }) {
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showCreditedBreakdown, setShowCreditedBreakdown] = useState(false);
  const [incomeForm, setIncomeForm] = useState({ source: "Salary", amount: "", label: "", date: new Date().toISOString().split("T")[0] });
  const [budgetForm, setBudgetForm] = useState(DEFAULT_CATEGORIES.map(c => ({ category: c.name, amount: budgets.find(b => b.category === c.name)?.amount || "" })));
  const [customCategories, setCustomCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [currencyConfirmShown, setCurrencyConfirmShown] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("all");
  
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
  
  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const handleAddIncome = () => {
    if (!incomeForm.amount || incomeForm.amount <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }
    setIsAddingIncome(true);
    onAddIncome({
      id: Date.now(),
      source: incomeForm.source,
      amount: parseFloat(incomeForm.amount),
      label: incomeForm.label || "",
      date: incomeForm.date
    });
    setTimeout(() => {
      setIncomeForm({ source: "Salary", amount: "", label: "", date: new Date().toISOString().split("T")[0] });
      setShowIncomeModal(false);
      setIsAddingIncome(false);
    }, 800);
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
          {incomes.map(inc => (<div key={inc.id} className="income-row"><div><span className="income-type-badge">{inc.source}</span>{inc.label && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>— {inc.label}</span>}<div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{inc.date}</div></div><div><span className="income-amount">{formatMoney(inc.amount, currency)}</span><button className="income-delete" onClick={() => onDeleteIncome(inc.id)}>✕</button></div></div>))}
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
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{tx.date}</div>
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
              const percent = (spent / b.amount) * 100;
              const isOver = spent > b.amount;
              const isNearLimit = percent >= 90 && percent <= 100;
              const barClass = isNearLimit ? 'budget-bar near-limit' : 'budget-bar';
              const fillClass = isOver ? 'budget-fill red' : isNearLimit ? 'budget-fill yellow' : 'budget-fill green';
              // Staggered animation delay
              const delay = idx * 100;
              return (<div key={b.category} className="budget-item"><div className="budget-header"><span className="budget-name">{b.category}</span><span className="budget-amount">{formatMoney(spent, currency)} / {formatMoney(b.amount, currency)}</span></div><div className={barClass}><div className={`${fillClass} animate`} style={{ '--bar-width': `${Math.min(percent, 100)}%`, width: `${Math.min(percent, 100)}%`, animationDelay: `${delay}ms` }} /></div>{percent > 90 && <div className="budget-warning">{percent > 100 ? "⚠️ Over budget!" : "⚠️ Near limit"}</div>}</div>);
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
      
      {showIncomeModal && (<div className="modal-overlay" onClick={() => setShowIncomeModal(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-title">Add Income</div><label className="modal-label">Source Type</label><select className="modal-input" value={incomeForm.source} onChange={e => setIncomeForm(f => ({ ...f, source: e.target.value }))} style={{ appearance: "auto" }}>{incomeSources.map(s => <option key={s} value={s}>{s}</option>)}</select><label className="modal-label">Amount ({CURRENCIES[currency]?.symbol || "P"})</label><input className="modal-input" type="number" placeholder="e.g. 5000" step="0.01" value={incomeForm.amount} onChange={e => setIncomeForm(f => ({ ...f, amount: e.target.value }))} /><label className="modal-label">Label (optional)</label><input className="modal-input" placeholder="e.g. Freelance project" value={incomeForm.label} onChange={e => setIncomeForm(f => ({ ...f, label: e.target.value }))} /><label className="modal-label">Date</label><input className="modal-input" type="date" value={incomeForm.date} onChange={e => setIncomeForm(f => ({ ...f, date: e.target.value }))} /><div className="modal-actions"><button className="btn-cancel" onClick={() => setShowIncomeModal(false)}>Cancel</button><button className={`btn-save ${isAddingIncome ? "btn-loading" : ""}`} onClick={handleAddIncome}>{isAddingIncome ? "" : "Add Income"}</button></div></div></div>)}
      
      {showBudgetModal && (<div className="modal-overlay" onClick={() => setShowBudgetModal(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}><div className="modal-title">Set Monthly Budgets</div><p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Set your spending limits for each category. Click "Save All Budgets" when done.</p>
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

// ─── UPLOAD PAGE ─────────────────────────────────────────────────────────────

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
  
  const [isAdding, setIsAdding] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleAddMultipleTransactions = () => {
    const validTx = multipleTransactions.filter(t => t.description && t.amount && t.amount > 0);
    if (validTx.length === 0) {
      showToast("Please fill in at least one transaction", "error");
      return;
    }
    setIsAdding(true);
    setTimeout(() => {
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
      setIsAdding(false);
    }, 600);
  };
  
  // SECURITY FIX: PDF upload now shows warning instead of generating fake data
  const handleFile = (file) => {
    if (!file) return;
    
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      showToast("📄 Please use CSV format. PDF extraction is not supported — upload a CSV file instead.");
      return;
    }
    
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
      showToast(`"${filename}" has already been imported.`, "error");
      return;
    }
    setIsConfirming(true);
    onUpload(transactions, fileKey, filename);
    // State will be cleared by parent effect or naturally as we navigate
  };
  
  const handleDrop = (e) => { e.preventDefault(); setDragover(false); handleFile(e.dataTransfer.files[0]); };
  
  return (
    <div>
      <div className="page-header">
        <div className="greeting" style={{ fontSize: 24 }}>Upload & Add Transactions</div>
        <div className="greeting-tagline">Import bank statements (CSV format only) or add transactions manually</div>
      </div>
      
      {!preview && !csvPreview ? (
        <>
          <div className={`upload-zone ${dragover ? "dragover" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragover(true); }} onDragLeave={() => setDragover(false)} onDrop={handleDrop} onClick={() => fileRef.current.click()}>
            <div className="upload-icon">📂</div><div className="upload-title">Drop your bank statement here</div>
            <div className="upload-sub"><strong>CSV files</strong> only. PDF support is not available.</div>
            <button className="btn-upload" onClick={e => { e.stopPropagation(); fileRef.current.click(); }}>Choose File</button>
            <div className="format-pills"><span className="format-pill">CSV ✓</span><span className="format-pill">PDF ✗</span></div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
          </div>
          
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-title">✏️ Add Multiple Transactions</div>
            <button className="btn-save" onClick={() => setShowAddModal(true)} style={{ width: "100%" }}>+ Add Transaction(s)</button>
          </div>
          
          <div className="card scan-card">
            <div className="card-title">📷 Scan a Receipt</div>
            <div style={{ textAlign: "center", padding: "20px" }}>
              <div className="empty-icon">📸</div>
              <div className="empty-text">Coming soon</div>
              <div className="empty-sub">Receipt scanning with OCR is in development and will be available in a future update.</div>
            </div>
          </div>
          
          {uploadedFiles.length > 0 && (<div className="card"><div className="card-title">📋 Upload History</div><div className="upload-history">{uploadedFiles.map((f, i) => (<div key={i} className="history-item"><span>{f.name}</span><span>{new Date(f.dateUploaded).toLocaleDateString()} · {f.txCount} transactions</span></div>))}</div></div>)}
        </>
      ) : (
        <div>
          <div className="card" style={{ marginBottom: 20 }}><div className="card-title">Preview — {(preview?.filename || csvPreview?.filename)}</div><p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>Found {(preview?.transactions || csvPreview?.transactions).length} transactions. Review and confirm below.</p>
            <div className="tx-list">{(preview?.transactions || csvPreview?.transactions).map((t, i) => { const cat = t.customCategory || t.category; const catObj = DEFAULT_CATEGORIES.find(c => c.name === cat) || { color: "#CBD5E0", icon: "📦" }; return (<div key={i} className="tx-item"><div className="tx-icon" style={{ background: catObj.color + "20" }}>{catObj.icon}</div><div className="tx-info"><div className="tx-name">{t.description}</div><div className="tx-date">{t.date}</div></div><span className="cat-badge" style={{ background: catObj.color + "20", color: catObj.color }}>{cat}</span><div className={`tx-amount ${t.type}`}>{t.type === "debit" ? "-" : "+"}{formatMoney(t.amount, currency)}</div></div>);})}</div>
          </div>
          <div style={{ display: "flex", gap: 12 }}><button className="btn-cancel" onClick={() => { setPreview(null); setCsvPreview(null); }}>Cancel</button><button className={`btn-save ${isConfirming ? "btn-loading" : ""}`} onClick={() => handleConfirmUpload(preview?.transactions || csvPreview?.transactions, preview?.fileKey || csvPreview?.fileKey, preview?.filename || csvPreview?.filename)}>{isConfirming ? "" : "Confirm & Save →"}</button></div>
        </div>
      )}
      
      {showAddModal && (<div className="modal-overlay" onClick={() => setShowAddModal(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: "80vh", overflowY: "auto" }}><div className="modal-title">Add Multiple Transactions</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Add multiple transactions at once. All fields are editable.</p>
        {multipleTransactions.map((tx, idx) => (
          <div key={tx.id} style={{ background: "var(--bg)", padding: 12, borderRadius: 4, marginBottom: 12, border: "1px solid var(--border)" }}>
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
        <div className="modal-actions"><button className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button><button className={`btn-save ${isAdding ? "btn-loading" : ""}`} onClick={handleAddMultipleTransactions}>{isAdding ? "" : `Save All (${multipleTransactions.filter(t => t.description && t.amount).length} valid)`}</button></div>
      </div></div>)}
    </div>
  );
}

// ─── TRANSACTIONS PAGE ─────────────────────────────────────────────────────

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
    // Clear selection after recategorisation
    setTransactions(transactions.map(tx => selectedTxIds.has(tx.id) ? { ...tx, category: newCategory } : tx));
    setSelectedTxIds(new Set());
    setBulkMode(false);
    showToast(`Updated ${selectedTxIds.size} transactions`);
  };
  
  const handleBulkDelete = () => {
    if (window.confirm(`Delete ${selectedTxIds.size} transactions?`)) {
      setTransactions(transactions.filter(tx => !selectedTxIds.has(tx.id)));
      setSelectedTxIds(new Set());
      setBulkMode(false);
      showToast(`Deleted ${selectedTxIds.size} transactions`);
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
  
  // Clear selection when filter changes (UX fix)
  useEffect(() => {
    setSelectedTxIds(new Set());
  }, [activeFilter, search]);
  
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
      
      {showCalendar && (<div className="card" style={{ marginBottom: 20 }}><div className="card-title">📅 Calendar View - {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</div><div className="calendar-grid">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (<div key={d} className="calendar-day-header">{d}</div>))}{getMonthTransactions().map((day, idx) => (<div key={idx} className="calendar-day">{day ? (<><div className="calendar-day-num">{day.day}</div>{day.transactions.slice(0, 3).map(tx => (<div key={tx.id} className={`calendar-tx ${tx.type}`} title={`${tx.description}: ${formatMoney(tx.amount, currency)}`}>{tx.description.substring(0, 12)}</div>))}{day.transactions.length > 3 && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>+{day.transactions.length - 3} more</div>}</>) : null}</div>))}</div></div>)}
      
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
      
      {showSplitModal && (<div className="modal-overlay" onClick={() => setShowSplitModal(null)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}><div className="modal-title">Split Transaction</div><div style={{ background: "var(--bg)", padding: 12, borderRadius: 4, marginBottom: 16 }}><div>Original: {showSplitModal.description}</div><div style={{ fontWeight: 700 }}>Amount: {formatMoney(showSplitModal.amount, currency)}</div></div>{splitLines.map((line, idx) => (<div key={idx} className="split-line"><div className="split-header"><span className="split-title">Split {idx + 1}</span>{splitLines.length > 1 && <button className="split-remove" onClick={() => setSplitLines(splitLines.filter((_, i) => i !== idx))}>✕</button>}</div><div className="split-fields"><input placeholder="Description" value={line.description} onChange={e => { const newLines = [...splitLines]; newLines[idx].description = e.target.value; setSplitLines(newLines); }} /><input type="number" step="0.01" placeholder="Amount" value={line.amount} onChange={e => { const newLines = [...splitLines]; newLines[idx].amount = e.target.value; setSplitLines(newLines); }} /><select value={line.category} onChange={e => { const newLines = [...splitLines]; newLines[idx].category = e.target.value; setSplitLines(newLines); }}>{DEFAULT_CATEGORIES.map(c => (<option key={c.name} value={c.name}>{c.icon} {c.name}</option>))}</select></div></div>))}<button className="btn-outline" style={{ width: "100%", marginBottom: 12 }} onClick={() => setSplitLines([...splitLines, { description: "", amount: "", category: "Other" }])}>+ Add Split Line</button><div className="split-total"><span>Total allocated:</span><span>{formatMoney(splitLines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0), currency)}</span></div><div className="split-total"><span>Unallocated:</span><span className="split-remainder">{formatMoney(showSplitModal.amount - splitLines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0), currency)}</span></div><div className="modal-actions"><button className="btn-cancel" onClick={() => setShowSplitModal(null)}>Cancel</button><button className="btn-save" onClick={() => handleSaveSplit(showSplitModal)}>Save Split</button></div></div></div>)}
      
      {showEditModal && (<div className="modal-overlay" onClick={() => setShowEditModal(null)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}><div className="modal-title">Edit Transaction</div><label className="modal-label">Description</label><input className="modal-input" placeholder="Description" defaultValue={showEditModal.description} id="edit-desc" /><label className="modal-label">Amount ({CURRENCIES[currency]?.symbol || "P"})</label><input className="modal-input" type="number" step="0.01" defaultValue={showEditModal.amount} id="edit-amount" /><label className="modal-label">Date</label><input className="modal-input" type="date" defaultValue={showEditModal.date} id="edit-date" /><label className="modal-label">Type</label><div style={{ display: "flex", gap: 8, marginBottom: 16 }}><button className={`auth-tab ${showEditModal.type === "debit" ? "active" : ""}`} id="edit-type-debit">Debit</button><button className={`auth-tab ${showEditModal.type === "credit" ? "active" : ""}`} id="edit-type-credit">Credit</button></div><label className="modal-label">Category</label><div className="category-grid" id="edit-category-grid">{DEFAULT_CATEGORIES.map(cat => (<button key={cat.name} className={`category-pill ${showEditModal.category === cat.name ? "active" : ""}`} data-cat={cat.name}><span>{cat.icon}</span> {cat.name}</button>))}</div>{showEditModal.category === "Other" && (<><label className="modal-label">Custom Category Name</label><input className="modal-input" placeholder="e.g., Fuel, Gift" defaultValue={showEditModal.customCategory || ""} id="edit-custom-cat" /></>)}<div className="modal-actions"><button className="btn-cancel" onClick={() => setShowEditModal(null)}>Cancel</button><button className="btn-save" onClick={() => { const newDesc = document.getElementById("edit-desc").value; const newAmount = parseFloat(document.getElementById("edit-amount").value); const newDate = document.getElementById("edit-date").value; let newType = showEditModal.type; if (document.getElementById("edit-type-debit").classList.contains("active")) newType = "debit"; if (document.getElementById("edit-type-credit").classList.contains("active")) newType = "credit"; const activeCat = Array.from(document.querySelectorAll("#edit-category-grid .category-pill.active"))[0]; const newCategory = activeCat ? activeCat.getAttribute("data-cat") : "Other"; const newCustomCat = document.getElementById("edit-custom-cat")?.value || ""; if (!newDesc || !newAmount) { showToast("Please fill in all fields"); return; } handleEditTransaction(showEditModal.id, { ...showEditModal, description: newDesc, amount: newAmount, date: newDate, type: newType, category: newCategory, customCategory: newCustomCat }); }}>Save Changes</button></div></div></div>)}
      
      {showExplanation && (<div className="modal-overlay" onClick={() => setShowExplanation(null)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}><div className="modal-title">🤖 AI Transaction Explanation</div><div style={{ background: "var(--bg)", padding: 16, borderRadius: 4, marginBottom: 16 }}><div><strong>Transaction:</strong> {showExplanation.description}</div><div><strong>Amount:</strong> {formatMoney(showExplanation.amount, currency)}</div><div><strong>Category:</strong> {showExplanation.category}</div></div><div className="tx-explanation"><div className="tx-explanation-label">AI Analysis</div>{explanationLoading ? (<div className="ai-report-loading"><div className="spinner" /><div style={{ marginTop: 12 }}>Analyzing transaction...</div></div>) : (<div className="tx-explanation-text">{explanationText}</div>)}</div><div className="modal-actions"><button className="btn-cancel" onClick={() => setShowExplanation(null)}>Close</button></div></div></div>)}
    </div>
  );
}

// ─── INSIGHTS PAGE ───────────────────────────────────────────────────────────

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
    <div className="insight-card" style={{ background: savings > 0 ? "linear-gradient(135deg, var(--primary)20, var(--secondary))" : "linear-gradient(135deg, var(--error)20, var(--secondary))" }}>
      <div className="insight-label">{savings > 0 ? "💰 Savings" : "📊 Spending"}</div>
      <div className="insight-text">
        {savings > 0 
          ? `You've saved ${formatMoney(savings, currency)} this period. At this rate, you'd save ${formatMoney(savings * 12, currency)} in a year! 🎉`
          : `Your spending (${formatMoney(totalSpent, currency)}) exceeds your income (${formatMoney(totalCredit, currency)}). Consider reviewing your expenses.`
        }
      </div>
    </div>
  )}
  
  <div className="dashboard-grid"><div className="card"><div className="card-title">Top Categories</div>{topCats.length === 0 ? (<div className="empty-state"><div className="empty-icon">📊</div><div className="empty-text">Upload your first statement to get started</div></div>) : topCats.map(([name, val], i) => { const cat = DEFAULT_CATEGORIES.find(c => c.name === name) || { color: "#CBD5E0", icon: "📦" }; const pct = totalSpent > 0 ? (val / totalSpent) * 100 : 0; return (<div key={i} style={{ marginBottom: 16 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{cat.icon} {name}</span><span style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{formatMoney(val, currency)}</span></div><div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: cat.color }} /></div></div>); })}</div><div className="card"><div className="card-title">💰 Recurring Subscriptions</div>{subscriptions.length === 0 ? (<div className="empty-state"><div className="empty-icon">🔄</div><div className="empty-text">No recurring transactions detected yet</div><div className="empty-sub">Add at least 2 transactions with the same description</div></div>) : (<>{subscriptions.map((s, i) => (<div key={i} className="sub-item"><div><div className="sub-name">{s.name}</div><div className="sub-freq">{s.frequency} · {s.occurrences} occurrences</div></div><div><div className="sub-amount" style={{ color: "var(--primary)" }}>{formatMoney(s.monthlyCost, currency)}/mo</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatMoney(s.annualCost, currency)}/year</div></div></div>))}<div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)", textAlign: "right" }}><div className="stat-label">Estimated annual subscription spend</div><div className="stat-value" style={{ fontSize: 20 }}>{formatMoney(totalAnnualSubs, currency)}</div></div></>)}</div></div><div className="card" style={{ marginTop: 20 }}><div className="card-title">📈 Spending Patterns</div><div style={{ marginBottom: 24 }}><div style={{ fontWeight: 600, marginBottom: 12, color: "var(--text)" }}>Anomaly Detection</div><div className="insight-card" style={{ background: anomaly.isAnomaly ? "linear-gradient(135deg, var(--error)20, var(--secondary))" : "linear-gradient(135deg, var(--secondary) 0%, #0F0F1A 100%)", marginBottom: 0 }}><div className="insight-text" style={{ maxWidth: "100%" }}>{anomaly.message}</div></div></div>{timing && (<div><div style={{ fontWeight: 600, marginBottom: 12, color: "var(--text)" }}>Timing Insights</div><div className="timing-bar-chart">{timing.barData.map((day, idx) => (<div key={idx} className="timing-bar-row"><div className="timing-bar-label">{day.label}</div><div className="timing-bar-bg"><div className="timing-bar-fill" style={{ width: `${day.percent}%` }}>{day.percent > 20 && formatMoney(day.value, currency)}</div></div></div>))}</div><div className="whatif-output" style={{ marginTop: 16 }}><div className="whatif-output-text">You spend most on <strong>{timing.highestDay}</strong>.</div>{timing.earlyMonthInsight && <div className="whatif-output-text" style={{ marginTop: 8, color: "var(--warning)" }}>{timing.earlyMonthInsight}</div>}{timing.lateMonthInsight && <div className="whatif-output-text" style={{ marginTop: 4, color: "var(--warning)" }}>{timing.lateMonthInsight}</div>}</div></div>)}</div></div>);
}

// ─── GOALS PAGE ──────────────────────────────────────────────────────────────

function GoalsPage({ goals, onAdd, onContribute, currency, showToast }) {
  const [showModal, setShowModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(null);
  const [contributeAmount, setContributeAmount] = useState("");
  const [form, setForm] = useState({ name: "", target: "", deadline: "", emoji: "🎯" });
  const emojis = ["🎯","✈️","🏠","🚗","📱","💍","🎓","💼","🏋️","🎸"];
  
  const [isSaving, setIsSaving] = useState(false);
  const [isContributing, setIsContributing] = useState(false);

  const handleSave = () => { 
    if (!form.name || !form.target) return; 
    setIsSaving(true);
    onAdd({ ...form, target: parseFloat(form.target), saved: 0, id: Date.now() }); 
    setTimeout(() => {
      setShowModal(false); 
      setIsSaving(false);
      setForm({ name: "", target: "", deadline: "", emoji: "🎯" }); 
    }, 800);
  };
  
  const handleContribute = (goalId) => {
    const amount = parseFloat(contributeAmount);
    if (!amount || amount <= 0) { showToast("Please enter a valid amount", "error"); return; }
    setIsContributing(true);
    onContribute(goalId, amount);
    setTimeout(() => {
      setShowContributeModal(null);
      setIsContributing(false);
      setContributeAmount("");
    }, 800);
  };
  
  return (<div><div className="page-header"><div className="greeting" style={{ fontSize: 24 }}>Goals</div><div className="greeting-tagline">Track what you're saving toward</div></div><div className="goals-grid">{goals.length === 0 && (<div style={{ gridColumn: "1/-1" }}><div className="empty-state" style={{ padding: "60px 20px" }}><div className="empty-icon">🎯</div><div className="empty-text">No goals yet. Add one.</div><div className="empty-sub">Set a saving target and track your progress</div></div></div>)}{goals.map((g) => { const pct = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0; const weekly = g.deadline ? Math.max(0, (g.target - g.saved) / Math.max(1, Math.ceil((new Date(g.deadline) - new Date()) / (7 * 86400000)))) : null; return (<div key={g.id} className="goal-card"><div className="goal-header"><div className="goal-name">{g.name}</div><div className="goal-emoji">{g.emoji}</div></div><div className="goal-amounts"><div className="goal-saved">{formatMoney(g.saved, currency)}</div><div className="goal-target">of {formatMoney(g.target, currency)}</div></div><div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div><div className="goal-meta">{pct.toFixed(0)}% complete{weekly !== null && ` · Save ${formatMoney(weekly, currency)}/week`}{g.deadline && ` · Due ${g.deadline}`}</div><button className="btn-outline" style={{ marginTop: 12, width: "100%" }} onClick={() => setShowContributeModal(g)}>+ Add to Goal</button></div>); })}<button className="add-goal-card" onClick={() => setShowModal(true)}><div className="add-goal-icon">+</div><div className="add-goal-text">Add a goal</div></button></div>
  {showModal && (<div className="modal-overlay" onClick={() => setShowModal(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-title">New Saving Goal</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>{emojis.map(e => (<button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))} style={{ fontSize: 22, background: form.emoji === e ? "var(--primary)20" : "none", border: `1px solid ${form.emoji === e ? "var(--primary)" : "var(--border)"}`, borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}>{e}</button>))}</div><label className="modal-label">Goal Name</label><input className="modal-input" placeholder="e.g. Trip to Cape Town" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /><label className="modal-label">Target Amount ({CURRENCIES[currency]?.symbol || "P"})</label><input className="modal-input" type="number" placeholder="5000" step="0.01" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} /><label className="modal-label">Deadline (optional)</label><input className="modal-input" type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} /><div className="modal-actions"><button className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button><button className={`btn-save ${isSaving ? "btn-loading" : ""}`} onClick={handleSave}>{isSaving ? "" : "Save Goal"}</button></div></div></div>)}
  {showContributeModal && (<div className="modal-overlay" onClick={() => setShowContributeModal(null)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-title">Add to {showContributeModal.name}</div><label className="modal-label">Amount to contribute ({CURRENCIES[currency]?.symbol || "P"})</label><input className="modal-input" type="number" step="0.01" placeholder="0.00" value={contributeAmount} onChange={e => setContributeAmount(e.target.value)} /><div className="modal-actions"><button className="btn-cancel" onClick={() => setShowContributeModal(null)}>Cancel</button><button className={`btn-save ${isContributing ? "btn-loading" : ""}`} onClick={() => handleContribute(showContributeModal.id)}>{isContributing ? "" : "Contribute"}</button></div></div></div>)}</div>);
}

// ─── SETTINGS PAGE ───────────────────────────────────────────────────────────

function SettingsPage({ user, onLogout, onClearData, currency, onCurrencyChange, theme, onThemeChange, textSize, onTextSizeChange, transactions, goals, incomes, budgets, customScenarios, onRestoreData, showToast }) {
  const [currencyConfirmShown, setCurrencyConfirmShown] = useState(false);
  const handleCurrencyChange = (newCurrency) => { if (!currencyConfirmShown) { showToast(`✅ Currency selected: ${CURRENCIES[newCurrency].name}. All amounts will be treated and registered as ${CURRENCIES[newCurrency].symbol}.`); setCurrencyConfirmShown(true); } onCurrencyChange(newCurrency); };
  
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleBackup = () => {
    setIsBackingUp(true);
    setTimeout(() => {
      const backupData = { transactions, goals, incomes, budgets, customScenarios, currency, theme, textSize, version: "1.0", exportDate: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `spendsight_backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setIsBackingUp(false);
      showToast("Backup created!");
    }, 1000);
  };
  
  const handleRestore = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setTimeout(() => {
        try {
          const data = JSON.parse(ev.target.result);
          onRestoreData(data);
          showToast("Data restored successfully!");
        } catch (err) { showToast("Invalid backup file", "error"); }
        setIsRestoring(false);
      }, 1500);
    };
    reader.readAsText(file);
  };
  
  return (<div><div className="page-header"><div className="greeting" style={{ fontSize: 24 }}>Settings</div><div className="greeting-tagline">Manage your SpendSight preferences</div></div>
    <div className="settings-section"><div className="settings-title">Account</div><div className="settings-card"><div className="settings-row"><div><div className="settings-row-label">Name</div><div className="settings-row-sub">{user.name}</div></div></div><div className="settings-row"><div><div className="settings-row-label">Email</div><div className="settings-row-sub">{user.email}</div></div></div></div></div>
    <div className="settings-section"><div className="settings-title">Preferences</div><div className="settings-card"><div className="settings-row"><div><div className="settings-row-label">Currency</div><div className="settings-row-sub">All amounts stored and displayed in your chosen currency</div></div><select className="settings-select" value={currency} onChange={e => handleCurrencyChange(e.target.value)}>{Object.entries(CURRENCIES).map(([code, c]) => (<option key={code} value={code}>{c.name}</option>))}</select></div><div className="settings-row"><div><div className="settings-row-label">Text Size</div><div className="settings-row-sub">Adjust font size throughout the app</div></div><div className="text-size-selector"><button className={`size-btn ${textSize === "small" ? "active" : ""}`} onClick={() => onTextSizeChange("small")}>A⁻</button><button className={`size-btn ${textSize === "normal" ? "active" : ""}`} onClick={() => onTextSizeChange("normal")}>A</button><button className={`size-btn ${textSize === "large" ? "active" : ""}`} onClick={() => onTextSizeChange("large")}>A⁺</button><button className={`size-btn ${textSize === "xlarge" ? "active" : ""}`} onClick={() => onTextSizeChange("xlarge")}>A⁺⁺</button></div></div><div className="settings-row"><div><div className="settings-row-label">Theme</div><div className="settings-row-sub">Choose your display preference</div></div><div className="theme-toggle"><button className={`theme-toggle-btn ${theme === "light" ? "active" : ""}`} onClick={() => onThemeChange("light")}>☀️ Light</button><button className={`theme-toggle-btn ${theme === "system" ? "active" : ""}`} onClick={() => onThemeChange("system")}>Auto</button><button className={`theme-toggle-btn ${theme === "dark" ? "active" : ""}`} onClick={() => onThemeChange("dark")}>🌙 Dark</button></div></div></div></div>
    <div className="settings-section"><div className="settings-title">Data</div><div className="settings-card"><div className="settings-row"><div><div className="settings-row-label">Backup Data</div><div className="settings-row-sub">Download all your data as JSON</div></div><button className={`btn-outline ${isBackingUp ? "btn-loading" : ""}`} onClick={handleBackup}>{isBackingUp ? "" : "Backup"}</button></div><div className="settings-row"><div><div className="settings-row-label">Restore Data</div><div className="settings-row-sub">Upload a backup file to restore</div></div><input type="file" accept=".json" onChange={handleRestore} style={{ display: "none" }} id="restore-input" /><button className={`btn-outline ${isRestoring ? "btn-loading" : ""}`} onClick={() => document.getElementById("restore-input").click()}>{isRestoring ? "" : "Restore"}</button></div><div className="settings-row"><div><div className="settings-row-label">Export CSV</div><div className="settings-row-sub">Download all transactions as CSV</div></div><button className="btn-outline" onClick={() => { const csv = ["Date,Description,Amount,Type,Category,Tags,Notes", ...transactions.map(t => `${t.date},${t.description},${t.amount},${t.type},${t.customCategory || t.category},${(t.tags || []).join(";")},${t.notes || ""}`)].join("\n"); const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `spendsight_export_${new Date().toISOString().split("T")[0]}.csv`; a.click(); URL.revokeObjectURL(url); showToast("Export complete!"); }}>Export CSV</button></div><div className="settings-row"><div><div className="settings-row-label">Clear All Data</div><div className="settings-row-sub">Permanently delete all transactions, goals, and budgets</div></div><button className="btn-danger" onClick={onClearData}>Clear Data</button></div></div></div>
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
  const [processing, setProcessing] = useState({ active: false, text: "", type: "loading" }); // loading or success
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const lastActivityRef = useRef(Date.now());
  
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
  
  useEffect(() => {
    if (!user) return;
    const resetTimer = () => { lastActivityRef.current = Date.now(); if (sessionExpired) setSessionExpired(false); };
    const events = ["mousemove", "keydown", "touchstart", "click"];
    events.forEach(event => document.addEventListener(event, resetTimer));
    const interval = setInterval(() => { if (Date.now() - lastActivityRef.current > 15 * 60 * 1000 && !sessionExpired) setSessionExpired(true); }, 60000);
    return () => { events.forEach(event => document.removeEventListener(event, resetTimer)); clearInterval(interval); };
  }, [user, sessionExpired]);
  
  useEffect(() => { const html = document.documentElement; html.classList.remove("text-small", "text-normal", "text-large", "text-xlarge"); html.classList.add(`text-${textSize}`); }, [textSize]);
  useEffect(() => { const html = document.documentElement; if (theme === "dark") html.classList.add("dark"); else if (theme === "light") html.classList.remove("dark"); else { const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches; if (prefersDark) html.classList.add("dark"); else html.classList.remove("dark"); } }, [theme]);
  useEffect(() => { if (theme !== "system") return; const mq = window.matchMedia("(prefers-color-scheme: dark)"); const handler = (e) => { if (e.matches) document.documentElement.classList.add("dark"); else document.documentElement.classList.remove("dark"); }; mq.addEventListener("change", handler); return () => mq.removeEventListener("change", handler); }, [theme]);
  
  const showToast = (msg, type = "success") => { 
    const icon = type === "success" ? "✅" : "⚠️";
    setToast({ msg, icon, type }); 
    setTimeout(() => setToast(null), 3500); 
  };

  const startProcessing = (text, duration = 1500, onComplete = null) => {
    setProcessing({ active: true, text, type: "loading" });
    setTimeout(() => {
      setProcessing({ active: true, text: "Complete!", type: "success" });
      setTimeout(() => {
        setProcessing({ active: false, text: "", type: "loading" });
        if (onComplete) onComplete();
      }, 800);
    }, duration);
  };
  const handleAuth = () => { 
    if (!form.email || !form.password) return; 
    if (authTab === "signup" && !form.name) return; 
    const name = authTab === "signup" ? form.name : (form.name || form.email.split("@")[0]); 
    
    startProcessing(authTab === "signup" ? "Creating Account..." : "Signing In...", 1200, () => {
      setUser({ name, email: form.email, income: 0 }); 
      showToast(`Welcome${authTab === "signup" ? "" : " back"}, ${name}!`); 
      if (!currency) showToast("Please select your preferred currency from the banner above."); 
    });
  };
  
  const handleUpload = (newTx, fileHash, filename) => {
    const existing = uploadedFiles.find(f => f.hash === fileHash);
    if (existing) { showToast(`"${filename}" has already been imported.`, "error"); return; }
    
    startProcessing("Processing Statement...", 2000, () => {
      setTransactions(t => [...t, ...newTx]);
      setUploadedFiles(f => [...f, { name: filename, hash: fileHash, dateUploaded: new Date().toISOString(), txCount: newTx.length }]);
      setPage("transactions");
      showToast(`${newTx.length} transactions imported from ${filename}!`);
    });
  };
  
  const handleAddIncome = (income) => { 
    startProcessing("Saving Income...", 800, () => {
      setIncomes(i => [...i, income]); 
    });
  };
  const handleDeleteIncome = (id) => { setIncomes(i => i.filter(inc => inc.id !== id)); showToast("Income entry removed."); };
  const handleUpdateBudgets = (newBudgets) => { setBudgets(newBudgets); };
  const handleAddScenario = (scenario) => { 
    startProcessing("Analyzing Scenario...", 1000, () => {
      setCustomScenarios(s => [...s, scenario]); 
      showToast("Custom scenario added!"); 
    });
  };
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
    startProcessing("Updating Goal...", 1000, () => {
      setTransactions(t => [contributionTx, ...t]);
      showToast(`Added ${formatMoney(amount, currency)} to ${goal.name}`);
    });
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
  
  if (!user) { return (<><style>{css}</style><div className="auth-screen"><div className="auth-card"><div className="auth-logo"><span className="auth-logo-text">Spend<span style={{ color: "#00C896" }}>Sight</span></span></div><div className="auth-tagline">Your money, your clarity.</div><div className="auth-tabs"><button className={`auth-tab ${authTab === "login" ? "active" : ""}`} onClick={() => setAuthTab("login")}>Sign In</button><button className={`auth-tab ${authTab === "signup" ? "active" : ""}`} onClick={() => setAuthTab("signup")}>Sign Up</button></div>{authTab === "signup" && (<div className="form-group"><label className="form-label">Your Name</label><input className="form-input" placeholder="e.g. El" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>)}<div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div><div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div><button className={`btn-primary ${processing.active ? "btn-loading" : ""}`} onClick={handleAuth}>{authTab === "login" ? "Sign In →" : "Create Account →"}</button></div></div>{processing.active && (<div className="processing-overlay"><div className="processing-card">{processing.type === "loading" ? <div className="loader-ring" /> : <div className="success-check">✓</div>}<div className="processing-text">{processing.text}</div></div></div>)}{toast && <div className={`toast ${toast.type}`}><span className="toast-icon">{toast.icon}</span>{toast.msg}</div>}<Analytics /></>); }
  if (!currency) { return (<><style>{css}</style><div className="app"><main className="main" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}><div className="card" style={{ maxWidth: 500, textAlign: "center" }}><div className="card-title" style={{ fontSize: 24, marginBottom: 16 }}>🌍 Welcome to SpendSight</div><p style={{ marginBottom: 24, color: "var(--text-muted)" }}>Please select your preferred currency first. All your transactions and goals will be stored in this currency.</p><select className="currency-selector" style={{ padding: 12, fontSize: 16, width: "100%" }} onChange={(e) => { setCurrency(e.target.value); showToast(`Currency selected: ${CURRENCIES[e.target.value].name}.`); }} defaultValue=""><option value="" disabled>Select your currency...</option>{Object.entries(CURRENCIES).map(([code, c]) => (<option key={code} value={code}>{c.name}</option>))}</select></div></main></div>{toast && <div className={`toast ${toast.type}`}><span className="toast-icon">{toast.icon}</span>{toast.msg}</div>}<Analytics /></>); }
  if (sessionExpired) { return (<><style>{css}</style><div className="session-overlay"><div className="session-card"><div className="session-logo">Spend<span style={{ color: "#00C896" }}>Sight</span></div><div className="session-message">Your session has timed out for security.</div><button className="session-btn" onClick={() => { setSessionExpired(false); lastActivityRef.current = Date.now(); }}>Resume Session</button></div></div><Analytics /></>); }
  
  return (<><style>{css}</style><div className="app">{showInstallPrompt && (<div className="install-banner"><p>📲 Install SpendSight on your device for quick access and offline use.</p><div><button className="install-btn" onClick={handleInstall}>Install</button><button className="dismiss-btn" onClick={dismissInstall}>Not now</button></div></div>)}<div className={`mobile-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} /><div className={`sidebar ${sidebarOpen ? "open" : ""}`}><div className="sidebar-logo"><div className="logo-text">Spend<span className="logo-dot">Sight</span></div></div><nav className="sidebar-nav">{navItems.map(n => (<button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => { setPage(n.id); setSidebarOpen(false); }}><span className="nav-icon">{n.icon}</span>{n.label}</button>))}</nav><div className="sidebar-footer"><div className="user-chip"><div className="user-avatar">{user.name[0].toUpperCase()}</div><div className="user-name">{user.name}</div></div></div></div><div className="mobile-header"><button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}><span /><span /><span /></button><span style={{ fontFamily: "Syne", fontWeight: 800, color: "white", fontSize: 18 }}>Spend<span style={{ color: "#00C896" }}>Sight</span></span><div style={{ width: 30 }} /></div><main className="main">{page === "dashboard" && <Dashboard user={user} transactions={transactions} goals={goals} incomes={incomes} budgets={budgets} onUpdateBudget={handleUpdateBudgets} onAddIncome={handleAddIncome} onDeleteIncome={handleDeleteIncome} currency={currency} onCurrencyChange={setCurrency} showToast={showToast} />}{page === "upload" && <UploadPage onUpload={handleUpload} uploadedFiles={uploadedFiles} currency={currency} showToast={showToast} />}{page === "transactions" && <TransactionsPage transactions={transactions} setTransactions={setTransactions} currency={currency} showToast={showToast} />}{page === "insights" && <InsightsPage transactions={transactions} currency={currency} />}{page === "whatif" && <WhatIfPage transactions={transactions} incomes={incomes} currency={currency} customScenarios={customScenarios} onAddScenario={handleAddScenario} onDeleteScenario={handleDeleteScenario} />}{page === "goals" && <GoalsPage goals={goals} onAdd={(g) => { startProcessing("Creating Goal...", 800, () => setGoals(gs => [...gs, g])); }} onContribute={handleContributeToGoal} currency={currency} showToast={showToast} />}{page === "contact" && <ContactPage />}{page === "settings" && <SettingsPage user={user} onLogout={() => { setUser(null); setPage("dashboard"); }} onClearData={handleClearData} currency={currency} onCurrencyChange={setCurrency} theme={theme} onThemeChange={setTheme} textSize={textSize} onTextSizeChange={setTextSize} transactions={transactions} goals={goals} incomes={incomes} budgets={budgets} customScenarios={customScenarios} onRestoreData={handleRestoreData} showToast={showToast} />}</main></div>{processing.active && (<div className="processing-overlay"><div className="processing-card">{processing.type === "loading" ? <div className="loader-ring" /> : <div className="success-check">✓</div>}<div className="processing-text">{processing.text}</div></div></div>)}{toast && <div className={`toast ${toast.type}`}><span className="toast-icon">{toast.icon}</span>{toast.msg}</div>}<Analytics /></>);
} 