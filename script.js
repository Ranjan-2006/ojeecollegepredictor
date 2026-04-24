document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    html.classList.toggle('dark');
    const isNowDark = html.classList.contains('dark');
    localStorage.setItem('theme', isNowDark ? 'dark' : 'light');
    updateThemeIcons(isNowDark);
});

function updateThemeIcons(isDark) {
    const sunIcon = document.getElementById('sunIcon');
    const moonIcon = document.getElementById('moonIcon');
    if (isDark) {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
}

const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
if (shouldBeDark) document.documentElement.classList.add('dark');
updateThemeIcons(shouldBeDark);

// ─────────────────────────────────────────────
//  New Prediction button
// ─────────────────────────────────────────────
document.getElementById('newPredictionBtn').addEventListener('click', () => {
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('heroSection').classList.remove('hidden');
    document.getElementById('resultsContainer').innerHTML = '';
    document.getElementById('summaryLine').textContent = '';
    document.getElementById('bufferChips').innerHTML = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ─────────────────────────────────────────────
//  Supabase
// ─────────────────────────────────────────────
const SUPABASE_URL = 'https://brhtwekbrsgqbcpolbyc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaHR3ZWticnNncWJjcG9sYnljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NTM2MjQsImV4cCI6MjA5MjUyOTYyNH0.JMPuJMe3eJ9fySfNti-pE1xz8ugu0M0Tsz61Orzei4o';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─────────────────────────────────────────────
//  Utility: format numbers with commas
// ─────────────────────────────────────────────
const fmt = (n) => {
    if (n === null || n === undefined || n === '') return '—';
    return Number(n).toLocaleString('en-IN');
};

// ─────────────────────────────────────────────
//  Utility: normalize phone to 10-digit Indian mobile
// ─────────────────────────────────────────────
function normalizePhone(raw) {
    if (!raw) return null;
    // Strip every non-digit character (spaces, +, -, parens, etc.)
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length < 10) return null;
    // Always take the last 10 digits — this handles +91, 091, 0, 91 prefixes
    const last10 = digits.slice(-10);
    // Indian mobile numbers must start with 6, 7, 8, or 9
    if (!/^[6-9]\d{9}$/.test(last10)) return null;
    return last10;
}

// ─────────────────────────────────────────────
//  Utility: basic email sanity check
// ─────────────────────────────────────────────
function isValidEmail(str) {
    if (!str) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str.trim());
}

// ─────────────────────────────────────────────
//  Utility: show/hide inline form error
// ─────────────────────────────────────────────
function showFormError(msg) {
    const el = document.getElementById('formError');
    el.textContent = msg;
    el.classList.remove('hidden');
}
function clearFormError() {
    const el = document.getElementById('formError');
    el.textContent = '';
    el.classList.add('hidden');
}

// ─────────────────────────────────────────────
//  Form submit
// ─────────────────────────────────────────────
document.getElementById('predictorForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    clearFormError();

    // Capture inputs
    const applicantName = document.getElementById('nameInput').value.trim() || 'Applicant';
    const rawPhone      = document.getElementById('phoneInput').value;
    const rawEmail      = document.getElementById('emailInput').value.trim();
    const originalRank  = parseInt(document.getElementById('rankInput').value);
    const category      = document.getElementById('categoryInput').value;
    const gender        = document.getElementById('genderInput').value;
    const isSGS         = document.getElementById('sgsCheckbox').checked;
    const prefType      = document.getElementById('typeInput').value;

    // ─── VALIDATION ───
    const phone = normalizePhone(rawPhone);
    if (!phone) {
        showFormError('Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).');
        document.getElementById('phoneInput').focus();
        return;
    }
    if (!isValidEmail(rawEmail)) {
        showFormError('Please enter a valid email address.');
        document.getElementById('emailInput').focus();
        return;
    }

    // Show loading state
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('loadingSection').classList.remove('hidden');
    document.getElementById('resultsSection').classList.add('hidden');

    // ─── STORE APPLICANT (upsert on mobile_no primary key) ───
    // Fire-and-log: we don't block the prediction if the insert fails.
    try {
        const { error: saveError } = await supabaseClient.rpc('save_applicant', {
    p_mobile_no: phone,
    p_name:      applicantName,
    p_email:     rawEmail,
    p_category:  category,
    p_rank:      originalRank,
});
if (saveError) console.error('Applicant save error:', saveError);
    } catch (err) {
        console.error('Applicant save threw:', err);
    }

    // ─── MATH PHASE (unchanged) ───
    let pointRank = originalRank;
    let bufferDetails = [];

    if (category === 'EWS') {
        pointRank -= originalRank * 0.20;
        bufferDetails.push({ label: 'EWS', value: '−20%' });
    } else if (category === 'SC') {
        pointRank -= originalRank * 0.50;
        bufferDetails.push({ label: 'SC', value: '−50%' });
    } else if (category === 'ST') {
        pointRank -= originalRank * 0.80;
        bufferDetails.push({ label: 'ST', value: '−80%' });
    }

    if (isSGS) {
        pointRank -= 150000;
        bufferDetails.push({ label: 'SGS', value: '−1.5L' });
    }
    if (gender === 'Female') {
        pointRank -= 50000;
        bufferDetails.push({ label: 'Female', value: '−50k' });
    }

    pointRank = Math.floor(pointRank);
    pointRank = Math.max(1, pointRank);

    // ─── QUERY PHASE (unchanged) ───
    const minRank = Math.max(1, pointRank - 15000);

    let query = supabaseClient.from('rank_table').select('*');

    if (prefType === 'Government') {
        query = query.eq('type', 'Government');
    } else if (prefType === 'Private') {
        query = query.eq('type', 'Private');
    }

    query = query.eq('category', 'General');
    query = query.gte('close_rank', minRank);

    const queryPromise = query;
    const delayPromise = new Promise(resolve => setTimeout(resolve, 1500));
    const [{ data, error }] = await Promise.all([queryPromise, delayPromise]);

    document.getElementById('loadingSection').classList.add('hidden');
    document.getElementById('resultsSection').classList.remove('hidden');

    if (error) {
        console.error("Database Error:", error);
        document.getElementById('resultsContainer').innerHTML = `
            <div class="border border-tough dark:border-tough-dark bg-tough/5 dark:bg-tough-dark/10 p-6 text-sm">
                <div class="smallcaps text-tough dark:text-tough-dark mb-2">Error</div>
                <p class="text-muted dark:text-muted-dark">We couldn't fetch data right now. Please check the console and try again.</p>
            </div>`;
        return;
    }

    renderResults(data, pointRank, minRank, originalRank, bufferDetails, applicantName);
});

// ─────────────────────────────────────────────
//  Render summary, chips, filter tabs, cards
// ─────────────────────────────────────────────
function renderResults(colleges, pointRank, minRank, originalRank, bufferDetails, applicantName) {
    const container    = document.getElementById('resultsContainer');
    const summaryLine  = document.getElementById('summaryLine');
    const bufferChips  = document.getElementById('bufferChips');

    // Summary line
    summaryLine.innerHTML =
        `Prepared for <span class="text-ink dark:text-ink-dark font-medium">${escapeHtml(applicantName)}</span> · ` +
        `rank <span class="text-ink dark:text-ink-dark font-medium">${fmt(originalRank)}</span>`;

    // Buffer chips
    bufferChips.innerHTML = '';

    // Empty state
    if (!colleges || colleges.length === 0) {
        container.innerHTML = `
            <div class="border border-rule dark:border-rule-dark p-12 text-center">
                <div class="font-display text-2xl mb-2">No matches in range.</div>
                <div class="text-sm text-muted dark:text-muted-dark">Try loosening the institute-type filter or adjusting your inputs.</div>
            </div>`;
        updateCounts(0, 0, 0);
        return;
    }

    // Bucket by zone (logic unchanged)
    const greenBucket = []; // safe
    const blueBucket  = []; // probable
    const redBucket   = []; // tough

    colleges.forEach(college => {
        if (college.close_rank >= (pointRank + 10001)) {
            college.zoneColor = 'green';
            greenBucket.push(college);
        } else if (college.close_rank >= pointRank && college.close_rank <= (pointRank + 10000)) {
            college.zoneColor = 'blue';
            blueBucket.push(college);
        } else if (college.close_rank >= minRank && college.close_rank < pointRank) {
            college.zoneColor = 'red';
            redBucket.push(college);
        }
    });

    const sortByRank = (a, b) => a.close_rank - b.close_rank;
    greenBucket.sort(sortByRank);
    blueBucket.sort(sortByRank);
    redBucket.sort(sortByRank);

    // 30-slot quota: up to 10 red + 10 blue, rest green (unchanged)
    const displayRed   = redBucket.slice(0, 10);
    const displayBlue  = blueBucket.slice(0, 10);
    const displayGreen = greenBucket.slice(0, 30 - displayRed.length - displayBlue.length);

    // Stack order: Probable first (sweet spot), then Safe, then Tough
    const finalList = [...displayBlue, ...displayGreen, ...displayRed];

    // Update tab counts
    updateCounts(displayGreen.length, displayBlue.length, displayRed.length);

    // Render cards
    container.innerHTML = finalList.map((college, i) => renderCard(college, i)).join('');

    // Wire up filter tabs
    wireFilterTabs();
}

function renderCard(college, index) {
    let zoneClass, zoneLabel, dotColor;

    if (college.zoneColor === 'green') {
        zoneClass = 'safe';     zoneLabel = 'Safe';       dotColor = '#4A7C59';
    } else if (college.zoneColor === 'blue') {
        zoneClass = 'probable'; zoneLabel = 'Probable';   dotColor = '#3A5A7C';
    } else {
        zoneClass = 'tough';    zoneLabel = 'Tough';      dotColor = '#A03E2B';
    }

    const delay = Math.min(index * 30, 600);

    return `
        <article class="college-card rise grid grid-cols-12 gap-4 items-center border border-rule dark:border-rule-dark bg-surface dark:bg-surface-dark hover:bg-elevated dark:hover:bg-elevated-dark transition-colors p-5 lg:p-6"
                 data-zone="${zoneClass}"
                 style="animation-delay: ${delay}ms; border-left-width: 3px; border-left-color: ${dotColor};">

            <!-- Index + Institute name + stream -->
            <div class="col-span-12 lg:col-span-6 min-w-0">
                <div class="flex items-start gap-4">
                    <span class="num text-xs text-faint dark:text-faint-dark pt-1 w-6 flex-shrink-0">${String(index + 1).padStart(2, '0')}</span>
                    <div class="min-w-0 flex-1">
                        <h3 class="font-display text-lg lg:text-xl leading-snug tracking-tight text-ink dark:text-ink-dark">
                            ${escapeHtml(college.institute_name)}
                        </h3>
                        <p class="text-sm text-muted dark:text-muted-dark mt-0.5 truncate">${escapeHtml(college.stream || '')}</p>
                    </div>
                </div>
            </div>

            <!-- Metrics -->
            <div class="col-span-12 lg:col-span-4 grid grid-cols-3 gap-3 lg:gap-6 pl-10 lg:pl-0">
                <div>
                    <div class="smallcaps text-faint dark:text-faint-dark mb-1">Cutoff</div>
                    <div class="num text-sm lg:text-base text-ink dark:text-ink-dark">${fmt(college.close_rank)}</div>
                </div>
                <div>
                    <div class="smallcaps text-faint dark:text-faint-dark mb-1">Open</div>
                    <div class="num text-sm lg:text-base text-ink dark:text-ink-dark">${fmt(college.open_rank)}</div>
                </div>
                <div>
                    <div class="smallcaps text-faint dark:text-faint-dark mb-1">Type</div>
                    <div class="text-sm lg:text-base text-ink dark:text-ink-dark">${escapeHtml(college.type || '—')}</div>
                </div>
            </div>

            <!-- Zone tag -->
            <div class="col-span-12 lg:col-span-2 flex lg:justify-end pl-10 lg:pl-0">
                <span class="inline-flex items-center gap-2 text-xs">
                    <span class="zone-dot" style="background:${dotColor};"></span>
                    <span class="text-ink dark:text-ink-dark">${zoneLabel}</span>
                </span>
            </div>
        </article>
    `;
}

// ─────────────────────────────────────────────
//  Filter tabs
// ─────────────────────────────────────────────
function updateCounts(safe, probable, tough) {
    const set = (key, val) => {
        const el = document.querySelector(`[data-count="${key}"]`);
        if (el) el.textContent = val;
    };
    set('all', safe + probable + tough);
    set('safe', safe);
    set('probable', probable);
    set('tough', tough);
}

function wireFilterTabs() {
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => {
                t.classList.remove('tab-active', 'border-ink', 'dark:border-ink-dark');
                t.classList.add('border-rule', 'dark:border-rule-dark');
            });
            tab.classList.add('tab-active', 'border-ink', 'dark:border-ink-dark');
            tab.classList.remove('border-rule', 'dark:border-rule-dark');

            const filter = tab.getAttribute('data-filter');
            document.querySelectorAll('.college-card').forEach(card => {
                const zone = card.getAttribute('data-zone');
                card.style.display = (filter === 'all' || filter === zone) ? '' : 'none';
            });
        };
    });
}

// ─────────────────────────────────────────────
//  Safety: escape HTML in DB strings
// ─────────────────────────────────────────────
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────
//  Coffee Modal Logic
// ─────────────────────────────────────────────
const coffeeBtn = document.getElementById('coffeeBtn');
const closeCoffeeBtn = document.getElementById('closeCoffeeBtn');
const coffeeModal = document.getElementById('coffeeModal');

if (coffeeBtn && closeCoffeeBtn && coffeeModal) {
    coffeeBtn.addEventListener('click', () => {
        coffeeModal.classList.remove('hidden');
    });

    closeCoffeeBtn.addEventListener('click', () => {
        coffeeModal.classList.add('hidden');
    });

    coffeeModal.addEventListener('click', (e) => {
        if (e.target === coffeeModal) {
            coffeeModal.classList.add('hidden');
        }
    });
}

const payUpiBtn = document.getElementById('payUpiBtn');
const coffeePromptModal = document.getElementById('coffeePromptModal');
const coffeeAmountInput = document.getElementById('coffeeAmountInput');
const cancelCoffeePrompt = document.getElementById('cancelCoffeePrompt');
const confirmCoffeePrompt = document.getElementById('confirmCoffeePrompt');

if (payUpiBtn && coffeePromptModal) {
    payUpiBtn.addEventListener('click', () => {
        coffeeAmountInput.value = ''; 
        coffeePromptModal.classList.remove('hidden');
        setTimeout(() => coffeeAmountInput.focus(), 100);
    });

    cancelCoffeePrompt.addEventListener('click', () => {
        coffeePromptModal.classList.add('hidden');
    });

    confirmCoffeePrompt.addEventListener('click', () => {
        const amount = coffeeAmountInput.value.trim();
        if (amount && Number(amount) > 0) {
            const upiId = '7682080352@slc';
            const name = 'Ranjan Sahoo';
            window.location.href = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`;
            coffeePromptModal.classList.add('hidden');
        } else {
            coffeeAmountInput.focus();
        }
    });

    coffeePromptModal.addEventListener('click', (e) => {
        if (e.target === coffeePromptModal) {
            coffeePromptModal.classList.add('hidden');
        }
    });
}
