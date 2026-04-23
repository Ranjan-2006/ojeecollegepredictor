// Theme Toggle Functionality
document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const isCurrentlyDark = html.classList.contains('dark');
    
    // Toggle the dark class
    html.classList.toggle('dark');
    const isNowDark = html.classList.contains('dark');
    
    // Save to localStorage
    localStorage.setItem('theme', isNowDark ? 'dark' : 'light');
    
    // Update icon visibility
    updateThemeIcons(isNowDark);
});

// Function to update icon visibility
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

// Load saved theme on page load
const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

if (shouldBeDark) {
    document.documentElement.classList.add('dark');
}

updateThemeIcons(shouldBeDark);

// New Prediction Button
document.getElementById('newPredictionBtn').addEventListener('click', () => {
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('formSection').classList.remove('hidden');
    document.getElementById('resultsContainer').innerHTML = `
        <div class="text-center py-24 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 shadow-inner">
            Fill out the form and hit predict to see your options!
        </div>`;
});

// 1. Initialize Supabase
const SUPABASE_URL = 'https://brhtwekbrsgqbcpolbyc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaHR3ZWticnNncWJjcG9sYnljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NTM2MjQsImV4cCI6MjA5MjUyOTYyNH0.JMPuJMe3eJ9fySfNti-pE1xz8ugu0M0Tsz61Orzei4o';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('predictorForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Hide form and show loading
    document.getElementById('formSection').classList.add('hidden');
    document.getElementById('loadingSection').classList.remove('hidden');
    document.getElementById('resultsSection').classList.add('hidden');

    // Capture Inputs
    const originalRank = parseInt(document.getElementById('rankInput').value);
    const category = document.getElementById('categoryInput').value;
    const gender = document.getElementById('genderInput').value;
    const isSGS = document.getElementById('sgsCheckbox').checked;
    const prefType = document.getElementById('typeInput').value;

    // -----------------------------------------
    // THE MATH PHASE
    // -----------------------------------------
    let pointRank = originalRank;
    let bufferDetails = [];

    // 1. Apply Percentage Category Buffers
    if (category === 'EWS') {
        let deduction = originalRank * 0.10;
        pointRank -= deduction;
        bufferDetails.push(`EWS (-10%)`);
    } else if (category === 'SC') {
        let deduction = originalRank * 0.25;
        pointRank -= deduction;
        bufferDetails.push(`SC (-25%)`);
    } else if (category === 'ST') {
        let deduction = originalRank * 0.40;
        pointRank -= deduction;
        bufferDetails.push(`ST (-40%)`);
    }

    // 2. Apply Flat Buffers
    if (isSGS) {
        pointRank -= 150000;
        bufferDetails.push('SGS (-1.5L)');
    }
    if (gender === 'Female') {
        pointRank -= 50000;
        bufferDetails.push('Female (-50K)');
    }

    pointRank = Math.floor(pointRank);
    pointRank = Math.max(1, pointRank);

    // -----------------------------------------
    // THE DATABASE QUERY PHASE
    // -----------------------------------------
    // We keep the minimum boundary (Red Zone Start)
    const minRank = Math.max(1, pointRank - 15000); 
    
    // FIX: We removed maxRank completely to ensure we grab enough data!

    let query = supabaseClient.from('rank_table').select('*');

    if (prefType === 'Government') {
        query = query.eq('type', 'Government');
    } else if (prefType === 'Private') {
        query = query.eq('type', 'Private');
    }

    // Since EWS/SC/ST are calculated via math, we only query General
    query = query.eq('category', 'General');

    // Fetch EVERYTHING from the minRank and above
    query = query.gte('close_rank', minRank);

    // Execute query and enforce a minimum loading animation time
    const queryPromise = query;
    const delayPromise = new Promise(resolve => setTimeout(resolve, 1500));
    const [{ data, error }] = await Promise.all([queryPromise, delayPromise]);

    // Hide loading and show results
    document.getElementById('loadingSection').classList.add('hidden');
    document.getElementById('resultsSection').classList.remove('hidden');

    if (error) {
        console.error("Database Error:", error);
        document.getElementById('resultsContainer').innerHTML = `
            <div class="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-4 rounded border border-red-300 dark:border-red-700">
                Error fetching data. Check console for details.
            </div>`;
        return;
    }

    // Process and Render Results
    renderColorCodedResults(data, pointRank, minRank);
});

// The Grouping & Rendering Function
function renderColorCodedResults(colleges, pointRank, minRank) {
    const container = document.getElementById('resultsContainer');

    if (colleges.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <p class="text-gray-500 dark:text-gray-400 font-semibold">No colleges found within your targeted rank zone.</p>
            </div>`;
        return;
    }

    let greenBucket = [];
    let blueBucket = [];
    let redBucket = [];

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

    // Sort each bucket strictly by best rank to worst
    const sortByRank = (a, b) => a.close_rank - b.close_rank;
    greenBucket.sort(sortByRank);
    blueBucket.sort(sortByRank);
    redBucket.sort(sortByRank);

    // -----------------------------------------
    // THE SMART QUOTA FIX
    // -----------------------------------------
    // Guarantee up to 10 slots for Red and Blue. Give the rest of the 30 slots to Green.
    let displayRed = redBucket.slice(0, 10);
    let displayBlue = blueBucket.slice(0, 10);
    let displayGreen = greenBucket.slice(0, 30 - displayRed.length - displayBlue.length);

    // Stack them (Green -> Blue -> Red)
    let finalCollegesList = [...displayGreen, ...displayBlue, ...displayRed];

    let htmlOutput = '';

    finalCollegesList.forEach(college => {
        let cardStyle, badgeStyle, chanceText;

        if (college.zoneColor === 'green') {
            cardStyle = 'border-green-300 bg-green-50 hover:border-green-400 dark:bg-green-900/20 dark:border-green-600 dark:hover:border-green-500';
            badgeStyle = 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100';
            chanceText = 'Very Safe';
        } else if (college.zoneColor === 'blue') {
            cardStyle = 'border-blue-300 bg-blue-50 hover:border-blue-400 dark:bg-blue-900/20 dark:border-blue-600 dark:hover:border-blue-500';
            badgeStyle = 'bg-blue-200 text-blue-800 dark:bg-blue-700 dark:text-blue-100';
            chanceText = 'Probable / Sweet Spot';
        } else {
            cardStyle = 'border-red-300 bg-red-50 hover:border-red-400 dark:bg-red-900/20 dark:border-red-600 dark:hover:border-red-500';
            badgeStyle = 'bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-100';
            chanceText = 'Borderline / Tough';
        }

        htmlOutput += `
            <div class="border rounded-xl p-5 shadow-sm transition hover:shadow-md ${cardStyle}">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white">${college.institute_name}</h3>
                    <span class="px-3 py-1 rounded-full text-xs font-bold ${badgeStyle}">
                        ${chanceText}
                    </span>
                </div>
                <p class="text-gray-700 dark:text-gray-300 font-medium mb-3">${college.stream}</p>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm border-t pt-3 border-black/10 dark:border-gray-600">
                    <div><span class="text-gray-500 dark:text-gray-400">Institute:</span> <b class="text-black dark:text-white">${college.type || 'N/A'}</b></div>
                    <div><span class="text-gray-500 dark:text-gray-400">Seat:</span> <b class="text-black dark:text-white">${college.category}</b></div>
                    <div><span class="text-gray-500 dark:text-gray-400">Cutoff Rank:</span> <b class="text-black dark:text-white">${college.close_rank}</b></div>
                    <div><span class="text-gray-500 dark:text-gray-400">Open Rank:</span> <b class="text-black dark:text-white">${college.open_rank || '-'}</b></div>
                </div>
            </div>
        `;
    });

    container.innerHTML = htmlOutput;
}