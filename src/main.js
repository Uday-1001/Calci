/**
 * Date-Based Interest Calculator - Core Logic & Event Handlers
 * Built for high precision, intuitive UX, and scrutiny/audit tracking.
 */

// Key for localStorage
const STORAGE_KEY = 'calci_interest_history_v1';
const THEME_KEY = 'calci_theme_preference';
const CURRENCY_KEY = 'calci_currency_preference';

// Application State
let state = {
  theme: localStorage.getItem(THEME_KEY) || 'light',
  currency: localStorage.getItem(CURRENCY_KEY) || '₹',
  history: JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'),
  currentCalculation: null,
  activeSlab: null
};

// DOM Element References
const elements = {
  // Theme & App
  html: document.documentElement,
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeLabelText: document.getElementById('themeLabelText'),
  
  // Inputs
  form: document.getElementById('interestForm'),
  currencySelect: document.getElementById('currencySelect'),
  principalInput: document.getElementById('principalInput'),
  formattedPrincipalHint: document.getElementById('formattedPrincipalHint'),
  startDateInput: document.getElementById('startDateInput'),
  endDateInput: document.getElementById('endDateInput'),
  rateInput: document.getElementById('rateInput'),
  noteInput: document.getElementById('noteInput'),
  daysCounterBadge: document.getElementById('daysCounterBadge'),
  daysCountText: document.getElementById('daysCountText'),
  slabPills: document.querySelectorAll('.slab-pill'),
  rateTypeBadge: document.getElementById('rateTypeBadge'),
  includeBothDaysCheckbox: document.getElementById('includeBothDaysCheckbox'),
  
  // Form Action buttons
  calculateBtn: document.getElementById('calculateBtn'),
  resetBtn: document.getElementById('resetBtn'),
  
  // Results Display
  resultsCard: document.getElementById('resultsCard'),
  resultInterest: document.getElementById('resultInterest'),
  resultInterestSub: document.getElementById('resultInterestSub'),
  resultTotal: document.getElementById('resultTotal'),
  bPrincipal: document.getElementById('bPrincipal'),
  bRate: document.getElementById('bRate'),
  bDuration: document.getElementById('bDuration'),
  bTimeEquiv: document.getElementById('bTimeEquiv'),
  bDailyRate: document.getElementById('bDailyRate'),
  bDailyAmount: document.getElementById('bDailyAmount'),
  bFormula: document.getElementById('bFormula'),
  copyResultBtn: document.getElementById('copyResultBtn'),
  quickPrintBtn: document.getElementById('quickPrintBtn'),
  
  // History & Audit
  historySearchInput: document.getElementById('historySearchInput'),
  historyCountBadge: document.getElementById('historyCountBadge'),
  historyTableBody: document.getElementById('historyTableBody'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  printHistoryBtn: document.getElementById('printHistoryBtn'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  
  // Print container
  printContainer: document.getElementById('printContainer')
};

// ==========================================
// 1. INITIALIZATION & SETUP
// ==========================================
function init() {
  // Apply saved theme & currency
  applyTheme(state.theme);
  elements.currencySelect.value = state.currency;
  
  // Leave date inputs empty by default
  elements.startDateInput.value = '';
  elements.endDateInput.value = '';
  
  // Attach Event Listeners
  attachEventListeners();
  
  // Calculate initial days and perform initial calculation preview if inputs exist
  updateDaysCount();
  calculateInterest(false); // don't save to history on load
  
  // Render History Table
  renderHistory();
}

// Format Date object to YYYY-MM-DD for date inputs
function formatDateForInput(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Pretty format date string for display (e.g. 16 Sep 2026)
function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Currency Formatter
function formatCurrency(amount, symbol = state.currency) {
  if (isNaN(amount)) return `${symbol} 0.00`;
  // Indian formatting style for INR, standard for others
  const locale = symbol === '₹' ? 'en-IN' : 'en-US';
  const formatted = Number(amount).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${symbol} ${formatted}`;
}

// ==========================================
// 2. THEME & CURRENCY MANAGEMENT
// ==========================================
function applyTheme(themeName) {
  state.theme = themeName;
  elements.html.setAttribute('data-theme', themeName);
  localStorage.setItem(THEME_KEY, themeName);
  elements.themeLabelText.textContent = themeName === 'dark' ? 'Light Mode' : 'Dark Mode';
}

function toggleTheme() {
  const newTheme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}

// ==========================================
// 3. DATE & DAY CALCULATION ENGINE
// ==========================================
function getDaysDifference() {
  const startStr = elements.startDateInput.value;
  const endStr = elements.endDateInput.value;
  
  if (!startStr || !endStr) return { days: 0, text: 'Select dates' };
  
  const [sY, sM, sD] = startStr.split('-').map(Number);
  const [eY, eM, eD] = endStr.split('-').map(Number);
  
  // Use UTC to prevent any local timezone or daylight saving offset shifts
  const utcStart = Date.UTC(sY, sM - 1, sD);
  const utcEnd = Date.UTC(eY, eM - 1, eD);
  
  let diffDays = Math.round((utcEnd - utcStart) / (1000 * 60 * 60 * 24));
  
  if (elements.includeBothDaysCheckbox.checked) {
    // Include both start and end days inclusive (+1 day)
    diffDays = diffDays >= 0 ? diffDays + 1 : diffDays;
  }
  
  if (isNaN(diffDays)) return { days: 0, text: 'Invalid dates' };
  if (diffDays < 0) return { days: diffDays, text: 'End date must be after Start date', isValid: false };

  // Calculate calendar-accurate Years, Months, Days duration
  let startDateObj = new Date(sY, sM - 1, sD);
  let endDateObj = new Date(eY, eM - 1, eD);
  if (elements.includeBothDaysCheckbox.checked) {
    endDateObj.setDate(endDateObj.getDate() + 1);
  }

  let y = endDateObj.getFullYear() - startDateObj.getFullYear();
  let m = endDateObj.getMonth() - startDateObj.getMonth();
  let d = endDateObj.getDate() - startDateObj.getDate();

  if (d < 0) {
    m--;
    const prevMonthDays = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), 0).getDate();
    d += prevMonthDays;
  }
  if (m < 0) {
    y--;
    m += 12;
  }

  let timeEquivParts = [];
  if (y > 0) timeEquivParts.push(`${y} ${y === 1 ? 'Year' : 'Years'}`);
  if (m > 0) timeEquivParts.push(`${m} ${m === 1 ? 'Month' : 'Months'}`);
  if (d > 0 || timeEquivParts.length === 0) timeEquivParts.push(`${d} ${d === 1 ? 'Day' : 'Days'}`);

  return {
    days: diffDays,
    text: `${diffDays} Days`,
    timeEquiv: timeEquivParts.join(', '),
    yearsExact: diffDays / 365,
    isValid: true
  };
}

function updateDaysCount() {
  const diff = getDaysDifference();
  elements.daysCountText.textContent = diff.text;
  
  if (diff.isValid === false) {
    elements.daysCounterBadge.style.backgroundColor = 'var(--danger-bg)';
    elements.daysCounterBadge.style.color = 'var(--danger-color)';
  } else {
    elements.daysCounterBadge.style.backgroundColor = 'var(--accent-light)';
    elements.daysCounterBadge.style.color = 'var(--accent-primary)';
  }

  return diff;
}

// Quick Date Buttons Logic
function setEndDateRelative(type) {
  const startStr = elements.startDateInput.value;
  if (!startStr) return;
  
  const startDate = new Date(startStr + 'T00:00:00');
  let newEndDate = new Date(startDate);
  
  if (type === 'today') {
    newEndDate = new Date();
  } else if (type === '1month') {
    newEndDate.setMonth(startDate.getMonth() + 1);
  } else if (type === '6months') {
    newEndDate.setMonth(startDate.getMonth() + 6);
  } else if (type === '1year') {
    newEndDate.setFullYear(startDate.getFullYear() + 1);
  }
  
  elements.endDateInput.value = formatDateForInput(newEndDate);
  updateDaysCount();
  calculateInterest(false);
}

// ==========================================
// 4. RATE SLABS & FORM INPUT HANDLERS
// ==========================================
function selectSlabRate(rateValue) {
  state.activeSlab = rateValue;
  elements.rateInput.value = rateValue;
  
  elements.slabPills.forEach(pill => {
    if (pill.dataset.rate === String(rateValue)) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  calculateInterest(false);
}

function updateSlabHighlight() {
  const currentRate = parseFloat(elements.rateInput.value);
  elements.slabPills.forEach(pill => {
    if (parseFloat(pill.dataset.rate) === currentRate) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
}

function getSelectedCalcMode() {
  return '365';
}

// ==========================================
// 5. INTEREST CALCULATION ENGINE
// ==========================================
function calculateInterest(saveToHistory = false) {
  const principal = parseFloat(elements.principalInput.value);
  const rate = parseFloat(elements.rateInput.value);
  const diff = updateDaysCount();
  const calcMode = '365';
  const note = elements.noteInput.value.trim();
  const currency = elements.currencySelect.value;

  // Formatted hint under principal input
  if (!isNaN(principal) && principal > 0) {
    elements.formattedPrincipalHint.textContent = `= ${formatCurrency(principal, currency)}`;
  } else {
    elements.formattedPrincipalHint.textContent = '';
  }

  elements.rateTypeBadge.textContent = 'Per Annum (365 Days)';

  // Validation
  if (isNaN(principal) || principal <= 0 || isNaN(rate) || rate < 0 || !diff.isValid || diff.days < 0) {
    elements.resultInterest.textContent = `${currency} 0.00`;
    elements.resultTotal.textContent = `${currency} 0.00`;
    elements.bPrincipal.textContent = formatCurrency(principal || 0, currency);
    elements.bRate.textContent = `${rate || 0}%`;
    elements.bDuration.textContent = diff.text;
    elements.bTimeEquiv.textContent = diff.timeEquiv || '-';
    elements.bDailyRate.textContent = '0.0000%';
    elements.bDailyAmount.textContent = `${currency} 0.00 / day`;
    elements.bFormula.textContent = 'Fill form to view calculation';
    state.currentCalculation = null;
    return;
  }

  // Standard 365-day simple interest: (P * R * Days) / (365 * 100)
  const totalInterest = (principal * rate * diff.days) / (365 * 100);
  const dailyInterestAmount = (principal * rate) / (365 * 100);
  const dailyInterestRate = rate / 365;
  const formulaStr = `(${currency} ${principal.toLocaleString()} × ${rate}% × ${diff.days} days) ÷ (365 × 100)`;

  const totalAmount = principal + totalInterest;

  // Update UI Card
  elements.resultInterest.textContent = formatCurrency(totalInterest, currency);
  elements.resultTotal.textContent = formatCurrency(totalAmount, currency);

  elements.bPrincipal.textContent = formatCurrency(principal, currency);
  elements.bRate.textContent = `${rate}% ${calcMode === 'monthly' ? '/ month' : '/ year'}`;
  elements.bDuration.textContent = `${diff.days} Days`;
  elements.bTimeEquiv.textContent = diff.timeEquiv;
  elements.bDailyRate.textContent = `${dailyInterestRate.toFixed(4)}% per day`;
  elements.bDailyAmount.textContent = `${formatCurrency(dailyInterestAmount, currency)} / day`;
  elements.bFormula.textContent = formulaStr;

  const calculationData = {
    id: 'calc_' + Date.now(),
    timestamp: new Date().toISOString(),
    displayDate: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
    currency: currency,
    principal: principal,
    startDate: elements.startDateInput.value,
    endDate: elements.endDateInput.value,
    days: diff.days,
    timeEquiv: diff.timeEquiv,
    rate: rate,
    calcMode: calcMode,
    includeBothDays: elements.includeBothDaysCheckbox.checked,
    interest: totalInterest,
    totalAmount: totalAmount,
    dailyAmount: dailyInterestAmount,
    note: note
  };

  state.currentCalculation = calculationData;

  if (saveToHistory) {
    // Add to top of history log
    state.history.unshift(calculationData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
    renderHistory();
    
    // Smooth flash effect on results card
    elements.resultsCard.classList.add('flash-glow');
    setTimeout(() => elements.resultsCard.classList.remove('flash-glow'), 600);
  }
}

// ==========================================
// 6. HISTORY & AUDIT LOG MANAGER
// ==========================================
function renderHistory() {
  const searchQuery = (elements.historySearchInput.value || '').toLowerCase().trim();
  const tbody = elements.historyTableBody;
  tbody.innerHTML = '';

  const filteredHistory = state.history.filter(item => {
    if (!searchQuery) return true;
    const searchString = `${item.note} ${item.principal} ${item.rate} ${item.startDate} ${item.endDate} ${item.days} ${item.interest} ${item.totalAmount}`.toLowerCase();
    return searchString.includes(searchQuery);
  });

  elements.historyCountBadge.textContent = `${filteredHistory.length} Record${filteredHistory.length === 1 ? '' : 's'}`;

  if (filteredHistory.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-history">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <p>${searchQuery ? 'No calculations match your search.' : 'No saved calculations yet. Perform a calculation above to record history.'}</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  filteredHistory.forEach((item, index) => {
    const tr = document.createElement('tr');
    const currency = item.currency || '₹';
    const modeText = item.calcMode === 'monthly' ? '%/mo' : (item.calcMode === '360' ? '% (360d)' : '%/yr');

    tr.innerHTML = `
      <td><strong>${filteredHistory.length - index}</strong></td>
      <td>
        <div style="font-weight: 600;">${formatDateDisplay(item.startDate)} → ${formatDateDisplay(item.endDate)}</div>
        <div style="font-size: 0.78rem; color: var(--text-muted);">${item.days} Days (${item.timeEquiv})</div>
      </td>
      <td class="td-principal">${formatCurrency(item.principal, currency)}</td>
      <td><span class="badge" style="font-size: 0.75rem;">${item.rate}${modeText}</span></td>
      <td class="td-interest">${formatCurrency(item.interest, currency)}</td>
      <td class="td-total">${formatCurrency(item.totalAmount, currency)}</td>
      <td>
        ${item.note ? `<span class="note-badge" title="${escapeHtml(item.note)}">${escapeHtml(item.note)}</span>` : '<span style="color:var(--text-muted); font-size:0.8rem;">-</span>'}
      </td>
      <td>
        <div class="action-btns">
          <button class="btn-icon reload-btn" data-id="${item.id}" title="Reload to form">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
          </button>
          <button class="btn-icon btn-icon-danger delete-btn" data-id="${item.id}" title="Delete record">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Attach event listeners for row actions
  tbody.querySelectorAll('.reload-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      reloadHistoryItem(id);
    });
  });

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      deleteHistoryItem(id);
    });
  });
}

function reloadHistoryItem(id) {
  const item = state.history.find(h => h.id === id);
  if (!item) return;

  elements.currencySelect.value = item.currency || '₹';
  state.currency = item.currency || '₹';
  elements.principalInput.value = item.principal;
  elements.startDateInput.value = item.startDate;
  elements.endDateInput.value = item.endDate;
  elements.rateInput.value = item.rate;
  elements.noteInput.value = item.note || '';
  elements.includeBothDaysCheckbox.checked = item.includeBothDays !== false;

  updateSlabHighlight();
  updateDaysCount();
  calculateInterest(false);

  // Scroll smoothly up to calculator card
  elements.form.scrollIntoView({ behavior: 'smooth' });
}

function deleteHistoryItem(id) {
  const item = state.history.find(h => h.id === id);
  if (!item) return;

  const noteLabel = item.note ? `"${item.note}"` : `Principal: ${formatCurrency(item.principal, item.currency || '₹')}`;
  const isConfirmed = confirm(`Are you sure you want to delete this calculation log?\n\nRecord: ${noteLabel}\nPeriod: ${formatDateDisplay(item.startDate)} to ${formatDateDisplay(item.endDate)}`);
  
  if (isConfirmed) {
    state.history = state.history.filter(h => h.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
    renderHistory();
  }
}

function clearAllHistory() {
  if (state.history.length === 0) return;
  const isConfirmed = confirm(`⚠️ Warning: Are you sure you want to delete ALL ${state.history.length} saved calculation logs?\n\nThis action cannot be undone.`);
  if (isConfirmed) {
    state.history = [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
    renderHistory();
  }
}

// Export History to CSV
function exportToCSV() {
  if (state.history.length === 0) {
    alert('No calculation history to export.');
    return;
  }

  let csvContent = 'data:text/csv;charset=utf-8,';
  csvContent += 'S.No,Date Recorded,Start Date,End Date,Days,Principal,Currency,Rate %,Calc Mode,Interest,Total Amount,Remarks\n';

  state.history.forEach((item, index) => {
    const row = [
      state.history.length - index,
      `"${item.displayDate}"`,
      `"${item.startDate}"`,
      `"${item.endDate}"`,
      item.days,
      item.principal,
      `"${item.currency}"`,
      item.rate,
      `"${item.calcMode}"`,
      item.interest.toFixed(2),
      item.totalAmount.toFixed(2),
      `"${(item.note || '').replace(/"/g, '""')}"`
    ].join(',');
    csvContent += row + '\n';
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Interest_Audit_Report_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Print Audit Voucher / Report
function printAuditSheet(singleItem = null) {
  const printBox = elements.printContainer;
  const itemsToPrint = singleItem ? [singleItem] : state.history;

  if (!singleItem && state.history.length === 0 && state.currentCalculation) {
    itemsToPrint.push(state.currentCalculation);
  }

  let tableRowsHtml = '';
  itemsToPrint.forEach((item, idx) => {
    const cur = item.currency || '₹';
    tableRowsHtml += `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatDateDisplay(item.startDate)} to ${formatDateDisplay(item.endDate)}<br/><small>(${item.days} Days)</small></td>
        <td>${formatCurrency(item.principal, cur)}</td>
        <td>${item.rate}% ${item.calcMode === 'monthly' ? '/mo' : '/yr'}</td>
        <td><strong>${formatCurrency(item.interest, cur)}</strong></td>
        <td><strong>${formatCurrency(item.totalAmount, cur)}</strong></td>
        <td>${item.note || '-'}</td>
      </tr>
    `;
  });

  printBox.innerHTML = `
    <div class="print-header">
      <h1>Interest Calculation & Audit Voucher</h1>
      <p>Official Record for Scrutiny • Date of Print: ${new Date().toLocaleString('en-IN')}</p>
    </div>

    <table class="print-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Period & Duration</th>
          <th>Principal Amount</th>
          <th>Interest Rate</th>
          <th>Total Interest</th>
          <th>Maturity / Total</th>
          <th>Remarks / Note</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>

    <div class="print-footer">
      <div>
        <p>Prepared By: ___________________</p>
      </div>
      <div class="signature-line">
        Authorized Signature / Verification
      </div>
    </div>
  `;

  window.print();
}

// Copy Summary Details to Clipboard
function copyResultDetails() {
  if (!state.currentCalculation) {
    alert('Please calculate interest first.');
    return;
  }

  const c = state.currentCalculation;
  const cur = c.currency;
  const text = `Interest Calculation Details:
-----------------------------
Principal: ${formatCurrency(c.principal, cur)}
Duration: ${formatDateDisplay(c.startDate)} to ${formatDateDisplay(c.endDate)} (${c.days} Days)
Interest Rate: ${c.rate}% (${c.calcMode === 'monthly' ? 'per month' : 'per annum'})
-----------------------------
Total Interest: ${formatCurrency(c.interest, cur)}
Total Amount: ${formatCurrency(c.totalAmount, cur)}
Note: ${c.note || 'None'}`;

  navigator.clipboard.writeText(text).then(() => {
    alert('Calculation summary copied to clipboard!');
  }).catch(() => {
    alert('Failed to copy. Please try manual selection.');
  });
}

// Helper: Escape HTML string
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==========================================
// 7. EVENT LISTENERS
// ==========================================
function attachEventListeners() {
  // Theme Toggle
  elements.themeToggleBtn.addEventListener('click', toggleTheme);
  
  // Currency Select
  elements.currencySelect.addEventListener('change', (e) => {
    state.currency = e.target.value;
    localStorage.setItem(CURRENCY_KEY, state.currency);
    calculateInterest(false);
  });

  // Inputs live recalculation
  elements.principalInput.addEventListener('input', () => calculateInterest(false));
  elements.startDateInput.addEventListener('change', () => {
    updateDaysCount();
    calculateInterest(false);
  });
  elements.endDateInput.addEventListener('change', () => {
    updateDaysCount();
    calculateInterest(false);
  });
  elements.rateInput.addEventListener('input', () => {
    updateSlabHighlight();
    calculateInterest(false);
  });
  elements.includeBothDaysCheckbox.addEventListener('change', () => {
    updateDaysCount();
    calculateInterest(false);
  });

  // Rate Slab Pills (6.65%, 10.5%, 11.5%)
  elements.slabPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const rateVal = parseFloat(pill.dataset.rate);
      selectSlabRate(rateVal);
    });
  });

  // Form Submit (Calculate & Save)
  elements.form.addEventListener('submit', (e) => {
    e.preventDefault();
    calculateInterest(true); // save to history on explicit click/submit
  });

  // Reset Form
  elements.resetBtn.addEventListener('click', () => {
    elements.form.reset();
    elements.currencySelect.value = state.currency;
    elements.startDateInput.value = '';
    elements.endDateInput.value = '';
    elements.includeBothDaysCheckbox.checked = false;
    state.activeSlab = null;
    elements.slabPills.forEach(p => p.classList.remove('active'));
    
    updateDaysCount();
    calculateInterest(false);
  });

  // Action Buttons
  elements.copyResultBtn.addEventListener('click', copyResultDetails);
  elements.quickPrintBtn.addEventListener('click', () => {
    if (state.currentCalculation) {
      printAuditSheet(state.currentCalculation);
    } else {
      printAuditSheet();
    }
  });

  // History controls
  elements.historySearchInput.addEventListener('input', renderHistory);
  elements.exportCsvBtn.addEventListener('click', exportToCSV);
  elements.printHistoryBtn.addEventListener('click', () => printAuditSheet());
  elements.clearHistoryBtn.addEventListener('click', clearAllHistory);
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
