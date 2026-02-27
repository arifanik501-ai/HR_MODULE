document.addEventListener('DOMContentLoaded', () => {

    // Globals for table pagination and search
    let allEmployees = [];
    let filteredEmployees = [];
    let currentPage = 1;
    const rowsPerPage = 10;

    let chartInstances = {};

    window.toggleTheme = function () {
        const isYellow = document.body.classList.toggle('theme-yellow');
        updateThemeToggleButton(isYellow);
        updateChartThemes(isYellow);
    };

    function updateChartThemes(isYellow) {
        Chart.defaults.color = isYellow ? '#000000' : '#ffffff';
        Chart.defaults.scale.grid.color = isYellow ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
        Chart.defaults.plugins.tooltip.backgroundColor = isYellow ? 'rgba(255, 255, 255, 1)' : 'rgba(15, 23, 42, 0.95)';
        Chart.defaults.plugins.tooltip.titleColor = isYellow ? '#000000' : '#fff';
        Chart.defaults.plugins.tooltip.bodyColor = isYellow ? '#000000' : '#cbd5e1';
        Chart.defaults.plugins.tooltip.borderColor = isYellow ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.1)';
        Chart.defaults.plugins.tooltip.borderWidth = 1;

        if (chartInstances.bar) chartInstances.bar.update();
        if (chartInstances.line) chartInstances.line.update();
        if (chartInstances.pie) chartInstances.pie.update();
    }

    // Automated time-based theming (Overrides localStorage)
    function applyTimeBasedTheme() {
        const currentHour = new Date().getHours();
        // Light theme from 6:00 AM to 5:59 PM. Dark theme from 6:00 PM to 5:59 AM.
        const isDaytime = currentHour >= 6 && currentHour < 18;

        const isCurrentlyYellow = document.body.classList.contains('theme-yellow');

        if (isDaytime && !isCurrentlyYellow) {
            document.body.classList.add('theme-yellow');
            updateThemeToggleButton(true);
        } else if (!isDaytime && isCurrentlyYellow) {
            document.body.classList.remove('theme-yellow');
            updateThemeToggleButton(false);
        }
    }

    function updateThemeToggleButton(isYellow) {
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.querySelector('.fa-sun').classList.toggle('hidden', isYellow);
            themeBtn.querySelector('.fa-moon').classList.toggle('hidden', !isYellow);
        }
    }

    // Apply time-based theme on load
    applyTimeBasedTheme();

    // Check theme every minute just in case user stays on the page through the 6:00 boundary
    setInterval(applyTimeBasedTheme, 60000);

    // Load data from localStorage
    const rawData = localStorage.getItem('attendanceDashboardData');

    if (!rawData) {
        document.getElementById('emptyState').classList.remove('hidden');
        return;
    }

    let data;
    try {
        data = JSON.parse(rawData);
    } catch (e) {
        console.error("Failed to parse data", e);
        document.getElementById('emptyState').classList.remove('hidden');
        return;
    }

    // Populate the Filter Dropdowns
    const unitFilter = document.getElementById('unitFilter');
    const monthFilter = document.getElementById('monthFilter');

    if (unitFilter && data.branches) {
        data.branches.forEach(b => {
            const option = document.createElement('option');
            option.value = b.name;
            option.textContent = b.name;
            unitFilter.appendChild(option);
        });
    }

    if (monthFilter && data.payrollMonths) {
        data.payrollMonths.forEach(m => {
            const option = document.createElement('option');
            option.value = m;
            option.textContent = m;
            monthFilter.appendChild(option);
        });
    }

    function handleFilterChange() {
        const selectedUnit = unitFilter ? unitFilter.value : 'all';
        const selectedMonth = monthFilter ? monthFilter.value : 'all';
        applyFilters(selectedUnit, selectedMonth, data);
    }

    if (unitFilter) unitFilter.addEventListener('change', handleFilterChange);
    if (monthFilter) monthFilter.addEventListener('change', handleFilterChange);

    // Default variable to let Calendar Modal know what dates are active
    window.currentTargetDateCols = data.trend ? data.trend.rawLabels : [];

    // Initial Load (All Units, All Months)
    applyFilters('all', 'all', data);
    setupTableInteractions();


    // --- Company Calendar Logic --- //
    const btnCompanyCalendar = document.getElementById('btnCompanyCalendar');
    const companyCalendarModal = document.getElementById('companyCalendarModal');
    const btnCloseCompanyCalendar = document.getElementById('closeCompanyCalendar');
    const calCurrentYearEl = document.getElementById('calCurrentYear');
    const btnCalPrevYear = document.getElementById('calPrevYear');
    const btnCalNextYear = document.getElementById('calNextYear');
    const companyCalendarGrid = document.getElementById('companyCalendarGrid');

    let calSelectedYear = new Date().getFullYear();
    if (calSelectedYear < 2026) calSelectedYear = 2026;
    if (calSelectedYear > 2028) calSelectedYear = 2028;

    // Bangladesh Public Holidays (2026-2028 estimates/actuals where known)
    // Format: "YYYY-MM-DD": "Holiday Name"
    const bdHolidays = {
        // 2026
        "2026-02-21": "Language Martyrs' Day",
        "2026-03-17": "Sheikh Mujibur Rahman's Birthday",
        "2026-03-20": "Eid-ul-Fitr (Tentative)",
        "2026-03-21": "Eid-ul-Fitr (Tentative)",
        "2026-03-22": "Eid-ul-Fitr (Tentative)",
        "2026-03-26": "Independence Day",
        "2026-04-14": "Bengali New Year",
        "2026-05-01": "May Day",
        "2026-05-18": "Buddha Purnima (Tentative)",
        "2026-05-27": "Eid-ul-Adha (Tentative)",
        "2026-05-28": "Eid-ul-Adha (Tentative)",
        "2026-05-29": "Eid-ul-Adha (Tentative)",
        "2026-07-26": "Ashura (Tentative)",
        "2026-08-15": "National Mourning Day",
        "2026-08-26": "Janmashtami",
        "2026-09-26": "Eid-e-Milad-un-Nabi (Tentative)",
        "2026-10-18": "Durga Puja (Vijaya Dashami)",
        "2026-12-16": "Victory Day",
        "2026-12-25": "Christmas Day",

        // 2027
        "2027-02-21": "Language Martyrs' Day",
        "2027-03-10": "Eid-ul-Fitr (Tentative)",
        "2027-03-11": "Eid-ul-Fitr (Tentative)",
        "2027-03-12": "Eid-ul-Fitr (Tentative)",
        "2027-03-17": "Sheikh Mujibur Rahman's Birthday",
        "2027-03-26": "Independence Day",
        "2027-04-14": "Bengali New Year",
        "2027-05-01": "May Day",
        "2027-05-07": "Buddha Purnima (Tentative)",
        "2027-05-17": "Eid-ul-Adha (Tentative)",
        "2027-05-18": "Eid-ul-Adha (Tentative)",
        "2027-05-19": "Eid-ul-Adha (Tentative)",
        "2027-07-16": "Ashura (Tentative)",
        "2027-08-15": "National Mourning Day",
        "2027-08-16": "Janmashtami",
        "2027-09-15": "Eid-e-Milad-un-Nabi (Tentative)",
        "2027-10-08": "Durga Puja (Vijaya Dashami)",
        "2027-12-16": "Victory Day",
        "2027-12-25": "Christmas Day",

        // 2028
        "2028-02-21": "Language Martyrs' Day",
        "2028-02-28": "Eid-ul-Fitr (Tentative)",
        "2028-02-29": "Eid-ul-Fitr (Tentative)",
        "2028-03-01": "Eid-ul-Fitr (Tentative)",
        "2028-03-17": "Sheikh Mujibur Rahman's Birthday",
        "2028-03-26": "Independence Day",
        "2028-04-14": "Bengali New Year",
        "2028-04-26": "Buddha Purnima (Tentative)",
        "2028-05-01": "May Day",
        "2028-05-05": "Eid-ul-Adha (Tentative)",
        "2028-05-06": "Eid-ul-Adha (Tentative)",
        "2028-05-07": "Eid-ul-Adha (Tentative)",
        "2028-07-04": "Ashura (Tentative)",
        "2028-08-15": "National Mourning Day",
        "2028-08-24": "Janmashtami",
        "2028-09-03": "Eid-e-Milad-un-Nabi (Tentative)",
        "2028-09-27": "Durga Puja (Vijaya Dashami)",
        "2028-12-16": "Victory Day",
        "2028-12-25": "Christmas Day",
    };

    if (btnCompanyCalendar) {
        btnCompanyCalendar.addEventListener('click', () => {
            renderCompanyCalendarYear(calSelectedYear);
            companyCalendarModal.classList.remove('hidden');
        });
    }

    if (btnCloseCompanyCalendar) {
        btnCloseCompanyCalendar.addEventListener('click', () => {
            companyCalendarModal.classList.add('hidden');
        });
    }

    if (btnCalPrevYear) {
        btnCalPrevYear.addEventListener('click', () => {
            if (calSelectedYear > 2026) {
                calSelectedYear--;
                renderCompanyCalendarYear(calSelectedYear);
            }
        });
    }

    if (btnCalNextYear) {
        btnCalNextYear.addEventListener('click', () => {
            if (calSelectedYear < 2028) {
                calSelectedYear++;
                renderCompanyCalendarYear(calSelectedYear);
            }
        });
    }

    function renderCompanyCalendarYear(year) {
        if (!companyCalendarGrid) return;

        calCurrentYearEl.textContent = year;

        btnCalPrevYear.classList.toggle('opacity-50', year <= 2026);
        btnCalPrevYear.classList.toggle('cursor-not-allowed', year <= 2026);
        btnCalNextYear.classList.toggle('opacity-50', year >= 2028);
        btnCalNextYear.classList.toggle('cursor-not-allowed', year >= 2028);

        companyCalendarGrid.innerHTML = '';

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        for (let month = 0; month < 12; month++) {
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            let html = `
                <div class="glass-panel p-4 rounded-xl border border-white/5 bg-slate-800/40 hover:bg-slate-800/60 transition-colors">
                    <h3 class="text-white font-bold text-center mb-3 tracking-wide">${monthNames[month]}</h3>
                    <div class="grid grid-cols-7 gap-1 text-center text-[10px] md:text-xs mb-2">
                        <div class="text-gray-500 font-medium">S</div>
                        <div class="text-gray-500 font-medium">M</div>
                        <div class="text-gray-500 font-medium">T</div>
                        <div class="text-gray-500 font-medium">W</div>
                        <div class="text-gray-500 font-medium">T</div>
                        <div class="text-red-400/80 font-medium">F</div>
                        <div class="text-red-400/80 font-medium">S</div>
                    </div>
                    <div class="grid grid-cols-7 gap-1">
            `;

            for (let i = 0; i < firstDay; i++) {
                html += `<div></div>`;
            }

            for (let day = 1; day <= daysInMonth; day++) {
                const currentDate = new Date(year, month, day);
                const dayOfWeek = currentDate.getDay(); // 0=Sun, 5=Fri, 6=Sat
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
                const holidayName = bdHolidays[dateStr];
                const isToday = dateStr === todayStr;

                let dayClass = "w-6 h-6 md:w-7 md:h-7 mx-auto rounded-full flex items-center justify-center text-[10px] md:text-xs transition-colors ";
                let tooltip = "";

                if (holidayName) {
                    dayClass += "bg-red-500/20 text-red-100 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)] font-bold cursor-help";
                    tooltip = `title="${holidayName}"`;
                } else if (isWeekend) {
                    dayClass += "text-gray-500 hover:bg-slate-700/50";
                } else {
                    dayClass += "text-gray-300 hover:bg-slate-700 hover:text-white";
                }

                if (isToday) {
                    if (!holidayName) dayClass = dayClass.replace('text-gray-300', '').replace('text-gray-500', '');
                    dayClass += " ring-2 ring-indigo-500 font-bold " + (holidayName ? "" : "bg-indigo-500/20 text-indigo-300");
                }

                html += `<div ${tooltip} class="${dayClass}">${day}</div>`;
            }

            html += `
                    </div>
                </div>
            `;
            companyCalendarGrid.insertAdjacentHTML('beforeend', html);
        }
    }


    // --- Core Logic --- //

    function applyFilters(unitName, monthName, fullData) {
        if (!fullData.trend || !fullData.trend.rawLabels) return;

        let targetDateCols = fullData.trend.rawLabels;

        // Month Filter
        if (monthName !== 'all' && fullData.dateToMonth) {
            targetDateCols = targetDateCols.filter(d => fullData.dateToMonth[d] === monthName);
        }

        // Unit Filter
        let baseEmployees = fullData.employees || [];
        if (unitName !== 'all') {
            baseEmployees = baseEmployees.filter(emp => emp.branch === unitName);
        }

        // Deep copy so we can dynamically mutate stats without destroying cache
        allEmployees = JSON.parse(JSON.stringify(baseEmployees));

        let tPresent = 0;
        let tAbsent = 0;
        let tLateEntries = 0;
        let tRecords = 0;

        const branchMap = {};

        allEmployees.forEach(emp => {
            emp.presentDays = 0;
            emp.absentDays = 0;
            emp.lateDays = 0;
            emp.totalDays = 0;
            emp.lateDetails = []; // dynamically rebuild

            if (!branchMap[emp.branch]) {
                branchMap[emp.branch] = {
                    name: emp.branch,
                    employees: new Set(),
                    presentDays: 0,
                    absentDays: 0,
                    totalRecords: 0,
                    lateDays: 0,
                    trend: { present: {}, absent: {} }
                };
            }
            branchMap[emp.branch].employees.add(emp.id);

            // Dynamically count only the target dates
            targetDateCols.forEach(date => {
                const status = emp.dailyStatus[date];
                if (!status) return;

                if (status.type === 'present' || status.type === 'late') {
                    emp.presentDays++;
                    emp.totalDays++;
                    tPresent++;
                    tRecords++;

                    branchMap[emp.branch].presentDays++;
                    branchMap[emp.branch].totalRecords++;
                    branchMap[emp.branch].trend.present[date] = (branchMap[emp.branch].trend.present[date] || 0) + 1;

                    if (status.type === 'late') {
                        emp.lateDays++;
                        tLateEntries++;
                        branchMap[emp.branch].lateDays++;

                        // Extract late detail from the cached original fullData
                        const originalEmp = fullData.employees.find(e => e.id === emp.id);
                        if (originalEmp && originalEmp.lateDetails) {
                            const detail = originalEmp.lateDetails.find(l => l.date === date);
                            if (detail) emp.lateDetails.push(detail);
                        }
                    }
                } else if (status.type === 'absent' || status.type === 'leave') {
                    emp.absentDays++;
                    emp.totalDays++;
                    tAbsent++;
                    tRecords++;

                    branchMap[emp.branch].absentDays++;
                    branchMap[emp.branch].totalRecords++;
                    branchMap[emp.branch].trend.absent[date] = (branchMap[emp.branch].trend.absent[date] || 0) + 1;
                }
            });
            emp.attendanceRate = emp.totalDays > 0 ? ((emp.presentDays / emp.totalDays) * 100).toFixed(1) : 0;
        });

        // Reconstruct Branches Array for current filter
        const filteredBranches = Object.values(branchMap).map(b => {
            return {
                name: b.name,
                totalEmployees: b.employees.size,
                presentDays: b.presentDays,
                absentDays: b.absentDays,
                lateDays: b.lateDays,
                attendanceRate: b.totalRecords > 0 ? ((b.presentDays / b.totalRecords) * 100).toFixed(1) : 0,
            };
        });

        const filteredKpis = {
            totalEmployees: allEmployees.length,
            totalPresent: tPresent,
            totalAbsent: tAbsent,
            totalLateEntries: tLateEntries,
            overallRate: tRecords > 0 ? ((tPresent / tRecords) * 100).toFixed(1) : 0,
            totalActiveBranches: filteredBranches.length
        };

        let trendData = { labels: [], present: [], absent: [] };

        // Build trend specific to the current filters
        trendData.labels = targetDateCols.map(d => fullData.trend.labels[fullData.trend.rawLabels.indexOf(d)]);
        trendData.present = targetDateCols.map(d => {
            let p = 0; Object.values(branchMap).forEach(b => p += (b.trend.present[d] || 0)); return p;
        });
        trendData.absent = targetDateCols.map(d => {
            let a = 0; Object.values(branchMap).forEach(b => a += (b.trend.absent[d] || 0)); return a;
        });

        filteredEmployees = [...allEmployees]; // reset search/pagination scope
        currentPage = 1;

        window.currentTargetDateCols = targetDateCols; // used by Calendar modal
        window.currentFilteredBranches = filteredBranches; // used by Stats modal
        window.currentFilteredKpis = filteredKpis; // used by Stats modal

        populateKPIs(filteredKpis);
        initCharts(filteredKpis, filteredBranches, trendData);
        renderTable();
        generateInsights({ kpis: filteredKpis, branches: filteredBranches });
    }


    // --- Helper Functions --- //

    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                // Ensure final value respects decimals if needed
                obj.innerHTML = end % 1 !== 0 ? end.toFixed(1) : end;
            }
        };
        window.requestAnimationFrame(step);
    }

    function populateKPIs(kpis) {
        const totalEmpEl = document.getElementById('kpi-total-emp');
        const rateEl = document.getElementById('kpi-rate');
        const lateEl = document.getElementById('kpi-late');
        const branchesEl = document.getElementById('kpi-units');

        animateValue(totalEmpEl, 0, kpis.totalEmployees, 1000);

        // Custom animation for percentage
        let startTS = null;
        const targetRate = parseFloat(kpis.overallRate);
        const rateStep = (ts) => {
            if (!startTS) startTS = ts;
            const prog = Math.min((ts - startTS) / 1000, 1);
            rateEl.innerHTML = (prog * targetRate).toFixed(1) + '%';
            if (prog < 1) window.requestAnimationFrame(rateStep);
        };
        window.requestAnimationFrame(rateStep);

        animateValue(lateEl, 0, kpis.totalLateEntries || 0, 1000);
        animateValue(branchesEl, 0, kpis.totalActiveBranches, 1000);
    }

    function initCharts(kpis, branchesData, trendData) {
        // Chart Defaults
        const isYellow = document.body.classList.contains('theme-yellow');
        Chart.defaults.color = isYellow ? '#000000' : '#94a3b8';
        Chart.defaults.font.family = "'Outfit', sans-serif";
        Chart.defaults.scale.grid.color = isYellow ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
        Chart.defaults.plugins.tooltip.backgroundColor = isYellow ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.9)';
        Chart.defaults.plugins.tooltip.titleColor = isYellow ? '#000000' : '#fff';
        Chart.defaults.plugins.tooltip.bodyColor = isYellow ? '#000000' : '#cbd5e1';
        Chart.defaults.plugins.tooltip.borderColor = isYellow ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.padding = 12;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;

        // Common animation config
        const animationConfig = {
            duration: 1500,
            easing: 'easeOutQuart'
        };

        // Destroy existing to prevent overlaps
        if (chartInstances.bar) chartInstances.bar.destroy();
        if (chartInstances.line) chartInstances.line.destroy();
        if (chartInstances.pie) chartInstances.pie.destroy();

        // 1. Branch Performance Bar Chart
        const ctxBar = document.getElementById('unitBarChart').getContext('2d');
        const branchLabels = branchesData.map(b => b.name);
        const branchRates = branchesData.map(b => parseFloat(b.attendanceRate));

        // Gradients
        const barGradient = ctxBar.createLinearGradient(0, 0, 0, 400);
        barGradient.addColorStop(0, 'rgba(79, 70, 229, 0.8)'); // Indigo 600
        barGradient.addColorStop(1, 'rgba(79, 70, 229, 0.2)');

        chartInstances.bar = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: branchLabels,
                datasets: [{
                    label: 'Attendance Rate (%)',
                    data: branchRates,
                    backgroundColor: barGradient,
                    borderColor: 'rgba(79, 70, 229, 1)',
                    borderWidth: 1,
                    borderRadius: 6,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: animationConfig,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { callback: value => value + '%' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });

        // 2. Attendance Trend Line Chart
        const ctxLine = document.getElementById('trendChart').getContext('2d');

        const lineGrad1 = ctxLine.createLinearGradient(0, 0, 0, 400);
        lineGrad1.addColorStop(0, 'rgba(99, 102, 241, 0.5)'); // Indigo
        lineGrad1.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

        const lineGrad2 = ctxLine.createLinearGradient(0, 0, 0, 400);
        lineGrad2.addColorStop(0, 'rgba(236, 72, 153, 0.5)'); // Pink
        lineGrad2.addColorStop(1, 'rgba(236, 72, 153, 0.0)');

        chartInstances.line = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: trendData.labels || ['1', '2', '3', '4', '5'],
                datasets: [
                    {
                        label: 'Present',
                        data: trendData.present || [10, 20, 30, 40, 50],
                        borderColor: '#6366f1',
                        backgroundColor: lineGrad1,
                        borderWidth: 3,
                        pointBackgroundColor: '#1e1b4b',
                        pointBorderColor: '#6366f1',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Absent',
                        data: trendData.absent || [5, 4, 6, 2, 3],
                        borderColor: '#ec4899',
                        backgroundColor: lineGrad2,
                        borderWidth: 3,
                        pointBackgroundColor: '#1e1b4b',
                        pointBorderColor: '#ec4899',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: animationConfig,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxRotation: 90,
                            minRotation: 90
                        }
                    },
                    y: { beginAtZero: true }
                }
            }
        });

        // 3. Branch Distribution Doughnut
        const ctxPie = document.getElementById('unitPieChart').getContext('2d');
        const branchCounts = branchesData.map(b => b.totalEmployees);

        // Colors for Pie
        const pieColors = [
            '#4f46e5', // Indigo
            '#ec4899', // Pink
            '#8b5cf6', // Purple
            '#06b6d4', // Cyan
            '#10b981', // Emerald
            '#f59e0b', // Amber
            '#f43f5e'  // Rose
        ];

        chartInstances.pie = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: branchLabels,
                datasets: [{
                    data: branchCounts,
                    backgroundColor: pieColors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                animation: animationConfig,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: { size: 12 }
                        }
                    }
                }
            },
            plugins: [{
                id: 'centerTextPlugin',
                beforeDraw: function (chart) {
                    const width = chart.width;
                    const height = chart.height;
                    const ctx = chart.ctx;

                    ctx.restore();
                    // dynamically size font based on canvas height
                    const fontSize = (height / 120).toFixed(2);
                    ctx.font = "bold " + fontSize + "em Outfit, sans-serif";
                    ctx.textBaseline = "middle";

                    // Match theme color
                    ctx.fillStyle = document.body.classList.contains('theme-yellow') ? '#000000' : '#ffffff';

                    const text = kpis.totalActiveBranches.toString();
                    const textX = Math.round((width - ctx.measureText(text).width) / 2);
                    const textY = height / 2 - 10;

                    ctx.fillText(text, textX, textY);

                    ctx.font = "500 " + (fontSize * 0.4).toFixed(2) + "em Outfit, sans-serif";
                    ctx.fillStyle = document.body.classList.contains('theme-yellow') ? '#64748b' : '#94a3b8';
                    const text2 = "Sections";
                    const text2X = Math.round((width - ctx.measureText(text2).width) / 2);

                    ctx.fillText(text2, text2X, textY + 25);
                    ctx.save();
                }
            }]
        });
    }

    function renderTable() {
        const tbody = document.getElementById('employeeTableBody');
        const tableInfo = document.getElementById('tableInfo');

        tbody.innerHTML = '';

        if (filteredEmployees.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">No employees found matching the criteria.</td></tr>`;
            tableInfo.innerText = "Showing 0 entries";
            return;
        }

        // Prioritize specific employees to the top
        const pinnedEmployees = [
            'arif ahmed anik',
            'bithi rani das',
            'md takbir hossain',
            'mst nafija islam'
        ];

        filteredEmployees.sort((a, b) => {
            const indexA = pinnedEmployees.indexOf(a.name.toLowerCase().trim());
            const indexB = pinnedEmployees.indexOf(b.name.toLowerCase().trim());

            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;

            return a.name.localeCompare(b.name);
        });

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = Math.min(startIndex + rowsPerPage, filteredEmployees.length);
        const currentRows = filteredEmployees.slice(startIndex, endIndex);

        currentRows.forEach((emp, index) => {
            const absoluteIndex = startIndex + index;
            // Only apply the gold highlight if they are explicitly in the pinned list
            const isTop4 = pinnedEmployees.includes(emp.name.toLowerCase().trim());

            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-800/50 transition-colors group cursor-pointer relative" + (isTop4 ? " top4-row" : "");
            tr.style.animation = `fade-in 0.3s ease-out ${index * 0.05}s both`;
            tr.onclick = () => openCalendarModal(emp);

            // Generate Avatar Initials or Photo
            const isArif = emp.name.toLowerCase().trim() === 'arif ahmed anik';
            const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            const avatarColor = getAvatarColor(emp.name);

            const avatarHtml = isArif
                ? `<img src="arif.jpg" alt="${emp.name}" class="w-8 h-8 rounded-full object-cover ring-2 ring-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]">`
                : `<div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-inner" style="background-color: ${avatarColor}">${initials}</div>`;

            // Format Rate Status Indicator
            const rate = parseFloat(emp.attendanceRate);
            let rateClass = "text-green-400 bg-green-500/10 border-green-500/20";
            if (rate < 80) rateClass = "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
            if (rate < 60) rateClass = "text-red-400 bg-red-500/10 border-red-500/20";

            tr.innerHTML = `
                <td class="p-4 flex items-center gap-3">
                    ${avatarHtml}
                    <div>
                        <p class="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">${emp.name}</p>
                        <p class="text-xs text-gray-500">${emp.id}</p>
                    </div>
                </td>
                <td class="p-4 text-sm text-gray-300">${emp.branch}</td>
                <td class="p-4 text-sm text-gray-300 font-medium">${emp.totalDays}</td>
                <td class="p-4 text-sm text-gray-300">${emp.presentDays}</td>
                <td class="p-4 text-sm text-gray-300">${emp.absentDays} ${emp.lateDays > 0 ? `<br><span class="text-xs text-yellow-500">(${emp.lateDays} Late)</span>` : ''}</td>
                <td class="p-4 text-sm">
                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold border ${rateClass}">
                        ${emp.attendanceRate}%
                    </span>
                    <div class="absolute inset-y-0 right-4 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span class="bg-indigo-600 text-white text-xs px-2 py-1 rounded shadow-lg"><i class="fa-solid fa-arrow-right"></i></span>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tableInfo.innerText = `Showing ${startIndex + 1} to ${endIndex} of ${filteredEmployees.length} entries`;

        // Update button states
        const btnPrev = document.getElementById('prevPage');
        const btnNext = document.getElementById('nextPage');

        btnPrev.disabled = currentPage === 1;
        btnNext.disabled = endIndex >= filteredEmployees.length;

        btnPrev.className = `px-3 py-1 rounded transition ${currentPage === 1 ? 'bg-slate-800/50 text-gray-600 cursor-not-allowed' : 'bg-slate-800 text-gray-300 hover:bg-slate-700 hover:text-white'}`;
        btnNext.className = `px-3 py-1 rounded transition ${endIndex >= filteredEmployees.length ? 'bg-slate-800/50 text-gray-600 cursor-not-allowed' : 'bg-slate-800 text-gray-300 hover:bg-slate-700 hover:text-white'}`;
    }

    function setupTableInteractions() {
        const searchInput = document.getElementById('employeeSearch');
        const btnPrev = document.getElementById('prevPage');
        const btnNext = document.getElementById('nextPage');

        // Clone and replace to remove old event listeners which pile up on filter change
        const clonePrev = btnPrev.cloneNode(true);
        const cloneNext = btnNext.cloneNode(true);
        const cloneSearch = searchInput.cloneNode(true);

        btnPrev.parentNode.replaceChild(clonePrev, btnPrev);
        btnNext.parentNode.replaceChild(cloneNext, btnNext);
        searchInput.parentNode.replaceChild(cloneSearch, searchInput);

        // Keep a copy of the current unit's employees for search
        let unitEmployees = [...filteredEmployees];

        cloneSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            if (term === '') {
                filteredEmployees = [...unitEmployees];
            } else {
                filteredEmployees = unitEmployees.filter(emp =>
                    String(emp.id).toLowerCase().includes(term) || String(emp.name).toLowerCase().includes(term)
                );
            }
            currentPage = 1;
            renderTable();
        });

        clonePrev.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });

        cloneNext.addEventListener('click', () => {
            const maxPage = Math.ceil(filteredEmployees.length / rowsPerPage);
            if (currentPage < maxPage) {
                currentPage++;
                renderTable();
            }
        });
    }

    // Artificial "AI Insights" generator for that premium feel
    function generateInsights(data) {
        const container = document.getElementById('insightsContainer');
        container.innerHTML = '';

        const insights = [];

        // 1. Overall logic
        if (data.kpis.overallRate >= 85) {
            insights.push({ icon: 'fa-thumbs-up', color: 'green', text: `Excellent overall attendance rate at <strong>${data.kpis.overallRate}%</strong>. Keep up the good work!` });
        } else if (data.kpis.overallRate < 75) {
            insights.push({ icon: 'fa-triangle-exclamation', color: 'red', text: `Overall attendance is concerning at <strong>${data.kpis.overallRate}%</strong>. Action required.` });
        }

        // 2. Branch Logic
        if (data.branches.length > 1) {
            const sortedBranches = [...data.branches].sort((a, b) => b.attendanceRate - a.attendanceRate);
            const best = sortedBranches[0];
            const worst = sortedBranches[sortedBranches.length - 1];

            insights.push({ icon: 'fa-trophy', color: 'indigo', text: `<strong>${best.name}</strong> is performing best with ${best.attendanceRate}% attendance.` });

            if (worst.attendanceRate < 80) {
                insights.push({ icon: 'fa-circle-exclamation', color: 'yellow', text: `<strong>${worst.name}</strong> requires attention (only ${worst.attendanceRate}%).` });
            }
        }

        // 3. Absence Logic
        if (data.kpis.totalAbsent > data.kpis.totalPresent * 0.2) {
            insights.push({ icon: 'fa-user-nurse', color: 'pink', text: `High volume of absentees detected (${data.kpis.totalAbsent}). Check for potential widespread leave or sickness.` });
        }

        if (insights.length === 0) {
            insights.push({ icon: 'fa-check', color: 'indigo', text: `Attendance data looks stable without major anomalies.` });
        }

        // Build HTML
        insights.forEach((insight, idx) => {
            setTimeout(() => {
                const colors = {
                    green: 'bg-green-500/10 border-green-500/20 text-green-400',
                    red: 'bg-red-500/10 border-red-500/20 text-red-400',
                    yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
                    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
                    pink: 'bg-pink-500/10 border-pink-500/20 text-pink-400'
                };

                const c = colors[insight.color];

                container.innerHTML += `
                    <div class="p-4 rounded-xl flex gap-4 ${c} animate-fade-in" style="animation-fill-mode: both; animation-delay: ${idx * 0.3}s;">
                        <div class="mt-0.5"><i class="fa-solid ${insight.icon} text-lg"></i></div>
                        <div class="text-sm text-gray-200">${insight.text}</div>
                    </div>
                `;
            }, 500); // Artificial delay to simulate "AI processing"
        });
    }

    // Helper for Avatar colors
    function getAvatarColor(name) {
        const colors = ['#4f46e5', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    // Modal logic globally accessible
    window.openLateModal = function () {
        const modal = document.getElementById('lateModal');
        const content = document.getElementById('lateModalContent');
        const tbody = document.getElementById('lateTableBody');

        tbody.innerHTML = '';

        let lateList = [];
        filteredEmployees.forEach(emp => {
            if (emp.lateDetails && emp.lateDetails.length > 0) {
                emp.lateDetails.forEach(detail => {
                    lateList.push({
                        name: emp.name,
                        id: emp.id,
                        date: detail.date,
                        time: detail.inTime,
                        minutes: detail.minutes
                    });
                });
            }
        });

        lateList.sort((a, b) => b.minutes - a.minutes);

        if (lateList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-gray-500">No late arrivals recorded based on current filters.</td></tr>`;
        } else {
            lateList.forEach((late, i) => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-800/50 transition-colors";
                tr.style.animation = `fade-in 0.3s ease-out ${i * 0.05}s both`;

                tr.innerHTML = `
                    <td class="p-4">
                        <p class="text-sm font-medium text-white">${late.name}</p>
                        <p class="text-xs text-gray-500">${late.id}</p>
                    </td>
                    <td class="p-4 text-sm text-gray-300 font-medium">${late.date}</td>
                    <td class="p-4 text-sm text-gray-300 font-mono text-orange-400">${late.time}</td>
                    <td class="p-4 text-sm font-bold text-red-400">${Math.floor(late.minutes)} mins</td>
                `;
                tbody.appendChild(tr);
            });
        }

        modal.classList.remove('hidden');
        // trigger reflow
        void modal.offsetWidth;
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
    };

    window.closeLateModal = function () {
        const modal = document.getElementById('lateModal');
        const content = document.getElementById('lateModalContent');

        modal.classList.add('opacity-0');
        content.classList.add('scale-95');

        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    };

    // Calendar Modal Logic
    window.openCalendarModal = function (emp) {
        const modal = document.getElementById('calendarModal');
        const content = document.getElementById('calendarModalContent');

        // Setup Header
        document.getElementById('calEmpName').innerText = emp.name;
        document.getElementById('calEmpId').innerText = `${emp.id} • ${emp.branch}`;

        const avatar = document.getElementById('calAvatar');
        const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        avatar.style.backgroundColor = getAvatarColor(emp.name);
        avatar.innerText = initials;

        // Render Grid
        const grid = document.getElementById('calendarGrid');
        grid.innerHTML = '';

        // Summary Counts
        let cPresent = 0, cLate = 0, cAbsent = 0, cLeave = 0, cHoliday = 0;

        // Extract and sort dates from currently active filter constraints
        if (emp.dailyStatus && window.currentTargetDateCols && window.currentTargetDateCols.length > 0) {
            const dateKeys = window.currentTargetDateCols;
            // We'll rely on the existing chronological order or parse them.
            // Since columns are already sorted chronologically in app.js, we assume them ordered here.

            // For a perfect calendar, we ideally want to map to actual weekdays,
            // But since the dates are arbitrary (e.g., "January 26 Mon"), we'll parse the weekday
            // to place blanks at the start of the grid if necessary.

            const firstDateStr = dateKeys[0].toLowerCase();
            const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            let startOffset = 0;

            daysOfWeek.forEach((day, idx) => {
                if (firstDateStr.includes(day)) startOffset = idx;
            });

            // Add blank spaces before start of month/data
            for (let i = 0; i < startOffset; i++) {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'cal-empty p-3 rounded-xl border border-dashed border-white/5 bg-slate-800/20';
                grid.appendChild(emptyDiv);
            }

            dateKeys.forEach(date => {
                const status = emp.dailyStatus[date];
                const dayBox = document.createElement('div');

                // Color mapping
                let bgClass = "bg-slate-800/50 border-white/10 text-gray-400"; // Default/Unknown
                let indicator = "";
                let toolTipText = status.raw || status.type;

                if (status.type === 'present') {
                    bgClass = "cal-present bg-green-500/10 border-green-500/30 hover:border-green-500 text-green-400";
                    indicator = '<i class="fa-solid fa-check text-xs"></i>';
                    cPresent++;
                } else if (status.type === 'late') {
                    bgClass = "cal-late bg-orange-500/10 border-orange-500/30 hover:border-orange-500 text-orange-400";
                    indicator = '<i class="fa-solid fa-clock text-xs"></i>';
                    cLate++;
                } else if (status.type === 'absent') {
                    bgClass = "cal-absent bg-red-500/10 border-red-500/30 hover:border-red-500 text-red-400";
                    indicator = '<span class="font-bold text-xs">A</span>';
                    cAbsent++;
                } else if (status.type === 'lwp') {
                    bgClass = "cal-lwp bg-red-500/10 border-red-500/30 hover:border-red-500 text-red-500";
                    indicator = '<span class="font-bold text-[10px] leading-tight flex items-center justify-center">LWP</span>';
                    cLeave++;
                } else if (status.type === 'al') {
                    bgClass = "cal-al bg-blue-500/10 border-blue-500/30 hover:border-blue-500 text-blue-600";
                    indicator = '<span class="font-bold text-[10px] leading-tight flex items-center justify-center">AL</span>';
                    cLeave++;
                } else if (status.type === 'cl') {
                    bgClass = "cal-cl bg-gray-500/10 border-gray-500/30 hover:border-gray-500 text-gray-900";
                    indicator = '<span class="font-bold text-[10px] leading-tight flex items-center justify-center">CL</span>';
                    cLeave++;
                } else if (status.type === 'sl') {
                    bgClass = "cal-sl bg-pink-500/10 border-pink-500/30 hover:border-pink-500 text-pink-500";
                    indicator = '<span class="font-bold text-[10px] leading-tight flex items-center justify-center">SL</span>';
                    cLeave++;
                } else if (status.type === 'leave') {
                    bgClass = "cal-leave bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500 text-yellow-500";
                    indicator = `<span class="font-bold text-[10px] leading-tight flex items-center justify-center">${status.raw.substring(0, 2).toUpperCase()}</span>`;
                    cLeave++;
                } else if (status.type === 'holiday') {
                    bgClass = "cal-holiday bg-slate-500/10 border-slate-500/30 hover:border-slate-500 text-slate-400";
                    indicator = '<i class="fa-solid fa-mug-hot text-xs"></i>';
                    cHoliday++;
                }

                // Shorten date for display (e.g., "Jan 26")
                const shortDate = date.split(' ').slice(0, 2).join(' ');

                dayBox.className = `p-3 rounded-xl border transition-all relative group flex flex-col items-center justify-center min-h-[80px] cursor-help ${bgClass}`;
                dayBox.innerHTML = `
                    <p class="text-[10px] font-medium absolute top-2 left-2 opacity-70 whitespace-nowrap">${shortDate}</p>
                    <div class="mt-2 w-8 h-8 flex items-center justify-center rounded-full bg-slate-900/50 shadow-inner">
                        ${indicator}
                    </div>
                    
                    <!-- Tooltip -->
                    <div class="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-max">
                        <div class="cal-tooltip bg-slate-800 text-white text-xs px-3 py-1.5 rounded shadow-xl border border-white/10 whitespace-pre-wrap text-center relative z-10">
                            ${toolTipText}
                        </div>
                        <div class="cal-tooltip-arrow absolute top-full left-1/2 -ml-1 border-4 border-transparent border-t-slate-800/80"></div>
                    </div>
                `;
                grid.appendChild(dayBox);
            });

        } else {
            grid.innerHTML = `<div class="col-span-7 p-8 text-center text-gray-500">No daily status records found for this employee.</div>`;
        }

        // Apply Summary Counts
        document.getElementById('calSumPresent').innerText = cPresent;
        document.getElementById('calSumLate').innerText = cLate;
        document.getElementById('calSumAbsent').innerText = cAbsent;
        document.getElementById('calSumLeave').innerText = cLeave;
        document.getElementById('calSumHoliday').innerText = cHoliday;

        modal.classList.remove('hidden');
        // trigger reflow
        void modal.offsetWidth;
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
    };

    window.closeCalendarModal = function () {
        const modal = document.getElementById('calendarModal');
        const content = document.getElementById('calendarModalContent');

        modal.classList.add('opacity-0');
        content.classList.add('scale-95');

        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    };

    // Generic Stats Modal Logic
    window.openStatsModal = function (type) {
        if (!window.currentFilteredBranches || !window.currentFilteredKpis) return;

        const modal = document.getElementById('statsModal');
        const content = document.getElementById('statsModalContent');
        const thead = document.getElementById('statsModalThead');
        const tbody = document.getElementById('statsTableBody');

        const titleText = document.getElementById('statsModalHeaderText');
        const descText = document.getElementById('statsModalDesc');
        const iconSpan = document.getElementById('statsModalIcon');

        thead.innerHTML = '';
        tbody.innerHTML = '';

        const branches = window.currentFilteredBranches;

        if (type === 'employees') {
            titleText.innerText = "Section Employees";
            descText.innerText = `Total ${window.currentFilteredKpis.totalEmployees} employees across ${window.currentFilteredKpis.totalActiveBranches} sections.`;
            iconSpan.innerHTML = '<i class="fa-solid fa-users text-indigo-400"></i>';
            iconSpan.className = "w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-500/20";

            thead.innerHTML = `<tr>
                <th class="p-4 text-xs font-semibold text-gray-400 tracking-wider uppercase">Section Name</th>
                <th class="p-4 text-xs font-semibold text-gray-400 tracking-wider uppercase">Headcount</th>
            </tr>`;

            const sorted = [...branches].sort((a, b) => b.totalEmployees - a.totalEmployees);
            sorted.forEach((b, i) => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-800/50 transition-colors";
                tr.style.animation = `fade-in 0.3s ease-out ${i * 0.05}s both`;
                tr.innerHTML = `<td class="p-4 text-sm font-medium text-white">${b.name}</td>
                                <td class="p-4 text-sm font-bold text-indigo-400">${b.totalEmployees} <span class="text-gray-500 text-xs font-normal">emps</span></td>`;
                tbody.appendChild(tr);
            });
        } else if (type === 'rate') {
            titleText.innerText = "Section Attendance Rates";
            descText.innerText = `Overall completion is ${window.currentFilteredKpis.overallRate}%.`;
            iconSpan.innerHTML = '<i class="fa-solid fa-arrow-trend-up text-green-400"></i>';
            iconSpan.className = "w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/20";

            thead.innerHTML = `<tr>
                <th class="p-4 text-xs font-semibold text-gray-400 tracking-wider uppercase">Section Name</th>
                <th class="p-4 text-xs font-semibold text-gray-400 tracking-wider uppercase">Attendance Rate</th>
            </tr>`;

            const sorted = [...branches].sort((a, b) => b.attendanceRate - a.attendanceRate);
            sorted.forEach((b, i) => {
                let badgeColor = b.attendanceRate >= 85 ? 'border-green-500/50 text-green-400 bg-green-500/10' :
                    b.attendanceRate < 75 ? 'border-red-500/50 text-red-400 bg-red-500/10' :
                        'border-yellow-500/50 text-yellow-400 bg-yellow-500/10';

                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-800/50 transition-colors";
                tr.style.animation = `fade-in 0.3s ease-out ${i * 0.05}s both`;
                tr.innerHTML = `<td class="p-4 text-sm font-medium text-white">${b.name}</td>
                                <td class="p-4 text-sm"><span class="px-2 py-1 rounded-full border text-xs font-bold ${badgeColor}">${b.attendanceRate}%</span></td>`;
                tbody.appendChild(tr);
            });
        } else if (type === 'sections') {
            titleText.innerText = "Active Sections";
            descText.innerText = `Currently viewing ${window.currentFilteredKpis.totalActiveBranches} active sections.`;
            iconSpan.innerHTML = '<i class="fa-solid fa-location-dot text-purple-400"></i>';
            iconSpan.className = "w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/20";

            thead.innerHTML = `<tr>
                <th class="p-4 text-xs font-semibold text-gray-400 tracking-wider uppercase">Section Name</th>
                <th class="p-4 text-xs font-semibold text-gray-400 tracking-wider uppercase">Status</th>
            </tr>`;

            const sorted = [...branches].sort((a, b) => a.name.localeCompare(b.name));
            sorted.forEach((b, i) => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-800/50 transition-colors";
                tr.style.animation = `fade-in 0.3s ease-out ${i * 0.05}s both`;
                tr.innerHTML = `<td class="p-4 flex items-center gap-3">
                                    <div class="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
                                    <span class="text-sm font-medium text-white">${b.name}</span>
                                </td>
                                <td class="p-4 text-sm text-gray-400">Active Data Available</td>`;
                tbody.appendChild(tr);
            });
        }

        modal.classList.remove('hidden');
        void modal.offsetWidth; // trigger reflow
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
    };

    window.closeStatsModal = function () {
        const modal = document.getElementById('statsModal');
        const content = document.getElementById('statsModalContent');

        modal.classList.add('opacity-0');
        content.classList.add('scale-95');

        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    };

    // --- Clock Widget Logic ---
    function initClock() {
        // ... (existing code remains unchanged)
        const hourHand = document.getElementById('hourHand');
        const minHand = document.getElementById('minHand');
        const secHand = document.getElementById('secHand');
        const digitalClock = document.getElementById('digitalClock');

        if (!hourHand) return; // Guard clause if elements are missing

        function updateClock() {
            const now = new Date();
            let hours = now.getHours();
            let minutes = now.getMinutes();
            let seconds = now.getSeconds();
            let milliseconds = now.getMilliseconds();

            // Digital Clock
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12; // 12-hour format
            const displayMin = minutes < 10 ? '0' + minutes : minutes;
            const displaySec = seconds < 10 ? '0' + seconds : seconds;
            digitalClock.innerText = `${displayHours}:${displayMin}:${displaySec} ${ampm}`;

            // Analogue Clock (Smooth movement using milliseconds for seconds)
            const secDeg = ((seconds + milliseconds / 1000) / 60) * 360;
            const minDeg = ((minutes + seconds / 60) / 60) * 360;
            const hourDeg = ((hours % 12 + minutes / 60) / 12) * 360;

            secHand.style.transform = `rotate(${secDeg}deg)`;
            minHand.style.transform = `rotate(${minDeg}deg)`;
            hourHand.style.transform = `rotate(${hourDeg}deg)`;

            requestAnimationFrame(updateClock);
        }

        updateClock();
    }

    initClock(); // Start the clock

    // --- Modal Backdrop Click-to-Close Logic ---
    window.addEventListener('click', (e) => {
        const lateModal = document.getElementById('lateModal');
        const calendarModal = document.getElementById('calendarModal');
        const statsModal = document.getElementById('statsModal');
        const companyCalendarModal = document.getElementById('companyCalendarModal');

        // Check if the click occurred directly on the modal container background (not the children)
        if (e.target === lateModal) window.closeLateModal();
        if (e.target === calendarModal) window.closeCalendarModal();
        if (e.target === statsModal) window.closeStatsModal();

        // The company calendar has inline closure logic, trigger its button if present
        if (e.target === companyCalendarModal) {
            const closeBtn = document.getElementById('closeCompanyCalendar');
            if (closeBtn) closeBtn.click();
        }
    });

});
