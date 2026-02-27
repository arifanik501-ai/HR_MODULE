document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const uploadContainer = document.getElementById('uploadContainer');
    const processingState = document.getElementById('processingState');
    const previewContainer = document.getElementById('previewContainer');

    // Elements for preview & UI flow
    const progressBar = document.getElementById('progressBar');
    const processingText = document.getElementById('processingText');
    const previewThead = document.getElementById('previewThead');
    const previewTbody = document.getElementById('previewTbody');
    const btnCancel = document.getElementById('btnCancel');
    const btnProceed = document.getElementById('btnProceed');

    let processedData = null;
    let mappedColumns = null;

    // Drag and Drop Events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFileSelect, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        hideError();
        if (files.length === 0) return;

        const file = files[0];

        // Validate file type
        const validExtensions = ['.xlsx', '.xls'];
        const fileName = file.name;
        const fileExtension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

        if (!validExtensions.includes(fileExtension)) {
            showError(`Invalid file format. Please upload an Excel file (.xlsx or .xls).`);
            return;
        }

        processExcelFile(file);
    }

    function processExcelFile(file) {
        // UI Transition
        uploadContainer.classList.add('hidden');
        processingState.classList.remove('hidden');
        processingState.classList.add('flex');

        // Animate progress bar artificially
        progressBar.style.width = '30%';
        processingText.innerText = "Reading file contents...";

        const reader = new FileReader();

        reader.onload = function (e) {
            progressBar.style.width = '60%';
            processingText.innerText = "Parsing Excel data...";

            setTimeout(() => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // Assume the first sheet is the relevant one
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];

                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                    if (jsonData.length === 0) {
                        throw new Error("The Excel sheet appears to be empty.");
                    }

                    progressBar.style.width = '85%';
                    processingText.innerText = "Mapping columns and analyzing data...";

                    // Process JSON data
                    const result = analyzeData(jsonData);

                    if (!result.success) {
                        throw new Error(result.message);
                    }

                    processedData = result.data;
                    mappedColumns = result.columns;

                    progressBar.style.width = '100%';
                    processingText.innerText = "Processing complete.";

                    setTimeout(() => {
                        showPreview(jsonData, mappedColumns);
                    }, 500);

                } catch (error) {
                    resetUI();
                    showError(error.message || "An error occurred while parsing the file.");
                }
            }, 500); // Artificial delay to show smooth progress UI
        };

        reader.onerror = function (ex) {
            resetUI();
            showError("Failed to read the file.");
            console.error(ex);
        };

        reader.readAsArrayBuffer(file);
    }

    // Specific Column Extraction for Attendance_Report.xlsx
    function analyzeData(data) {
        if (data.length === 0) return { success: false, message: "Empty data" };

        const columns = Object.keys(data[0]);
        const map = {
            id: columns.find(c => c && c.toLowerCase().includes('id')),
            name: columns.find(c => c && c.toLowerCase().includes('name')),
            branch: columns.find(c => c && c.toLowerCase().trim() === 'unit') || columns.find(c => c && c.toLowerCase().includes('department')),
        };

        if (!map.name) {
            return {
                success: false,
                message: "Could not identify Employee Name column. Ensure you're uploading the exact Attendance_Report.xlsx."
            };
        }

        const dateColumns = columns.filter(c => {
            const lower = c.toLowerCase();
            return c !== map.id && c !== map.name && c !== map.branch &&
                !lower.includes('sl') && !lower.includes('company') &&
                !lower.includes('section') && !lower.includes('unit') &&
                !lower.includes('job location') && !lower.includes('summary');
        });

        const employees = {};
        const branches = {};
        let totalPresent = 0;
        let totalAbsent = 0;
        let totalRecords = 0;
        let totalLateEntries = 0;
        let uniqueDates = new Set();
        let dailyAttendance = {};

        data.forEach(row => {
            const empName = row[map.name];
            if (!empName || typeof empName !== 'string' || empName.trim() === '') return;

            const branchName = map.branch ? (row[map.branch] || 'Main HQ') : 'Main HQ';

            if (!employees[empName]) {
                employees[empName] = {
                    name: empName,
                    id: map.id ? row[map.id] : `EMP-${Object.keys(employees).length + 1}`,
                    branch: branchName,
                    presentDays: 0,
                    absentDays: 0,
                    lateDays: 0,
                    totalLateMinutes: 0,
                    lateDetails: [], // Array to store late occurrences
                    dailyStatus: {}, // Store exact string for each date
                    totalDays: 0
                };
            }

            if (!branches[branchName]) {
                branches[branchName] = {
                    name: branchName,
                    totalRecords: 0,
                    presentDays: 0,
                    absentDays: 0,
                    lateDays: 0,
                    employees: new Set(),
                    dailyAttendance: {}
                };
            }

            branches[branchName].employees.add(empName);

            dateColumns.forEach(dateCol => {
                const cellVal = row[dateCol];
                if (!cellVal) return;
                const strVal = String(cellVal).toLowerCase().trim();

                // Check for holiday/offday FIRST to prevent misclassification
                const isHoliday = strVal.includes('holiday') || strVal.includes('offday') || strVal.includes('off day')
                    || strVal === 'off' || strVal === 'wo' || strVal === 'w/o'
                    || strVal.includes('weekly off') || strVal.includes('rest day');

                if (isHoliday) {
                    uniqueDates.add(dateCol);
                    employees[empName].dailyStatus[dateCol] = { type: 'holiday', raw: String(cellVal).trim() };
                    return; // Skip further processing for this date
                }

                const isLate = strVal.includes('late');
                const isPresent = strVal === 'p' || /\\bp\\b/.test(strVal) || strVal.includes('present') || isLate;
                // Use stricter matching: match CL/SL/AL as standalone or with boundaries
                const clMatch = /\\bcl\\b/.test(strVal);
                const slMatch = /\\bsl\\b/.test(strVal);
                const alMatch = /\\bal\\b/.test(strVal);
                const lwpMatch = /\\blwp\\b/.test(strVal);
                const isAbsent = strVal === 'a' || /\\ba\\b/.test(strVal) || strVal.includes('absent') || strVal.includes('leave') || clMatch || slMatch || alMatch || lwpMatch;

                // If explicit status found
                if (isPresent || isAbsent) {
                    totalRecords++;
                    branches[branchName].totalRecords++;
                    employees[empName].totalDays++;

                    if (isPresent) {
                        totalPresent++;
                        branches[branchName].presentDays++;
                        employees[empName].presentDays++;

                        // Determine if late (Duty time 8:00 AM)
                        const parts = String(cellVal).split('\n');
                        if (parts.length > 1) {
                            const inTimeStr = parts[1].trim().toLowerCase();
                            const timeMatch = inTimeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
                            if (timeMatch) {
                                let hours = parseInt(timeMatch[1], 10);
                                const mins = parseInt(timeMatch[2], 10);
                                const ampm = timeMatch[3];

                                if (ampm === 'pm' && hours < 12) hours += 12;
                                if (ampm === 'am' && hours === 12) hours = 0;

                                const arrivalMinutes = hours * 60 + mins;
                                const dutyMinutes = 8 * 60; // 08:00 AM

                                if (arrivalMinutes > dutyMinutes) { // User is late
                                    const lateMins = arrivalMinutes - dutyMinutes;
                                    totalLateEntries++;
                                    branches[branchName].lateDays++;
                                    employees[empName].lateDays++;
                                    employees[empName].totalLateMinutes += lateMins;
                                    employees[empName].lateDetails.push({
                                        date: dateCol,
                                        inTime: parts[1].trim(),
                                        minutes: lateMins
                                    });
                                }
                            }
                        }
                    }
                    if (isAbsent) {
                        totalAbsent++;
                        branches[branchName].absentDays++;
                        employees[empName].absentDays++;
                    }

                    uniqueDates.add(dateCol);

                    // Store the raw parsed cell string for exactly what happened this day
                    let displayStr = String(cellVal).trim();
                    if (isLate) {
                        employees[empName].dailyStatus[dateCol] = { type: 'late', raw: displayStr };
                    } else if (isPresent) {
                        employees[empName].dailyStatus[dateCol] = { type: 'present', raw: displayStr };
                    } else if (isAbsent) {
                        let finalType = 'absent';
                        if (lwpMatch) finalType = 'lwp';
                        else if (alMatch) finalType = 'al';
                        else if (clMatch) finalType = 'cl';
                        else if (slMatch) finalType = 'sl';
                        else if (strVal.includes('leave')) finalType = 'leave';

                        employees[empName].dailyStatus[dateCol] = {
                            type: finalType,
                            raw: displayStr
                        };
                    }

                    if (!dailyAttendance[dateCol]) {
                        dailyAttendance[dateCol] = { present: 0, absent: 0 };
                    }
                    if (!branches[branchName].dailyAttendance[dateCol]) {
                        branches[branchName].dailyAttendance[dateCol] = { present: 0, absent: 0 };
                    }
                    if (isPresent || isLate) {
                        dailyAttendance[dateCol].present++;
                        branches[branchName].dailyAttendance[dateCol].present++;
                    }
                    if (isAbsent) {
                        dailyAttendance[dateCol].absent++;
                        branches[branchName].dailyAttendance[dateCol].absent++;
                    }
                }
            });
        });

        // Map Payroll Months (26th to 25th)
        const monthNamesList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        function getPayrollMonth(dateStr) {
            const match = dateStr.match(/([a-zA-Z]+)\s+(\d{1,2})/);
            if (!match) return "Unknown";
            const mName = match[1];
            let mIndex = monthNamesList.findIndex(m => m.toLowerCase().startsWith(mName.toLowerCase()));
            if (mIndex === -1) return "Unknown";
            const day = parseInt(match[2], 10);
            if (day >= 26) mIndex = (mIndex + 1) % 12;
            return monthNamesList[mIndex];
        }

        const dateToMonth = {};
        const uniquePayrollMonths = new Set();
        Array.from(uniqueDates).forEach(dateCol => {
            const pMonth = getPayrollMonth(dateCol);
            dateToMonth[dateCol] = pMonth;
            if (pMonth !== "Unknown") uniquePayrollMonths.add(pMonth);
        });

        Object.values(employees).forEach(emp => {
            emp.attendanceRate = emp.totalDays > 0 ? ((emp.presentDays / emp.totalDays) * 100).toFixed(1) : 0;
        });

        const sortedDates = Array.from(uniqueDates).sort((a, b) => columns.indexOf(a) - columns.indexOf(b));

        const formatLabel = (dateStr) => {
            const months = {
                'January': 'Jan', 'February': 'Feb', 'March': 'Mar', 'April': 'Apr',
                'August': 'Aug', 'September': 'Sep', 'October': 'Oct', 'November': 'Nov', 'December': 'Dec'
            };
            let formatted = dateStr;
            for (const [full, short] of Object.entries(months)) {
                formatted = formatted.replace(new RegExp(full, 'gi'), short);
            }
            return formatted;
        };

        const formattedBranches = Object.values(branches).map(b => ({
            name: b.name,
            totalEmployees: b.employees.size,
            presentDays: b.presentDays,
            absentDays: b.absentDays,
            lateDays: b.lateDays,
            attendanceRate: b.totalRecords > 0 ? ((b.presentDays / b.totalRecords) * 100).toFixed(1) : 0,
            trend: {
                labels: sortedDates.map(formatLabel),
                present: sortedDates.map(d => b.dailyAttendance[d]?.present || 0),
                absent: sortedDates.map(d => b.dailyAttendance[d]?.absent || 0)
            }
        }));

        const totalEmployees = Object.keys(employees).length;
        const totalActiveBranches = Object.keys(branches).length;
        const overallRate = totalRecords > 0 ? ((totalPresent / totalRecords) * 100).toFixed(1) : 0;

        const trendData = {
            labels: sortedDates.map(formatLabel),
            rawLabels: sortedDates,
            present: sortedDates.map(d => dailyAttendance[d]?.present || 0),
            absent: sortedDates.map(d => dailyAttendance[d]?.absent || 0)
        };

        const finalData = {
            kpis: {
                totalEmployees,
                totalPresent,
                totalAbsent,
                totalLateEntries,
                overallRate,
                totalActiveBranches
            },
            employees: Object.values(employees),
            branches: formattedBranches,
            trend: trendData,
            payrollMonths: Array.from(uniquePayrollMonths),
            dateToMonth: dateToMonth
        };

        return {
            success: true,
            columns: { map, dates: dateColumns.slice(0, 3) }, // Keep just a few dates for preview
            data: finalData
        };
    }

    function showPreview(rawData, mappingResult) {
        processingState.classList.add('hidden');
        processingState.classList.remove('flex');

        previewContainer.classList.remove('hidden');

        const map = mappingResult.map;
        const dates = mappingResult.dates;
        const colsToShow = [];
        if (map.id) colsToShow.push(map.id);
        if (map.name) colsToShow.push(map.name);
        if (map.branch) colsToShow.push(map.branch);
        colsToShow.push(...dates); // Add a few dates to preview

        let headerHTML = '<tr>';
        colsToShow.forEach(col => {
            headerHTML += `<th class="text-xs font-semibold tracking-wider text-gray-400 uppercase">${col}</th>`;
        });
        headerHTML += '</tr>';
        previewThead.innerHTML = headerHTML;

        let bodyHTML = '';
        // Skip first row if it's metadata, but SheetJS usually handles headers if it's the very top.
        const previewRows = rawData.slice(0, 5);

        previewRows.forEach((row, i) => {
            bodyHTML += `<tr style="animation: fade-in 0.3s ease-out ${i * 0.1}s both;">`;
            colsToShow.forEach(col => {
                let cellValue = row[col] !== undefined ? row[col] : '-';
                // Simple string formatting
                if (typeof cellValue === 'string') {
                    cellValue = cellValue.split('\n')[0]; // Take only first line to keep it clean (e.g. "Present")
                    const lval = cellValue.toLowerCase();
                    if (lval === 'p' || lval.includes('present')) {
                        cellValue = `<span class="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-xs">${cellValue}</span>`;
                    } else if (lval.includes('late')) {
                        cellValue = `<span class="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs">${cellValue}</span>`;
                    } else if (lval === 'a' || lval.includes('absent')) {
                        cellValue = `<span class="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-xs">${cellValue}</span>`; // deep red
                    } else if (lval.includes('lwp')) {
                        cellValue = `<span class="px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 border border-red-400/20 text-xs">${cellValue}</span>`; // red
                    } else if (lval.includes('al')) {
                        cellValue = `<span class="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 text-xs">${cellValue}</span>`; // deep blue
                    } else if (lval.includes('cl')) {
                        cellValue = `<span class="px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-900 border border-gray-500/20 text-xs">${cellValue}</span>`; // black
                    } else if (lval.includes('sl')) {
                        cellValue = `<span class="px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-500 border border-pink-500/20 text-xs">${cellValue}</span>`; // pink
                    } else if (lval === 'h' || lval.includes('holiday') || lval.includes('offday') || lval.includes('off')) {
                        cellValue = `<span class="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs">${cellValue}</span>`;
                    }
                }
                bodyHTML += `<td class="text-sm text-gray-300 py-3">${cellValue}</td>`;
            });
            bodyHTML += '</tr>';
        });

        if (rawData.length > 5) {
            bodyHTML += `<tr><td colspan="${colsToShow.length}" class="text-center text-xs text-slate-500 py-3 italic">... and ${rawData.length - 5} more rows</td></tr>`;
        }

        previewTbody.innerHTML = bodyHTML;

        btnProceed.onclick = finalizeAndRedirect;
        btnCancel.onclick = resetUI;
    }

    function finalizeAndRedirect() {
        // Save processed data to local storage
        try {
            localStorage.setItem('attendanceDashboardData', JSON.stringify(processedData));
            // Show a quick loader on the button
            btnProceed.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
            btnProceed.classList.add('opacity-80', 'cursor-not-allowed');

            // Push to Firebase RTDB asynchronously
            if (typeof window.pushToFirebase === 'function') {
                window.pushToFirebase(processedData).then(success => {
                    let msg = success ? "Synced to cloud!" : "Local mode (Cloud sync failed)";
                    btnProceed.innerHTML = '<i class="fa-solid fa-check"></i> ' + msg;
                });
            }

            // Redirect to dashboard page
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 600);

        } catch (e) {
            console.error("Localstorage save failed:", e);
            alert("Could not save data. File might be too large for local cache.");
            resetUI();
        }
    }

    function resetUI() {
        previewContainer.classList.add('hidden');
        processingState.classList.add('hidden');
        processingState.classList.remove('flex');
        uploadContainer.classList.remove('hidden');

        progressBar.style.width = '0%';
        fileInput.value = '';
        processedData = null;
        mappedColumns = null;
    }

    function showError(msg) {
        errorText.innerText = msg;
        errorMessage.classList.remove('hidden');
        setTimeout(() => {
            errorMessage.classList.add('hidden');
        }, 5000);
    }

    function hideError() {
        errorMessage.classList.add('hidden');
    }
});
