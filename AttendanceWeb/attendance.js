// ==========================================
// 1. FIREBASE INITIALIZATION & CLOUD SYNC
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBE1dmuSIRa-_Ub7TgiE9ix9cVKYyt0pvE",
    authDomain: "attendance-master-ee26b.firebaseapp.com",
    projectId: "attendance-master-ee26b",
    storageBucket: "attendance-master-ee26b.firebasestorage.app",
    messagingSenderId: "784934726094",
    appId: "1:784934726094:web:002e6c14861d330b96e39f"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let subjects = [];
let timetable = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] };
let historyLog = [];
let dismissedAlerts = []; 
let userProfile = { name: "", roll: "", sec: "", course: "", sem: "", regNo: "", avatar: "https://placehold.co/120x120/00d2ff/ffffff?text=U" };
let preferences = { targetPct: 75, alerts: true, predictive: true, autoMark: true, autoDelete: "never" };
let overrides = {};

let currentCalMonth = new Date().getMonth();
let currentCalYear = new Date().getFullYear();

const saveToLocal = async () => {
    const user = auth.currentUser;
    if (user) {
        try {
            await db.collection("users").doc(user.uid).set({
                subjects, timetable, historyLog, userProfile, preferences, overrides, dismissedAlerts
            });
        } catch (error) {
            console.error("Cloud Sync Error:", error);
            showToast("Cloud sync failed. Working locally.", "error");
        }
    }

    localStorage.setItem('edu_subjects', JSON.stringify(subjects));
    localStorage.setItem('edu_timetable', JSON.stringify(timetable));
    localStorage.setItem('edu_history', JSON.stringify(historyLog));
    localStorage.setItem('edu_profile', JSON.stringify(userProfile));
    localStorage.setItem('edu_preferences', JSON.stringify(preferences));
    localStorage.setItem('edu_overrides', JSON.stringify(overrides));

    refreshAllUI();
};

auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const doc = await db.collection("users").doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                subjects = data.subjects || [];
                timetable = data.timetable || { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] };
                historyLog = data.historyLog || [];
                userProfile = data.userProfile || userProfile;
                preferences = data.preferences || preferences;
                overrides = data.overrides || {};
                dismissedAlerts = data.dismissedAlerts || [];
            }
        } catch (e) { console.error("Cloud Fetch Failed", e); }

        cleanUpHistory();
        refreshAllUI();
    } else {
        if (!window.location.pathname.includes("login.html") && !window.location.pathname.includes("signup.html")) {
            window.location.href = "login.html";
        }
    }
});

const refreshAllUI = () => {
    updateNavProfile(); 
    if (document.getElementById('subjectsContainer')) renderDashboard();
    if (document.getElementById('timetableGrid')) renderTimetableGrid(); 
    if (document.getElementById('historyContainer')) { renderHistoryList(); renderCalendar(); }
    if (document.getElementById('notificationsList')) renderNotifications();
    if (document.getElementById('profileInputName')) renderAccount();
    if (document.getElementById('targetSlider')) renderSettings();
    renderNotificationsGlobal();
};

window.handleLogout = () => {
    auth.signOut().then(() => {
        localStorage.clear();
        window.location.href = "login.html";
    });
};

// ==================================
// 2. GLOBAL UI UTILS & MODALS
// ==================================
const showToast = (message, type = 'success') => {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer'; container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'bx-check-circle' : 'bx-info-circle';
    toast.innerHTML = `<i class='bx ${icon}'></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.4s ease forwards';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
};

const updateNavProfile = () => {
    const firstLetter = (userProfile.name ? userProfile.name.charAt(0).toUpperCase() : "U");
    const defaultAvatar = `https://placehold.co/120x120/00d2ff/ffffff?text=${firstLetter}`;
    
    const navAvatar = document.getElementById('bottomNavAvatar');
    if (navAvatar) navAvatar.src = userProfile.avatar || defaultAvatar;

    const mainAvatar = document.getElementById('mainAvatarDisplay');
    if (mainAvatar) mainAvatar.src = userProfile.avatar || defaultAvatar;
};

const tabs = document.querySelectorAll('.tab-btn');
if (tabs.length > 0) {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const parent = tab.parentElement;
            parent.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const shell = tab.closest('.glass-shell') || document.body;
            shell.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const targetContent = document.getElementById(`tab-${tab.dataset.tab}`);
            if (targetContent) targetContent.classList.add('active');
        });
    });
}

// ==========================
// 3. DASHBOARD LOGIC 
// ==========================
const subModal = document.getElementById('modalBackdrop');
window.openSubModalGlobal = (isEdit = false, subId = null) => {
    if (!subModal) return;
    subModal.style.display = 'flex';
    if (isEdit) {
        const sub = subjects.find(s => s.id === subId);
        document.getElementById('modalTitle').textContent = "Edit Subject";
        document.getElementById('editFields').style.display = 'block';
        document.getElementById('editSubjectId').value = sub.id;
        document.getElementById('subjectName').value = sub.name;
        document.getElementById('editPresent').value = sub.present;
        document.getElementById('editTotal').value = sub.total;
    } else {
        document.getElementById('modalTitle').textContent = "Add Subject";
        document.getElementById('editFields').style.display = 'none';
        document.getElementById('editSubjectId').value = '';
    }
};

const closeSubModal = () => { if (subModal) subModal.style.display = 'none'; };
if (document.getElementById('addSubjectBtn')) document.getElementById('addSubjectBtn').onclick = () => window.openSubModalGlobal(false);
if (document.getElementById('closeModal')) document.getElementById('closeModal').onclick = closeSubModal;
if (document.getElementById('closeModalIcon')) document.getElementById('closeModalIcon').onclick = closeSubModal;

if (document.getElementById('saveSubject')) {
    document.getElementById('saveSubject').onclick = () => {
        const id = document.getElementById('editSubjectId').value;
        const name = document.getElementById('subjectName').value.trim();
        if (!name) return alert("Fill Subject Name");
        if (id) {
            const sub = subjects.find(s => s.id == id);
            sub.name = name;
            sub.present = parseInt(document.getElementById('editPresent').value) || 0;
            sub.total = parseInt(document.getElementById('editTotal').value) || 0;
        } else {
            subjects.push({ id: Date.now(), name, present: 0, total: 0 });
        }
        saveToLocal(); closeSubModal(); showToast("Subject saved!");
    };
}

const renderDashboard = () => {
    const statsCont = document.getElementById('subjectsContainer');
    if (!statsCont) return;
    statsCont.innerHTML = '';

    if (document.getElementById('todayCount')) {
        document.getElementById('todayCount').textContent = subjects.length;
    }

    const target = preferences.targetPct || 75;
    const targetDecimal = target / 100;
    let gPres = 0, gTotal = 0;

    subjects.forEach(sub => {
        gPres += sub.present; gTotal += sub.total;
        const pct = sub.total === 0 ? 0 : Math.round((sub.present / sub.total) * 100);
        const nextPctIfMissed = sub.total === 0 ? 0 : Math.round((sub.present / (sub.total + 1)) * 100);
        
        let bunkInfo = { txt: "", cls: "safe" };

        if (sub.total === 0) bunkInfo = { txt: "No classes yet", cls: "safe" };
        else if (pct < target) {
            const mustAttend = Math.ceil((targetDecimal * sub.total - sub.present) / (1 - targetDecimal));
            bunkInfo = { txt: `Must attend next <b>${mustAttend}</b> classes`, cls: "danger" };
        } else if (preferences.predictive && nextPctIfMissed < target) {
            bunkInfo = { txt: `Warning: Next bunk drops you to ${nextPctIfMissed}%`, cls: "warning" };
        } else {
            const canMiss = Math.floor(sub.present / targetDecimal) - sub.total;
            bunkInfo = { txt: `Can safely miss <b>${canMiss}</b> classes`, cls: "safe" };
        }

        statsCont.innerHTML += `
            <div class="glass-card subject-row" style="flex-direction: column; align-items: flex-start; gap: 15px;">
                <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                    <div class="subject-details"><h4>${sub.name}</h4><p style="margin:0; font-size:0.85rem; color:var(--text-muted);">${sub.present}/${sub.total} Classes</p></div>
                    <div class="actions" style="align-items: center;">
                        <span style="font-size:1.3rem; font-weight:700; color:${pct < target ? 'var(--danger)' : (bunkInfo.cls==='warning'?'var(--warning)':'var(--success)')}; margin-right:10px;">${pct}%</span>
                        <button class="icon-btn" onclick="openSubModalGlobal(true, ${sub.id})"><i class='bx bx-pencil'></i></button>
                        <button class="icon-btn delete-btn" onclick="deleteSubject(${sub.id})"><i class='bx bx-trash'></i></button>
                    </div>
                </div>
                <div class="bunk-calc ${bunkInfo.cls}">${bunkInfo.txt}</div>
            </div>`;
    });

    const gPct = gTotal === 0 ? 0 : Math.round((gPres / gTotal) * 100);
    if (document.getElementById('overallPct')) document.getElementById('overallPct').textContent = `${gPct}%`;
    if (document.getElementById('overallBar')) document.getElementById('overallBar').style.width = `${gPct}%`;
    renderTodaySchedule();
};

window.markAttendance = (id, isPresent, slotId = null) => {
    const sub = subjects.find(s => s.id === id);
    if (sub) {
        sub.total++; if (isPresent) sub.present++;
        const now = new Date();
        historyLog.unshift({
            logId: Date.now(), subId: sub.id, subName: sub.name, status: isPresent ? 'Present' : 'Absent',
            date: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            timestamp: now.getTime()
        });

        if (slotId) {
            const todayStr = new Date().toDateString();
            if (!overrides[todayStr]) overrides[todayStr] = { canceled: [], extra: [], marked: {} };
            if (!overrides[todayStr].marked) overrides[todayStr].marked = {};
            overrides[todayStr].marked[slotId] = isPresent ? 'Present' : 'Absent';
        }

        saveToLocal(); showToast(`Marked ${isPresent ? 'Present' : 'Absent'} for ${sub.name}`);
    }
};

window.deleteSubject = (id) => {
    if (confirm("Delete this subject and all its data?")) {
        subjects = subjects.filter(s => s.id !== id);
        for (let day in timetable) timetable[day] = timetable[day].filter(slot => slot.subId !== id);
        historyLog = historyLog.filter(log => log.subId !== id);
        saveToLocal();
    }
};

window.deleteHistoryLog = (logId) => {
    const logIndex = historyLog.findIndex(l => l.logId === logId);
    if (logIndex !== -1) {
        const log = historyLog[logIndex];
        const sub = subjects.find(s => s.id === log.subId);
        if (sub && log.status !== 'Canceled') {
            sub.total = Math.max(0, sub.total - 1);
            if (log.status === 'Present') sub.present = Math.max(0, sub.present - 1);
        }
        historyLog.splice(logIndex, 1); saveToLocal(); showToast("Entry removed");
    }
};


// ==========================================
// 4. TIMETABLE ENGINE
// ==========================================
const renderTimetableGrid = () => {
    const grid = document.getElementById('timetableGrid');
    if (!grid) return;

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    let allTimes = new Set();
    days.forEach(d => {
        if(timetable[d]) timetable[d].forEach(slot => allTimes.add(slot.time));
    });
    let sortedTimes = Array.from(allTimes).sort();

    if (sortedTimes.length === 0) {
        grid.innerHTML = `<tr><td style="padding: 40px; color: var(--text-muted); border: none;">Your timetable is empty. Click <b>'Add Class'</b> to start building your grid!</td></tr>`;
        return;
    }

    let thead = `<thead><tr><th>Day</th>`;
    sortedTimes.forEach(time => { thead += `<th>${time}</th>`; });
    thead += `</tr></thead>`;

    let tbody = `<tbody>`;
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const actualToday = daysOfWeek[new Date().getDay()];

    days.forEach(day => {
        const isToday = day === actualToday ? 'current-day' : '';
        let row = `<tr class="${isToday}"><td class="day-cell">${day}</td>`;

        sortedTimes.forEach(time => {
            const slot = (timetable[day] || []).find(s => s.time === time);
            if (slot) {
                const sub = slot.subId === 'free' ? {name: "Break"} : subjects.find(s => s.id == slot.subId);
                const subName = sub ? sub.name : "Deleted";
                const breakClass = slot.isBreak ? "slot-break" : "";
                const inlineStyle = slot.isBreak ? "" : "background: rgba(255, 255, 255, 0.08);";
                
                row += `<td>
                    <div class="grid-slot ${breakClass}" style="${inlineStyle}" onclick="openSlotModal('edit', '${slot.slotId}', '${day}')">
                        <span class="slot-name">${subName}</span>
                    </div>
                </td>`;
            } else {
                row += `<td class="empty-cell" onclick="openSlotModal('add', null, '${day}', '${time}')"><i class='bx bx-plus'></i></td>`;
            }
        });
        row += `</tr>`;
        tbody += row;
    });
    tbody += `</tbody>`;
    grid.innerHTML = thead + tbody;
};

window.openSlotModal = (mode, slotId = null, day = 'Monday', time = '') => {
    if (subjects.length === 0) return alert("Please create a Subject in the Dashboard first!");
    
    const slotSelect = document.getElementById('slotSubjectSelect');
    if (slotSelect) {
        let optionsHTML = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        optionsHTML += `<option value="free">☕ Free Period / Break</option>`;
        slotSelect.innerHTML = optionsHTML;
    }

    const modal = document.getElementById('slotModalBackdrop');
    document.getElementById('slotDaySelect').value = day;
    document.getElementById('slotTimeInput').value = time;
    
    if (mode === 'edit') {
        document.getElementById('slotModalTitle').textContent = "Edit Class";
        document.getElementById('editSlotId').value = slotId;
        document.getElementById('deleteSlotBtn').style.display = 'block';
        
        const slot = timetable[day].find(s => s.slotId === slotId);
        if(slot) {
            document.getElementById('slotTimeInput').value = slot.time;
            document.getElementById('slotSubjectSelect').value = slot.subId;
            document.getElementById('slotIsBreak').checked = slot.isBreak || false;
        }
    } else {
        document.getElementById('slotModalTitle').textContent = "Add to Timetable";
        document.getElementById('editSlotId').value = "";
        document.getElementById('deleteSlotBtn').style.display = 'none';
        document.getElementById('slotIsBreak').checked = false;
    }
    
    modal.style.display = 'flex';
};

if(document.getElementById('addTimetableSlotBtn')) {
    document.getElementById('addTimetableSlotBtn').onclick = () => openSlotModal('add');
}
if(document.getElementById('closeSlotModal')) {
    document.getElementById('closeSlotModal').onclick = () => document.getElementById('slotModalBackdrop').style.display = 'none';
}

if (document.getElementById('saveSlotBtn')) {
    document.getElementById('saveSlotBtn').onclick = () => {
        const slotId = document.getElementById('editSlotId').value;
        const day = document.getElementById('slotDaySelect').value;
        const time = document.getElementById('slotTimeInput').value;
        const subId = document.getElementById('slotSubjectSelect').value;
        const isBreak = document.getElementById('slotIsBreak').checked;

        if (!time) return showToast("Select a time", "error");

        const newSlot = { 
            slotId: slotId ? slotId : 'slot_' + Date.now(), 
            subId: subId === 'free' ? 'free' : parseInt(subId), 
            time, isBreak 
        };

        if (slotId) {
            for (let d in timetable) {
                if (timetable[d]) timetable[d] = timetable[d].filter(s => s.slotId !== slotId);
            }
            showToast("Class Updated!");
        } else {
            showToast("Class Added!");
        }

        if (!timetable[day]) timetable[day] = [];

        timetable[day].push(newSlot);
        saveToLocal();
        document.getElementById('slotModalBackdrop').style.display = 'none';
    };
}

if (document.getElementById('deleteSlotBtn')) {
    document.getElementById('deleteSlotBtn').onclick = () => {
        const slotId = document.getElementById('editSlotId').value;
        for (let d in timetable) {
            if (timetable[d]) timetable[d] = timetable[d].filter(s => s.slotId !== slotId);
        }
        saveToLocal();
        document.getElementById('slotModalBackdrop').style.display = 'none';
        showToast("Class Deleted", "error");
    };
}

window.cancelTodayClass = (slotId, subId, isExtra = false) => {
    const todayStr = new Date().toDateString();
    if (!overrides[todayStr]) overrides[todayStr] = { canceled: [], extra: [], marked: {} };
    if (isExtra) overrides[todayStr].extra = overrides[todayStr].extra.filter(s => s.slotId !== slotId);
    else if (!overrides[todayStr].canceled.includes(slotId)) overrides[todayStr].canceled.push(slotId);
    saveToLocal();
};

const renderTodaySchedule = () => {
    const scheduleCont = document.getElementById('scheduleContainer');
    const liveCont = document.getElementById('happeningNowContainer');
    if (!scheduleCont) return;

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const actualToday = days[new Date().getDay()];
    const todayStr = new Date().toDateString();
    const todayOverrides = overrides[todayStr] || { canceled: [], extra: [], marked: {} };

    let allSlots = [...(timetable[actualToday] || []), ...todayOverrides.extra];
    allSlots.sort((a, b) => a.time.localeCompare(b.time));

    let liveHTML = '';
    const nowAbs = (new Date().getHours() * 60) + new Date().getMinutes();

    scheduleCont.innerHTML = allSlots.map(slot => {
        if (slot.isBreak || slot.subId === 'free') return ''; 
        
        const sub = subjects.find(s => s.id === slot.subId);
        if (!sub) return '';

        const isCanceled = todayOverrides.canceled && todayOverrides.canceled.includes(slot.slotId);
        const markedStatus = todayOverrides.marked ? todayOverrides.marked[slot.slotId] : null;

        if (isCanceled) {
            return `<div class="glass-card subject-row action-taken-canceled" style="border-left: 4px solid var(--text-muted)">
                <div class="row-info"><span class="time-tag" style="text-decoration: line-through;">${slot.time}</span><h4>${sub.name}</h4></div>
                <div class="actions"><span class="status-badge" style="color: var(--text-muted);"><i class='bx bx-block'></i> Canceled</span></div>
            </div>`;
        }

        if (markedStatus) {
            const isPres = markedStatus === 'Present';
            return `<div class="glass-card subject-row ${isPres ? 'action-taken-present' : 'action-taken-absent'}" style="border-left: 4px solid ${isPres ? 'var(--success)' : 'var(--danger)'}">
                <div class="row-info"><span class="time-tag">${slot.time}</span><h4>${sub.name}</h4></div>
                <div class="actions"><span class="status-badge ${isPres ? 'safe' : 'danger'}"><i class='bx bx-check'></i> ${markedStatus}</span></div>
            </div>`;
        }

        const [h, m] = slot.time.split(':').map(Number);
        const slotAbs = (h * 60) + m;
        if (preferences.autoMark && nowAbs >= (slotAbs - 10) && nowAbs <= (slotAbs + 50)) {
            liveHTML = `<div class="glass-card happening-now-card" style="padding:20px; margin-bottom:20px; border-left: 4px solid var(--accent)">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div><span style="color:var(--danger); font-size:0.75rem; font-weight:bold;">LIVE NOW</span><br><b>${sub.name}</b><p style="margin:0; font-size:0.85rem;">${slot.time}</p></div>
                    <div style="display:flex; gap:10px;">
                        <button class="glass-btn primary" onclick="markAttendance(${sub.id}, true, '${slot.slotId}')">Present</button>
                        <button class="glass-btn absent" onclick="markAttendance(${sub.id}, false, '${slot.slotId}')">Absent</button>
                    </div>
                </div>
            </div>`;
        }

        return `<div class="glass-card subject-row" style="border-left: 4px solid var(--glass-border)">
            <div class="row-info"><span class="time-tag">${slot.time}</span><h4>${sub.name}</h4></div>
            <div class="actions">
                <button class="glass-btn present text-btn" onclick="markAttendance(${sub.id}, true, '${slot.slotId}')">Present</button>
                <button class="glass-btn absent text-btn" onclick="markAttendance(${sub.id}, false, '${slot.slotId}')">Absent</button>
                <button class="icon-btn" onclick="cancelTodayClass('${slot.slotId}', ${sub.id})"><i class='bx bx-x-circle'></i></button>
            </div>
        </div>`;
    }).join('');

    if (allSlots.length === 0) scheduleCont.innerHTML = `<p style="text-align:center; padding: 20px; color:var(--text-muted);">No classes today!</p>`;

    if (liveCont) {
        liveCont.innerHTML = liveHTML;
        liveCont.style.display = liveHTML ? 'block' : 'none';
    }
};

window.openExtraClassModal = () => {
    const select = document.getElementById('extraSubjectSelect');
    if (select) select.innerHTML = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    document.getElementById('extraClassModal').style.display = 'flex';
};

window.closeExtraClassModal = () => { 
    document.getElementById('extraClassModal').style.display = 'none'; 
};

window.saveExtraClass = () => {
    const subId = document.getElementById('extraSubjectSelect').value;
    const time = document.getElementById('extraTimeInput').value;
    if (!time) return alert("Select time");
    const todayStr = new Date().toDateString();
    if (!overrides[todayStr]) overrides[todayStr] = { canceled: [], extra: [], marked: {} };
    overrides[todayStr].extra.push({ slotId: 'extra_' + Date.now(), subId: parseInt(subId), time, isExtra: true });
    saveToLocal();
    window.closeExtraClassModal();
};

// ==========================================
// 6. HISTORY, CALENDAR
// ==========================================
const cleanUpHistory = () => {
    if (!preferences.autoDelete || preferences.autoDelete === "never") return;
    const limits = { "7D": 7, "1M": 30, "3M": 90, "6M": 180 };
    const cutoff = Date.now() - (limits[preferences.autoDelete] * 24 * 60 * 60 * 1000);
    const oldLen = historyLog.length;
    historyLog = historyLog.filter(l => l.timestamp >= cutoff);
    if (historyLog.length < oldLen) saveToLocal();
};

const renderHistoryList = () => {
    const cont = document.getElementById('historyContainer');
    if (!cont) return;
    if (historyLog.length === 0) { cont.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:30px;">No activity logged yet.</p>`; return; }

    cont.innerHTML = historyLog.map(log => `
        <div class="glass-card history-card" style="border-left-color: ${log.status === 'Present' ? 'var(--success)' : 'var(--danger)'};">
            <div class="history-info"><h4>${log.subName}</h4><p class="history-date">${log.date} at ${log.time}</p></div>
            <div class="history-actions">
                <span class="status-badge ${log.status === 'Present' ? 'safe' : 'danger'}">${log.status}</span>
                <button class="icon-btn delete-btn" onclick="deleteHistoryLog(${log.logId})"><i class='bx bx-undo'></i></button>
            </div>
        </div>`).join('');
};

const renderCalendar = () => {
    const grid = document.getElementById('calendarGrid');
    const display = document.getElementById('calendarMonthDisplay');
    if (!grid || !display) return;
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    display.textContent = `${monthNames[currentCalMonth]} ${currentCalYear}`;
    
    const firstDay = new Date(currentCalYear, currentCalMonth, 1).getDay();
    const daysInMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();
    let html = '';
    
    for (let i = 0; i < firstDay; i++) html += `<div class="calendar-day empty"></div>`;
    
    for (let i = 1; i <= daysInMonth; i++) {
        const dStr = new Date(currentCalYear, currentCalMonth, i).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const dayLogs = historyLog.filter(l => l.date === dStr);
        let dots = dayLogs.slice(0, 3).map(l => `<div class="indicator-dot ${l.status === 'Present' ? 'present' : 'absent'}"></div>`).join('');
        
        const clickAction = dayLogs.length > 0 ? `onclick="openDayDetails('${dStr}')"` : '';
        const cursorStyle = dayLogs.length > 0 ? 'cursor: pointer;' : 'cursor: default;';
        
        html += `<div class="calendar-day" ${clickAction} style="${cursorStyle}">${i}<div class="day-indicators">${dots}</div></div>`;
    }
    grid.innerHTML = html;
};

window.openDayDetails = (dateStr) => {
    const logs = historyLog.filter(l => l.date === dateStr);
    if (logs.length === 0) return;
    
    document.getElementById('dayDetailsTitle').textContent = `Logs for ${dateStr}`;
    document.getElementById('dayDetailsList').innerHTML = logs.map(log => `
        <div class="glass-card history-card" style="border-left-color: ${log.status === 'Present' ? 'var(--success)' : 'var(--danger)'};">
            <div class="history-info"><h4>${log.subName}</h4><p class="history-date">${log.time}</p></div>
            <div class="history-actions"><span class="status-badge ${log.status === 'Present' ? 'safe' : 'danger'}">${log.status}</span></div>
        </div>`).join('');
    
    document.getElementById('dayDetailsModal').style.display = 'flex';
};

if (document.getElementById('prevMonthBtn')) {
    document.getElementById('prevMonthBtn').onclick = () => { currentCalMonth--; if (currentCalMonth < 0) { currentCalMonth = 11; currentCalYear--; } renderCalendar(); };
    document.getElementById('nextMonthBtn').onclick = () => { currentCalMonth++; if (currentCalMonth > 11) { currentCalMonth = 0; currentCalYear++; } renderCalendar(); };
}

window.clearAllHistory = () => {
    if (confirm("Clear all visual history? Your subject totals will remain intact.")) {
        historyLog = []; saveToLocal(); showToast("History cleared", "error");
    }
};

// ==========================================
// 7. SMART ALERTS & NOTIFICATIONS
// ==========================================
window.dismissAlert = (subId) => {
    if(!dismissedAlerts.includes(subId)) dismissedAlerts.push(subId);
    saveToLocal();
};

window.dismissAllAlerts = () => {
    subjects.forEach(sub => {
        if (!dismissedAlerts.includes(sub.id)) dismissedAlerts.push(sub.id);
    });
    saveToLocal();
    showToast("All alerts dismissed");
};

const renderNotificationsGlobal = () => {
    let count = 0;
    const target = preferences.targetPct || 75;
    subjects.forEach(sub => {
        if (sub.total === 0 || dismissedAlerts.includes(sub.id)) return;
        const pct = Math.round((sub.present / sub.total) * 100);
        const nextPct = Math.round((sub.present / (sub.total + 1)) * 100);
        if (pct < target || (preferences.predictive && nextPct < target)) count++;
    });
    document.querySelectorAll('.badge').forEach(b => {
        b.textContent = count;
        b.style.display = count > 0 ? 'inline-block' : 'none';
    });
    if (document.getElementById('alertCountText')) document.getElementById('alertCountText').textContent = count === 0 ? "Everything looks good!" : `${count} alerts.`;
};

const renderNotifications = () => {
    const list = document.getElementById('notificationsList');
    if (!list) return;
    const target = preferences.targetPct || 75;
    let html = '';
    subjects.forEach(sub => {
        if (sub.total === 0 || dismissedAlerts.includes(sub.id)) return;
        const pct = Math.round((sub.present / sub.total) * 100);
        const nextPct = Math.round((sub.present / (sub.total + 1)) * 100);
        
        if (pct < target) {
            html += `<div class="alert-card alert-danger">
                <i class='bx bx-error-circle alert-icon'></i>
                <div class="alert-content"><h4>Danger: ${sub.name}</h4><p>Critical: ${pct}%. Attend next classes.</p></div>
                <button class="icon-btn" onclick="dismissAlert(${sub.id})" style="position:absolute; top:10px; right:10px;"><i class='bx bx-x'></i></button>
            </div>`;
        } else if (preferences.predictive && nextPct < target) {
            html += `<div class="alert-card alert-warning">
                <i class='bx bx-error alert-icon'></i>
                <div class="alert-content"><h4>Warning: ${sub.name}</h4><p>Next bunk drops you to ${nextPct}%.</p></div>
                <button class="icon-btn" onclick="dismissAlert(${sub.id})" style="position:absolute; top:10px; right:10px;"><i class='bx bx-x'></i></button>
            </div>`;
        }
    });
    list.innerHTML = html || `<div class="empty-alerts"><h3>All clear!</h3><p>No warnings to display.</p></div>`;
};

// ==========================================
// 8. SETTINGS, EXPORTS & ACCOUNT LOGIC
// ==========================================
const renderSettings = () => {
    if (document.getElementById('targetSlider')) {
        document.getElementById('targetSlider').value = preferences.targetPct;
        document.getElementById('targetDisplay').textContent = preferences.targetPct + '%';
        document.getElementById('prefPredictive').checked = preferences.predictive;
        document.getElementById('prefAutoMark').checked = preferences.autoMark;
        document.getElementById('prefAutoDelete').value = preferences.autoDelete;
    }
};

if (document.getElementById('targetSlider')) {
    document.getElementById('targetSlider').oninput = e => document.getElementById('targetDisplay').textContent = e.target.value + '%';
    document.getElementById('targetSlider').onchange = e => { preferences.targetPct = parseInt(e.target.value); saveToLocal(); };
    document.getElementById('prefPredictive').onchange = e => { preferences.predictive = e.target.checked; saveToLocal(); };
    document.getElementById('prefAutoMark').onchange = e => { preferences.autoMark = e.target.checked; saveToLocal(); };
    document.getElementById('prefAutoDelete').onchange = e => { preferences.autoDelete = e.target.value; saveToLocal(); };
}

window.exportToExcel = () => {
    if (historyLog.length === 0) return showToast("No history to export!", "error");
    const exportData = historyLog.map(log => ({ "Date": log.date, "Time": log.time, "Subject": log.subName, "Status": log.status }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance History");
    XLSX.writeFile(wb, `Attendance_${userProfile.regNo || "Report"}.xlsx`);
};

window.exportToPDF = () => {
    if (historyLog.length === 0) return showToast("No history to export!", "error");
    const doc = new window.jspdf.jsPDF();
    doc.setFont("helvetica", "bold"); doc.text(`Attendance Report`, 14, 20);
    const tableData = historyLog.map(log => [log.date, log.time, log.subName, log.status]);
    doc.autoTable({ startY: 30, head: [['Date', 'Time', 'Subject', 'Status']], body: tableData });
    doc.save(`Attendance_${userProfile.regNo || "Report"}.pdf`);
};

window.startNewSemester = () => {
    if (confirm("DANGER: Start a new semester? This will WIPE your subjects, timetable, and history. Your profile and settings will be saved.")) {
        subjects = [];
        timetable = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] };
        historyLog = [];
        overrides = {};
        saveToLocal();
        showToast("New Semester initialized!", "success");
    }
};

window.hardResetApp = () => {
    if (confirm("DANGER: Are you absolutely sure? This deletes ALL subjects and data!")) {
        const user = firebase.auth().currentUser;
        if (user) { db.collection("users").doc(user.uid).delete().then(() => { localStorage.clear(); window.location.href = "login.html"; }); } 
        else { localStorage.clear(); window.location.href = "login.html"; }
    }
};

const renderAccount = () => {
    if (!document.getElementById('profileInputName')) return; 
    
    document.getElementById('profileInputName').value = userProfile.name || "";
    document.getElementById('profileInputRoll').value = userProfile.roll || "";
    document.getElementById('profileInputRegNo').value = userProfile.regNo || "";
    document.getElementById('profileInputSec').value = userProfile.sec || "";
    
    if (document.getElementById('profileInputCourse')) document.getElementById('profileInputCourse').value = userProfile.course || "";
    if (document.getElementById('profileInputSem')) document.getElementById('profileInputSem').value = userProfile.sem || "1";
    
    const emailInput = document.getElementById('profileInputEmail');
    if (emailInput) {
        const user = firebase.auth().currentUser;
        emailInput.value = userProfile.email || (user ? user.email : "Not linked");
    }
    
    updateIDCardRealtime(); 
};

window.updateIDCardRealtime = () => {
    if (!document.getElementById('idCardName')) return;
    
    const n = document.getElementById('profileInputName').value || "Student Name";
    const c = document.getElementById('profileInputCourse') ? document.getElementById('profileInputCourse').value || "Course" : "Course";
    const s = document.getElementById('profileInputSem') ? document.getElementById('profileInputSem').value || "1" : "1";
    const r = document.getElementById('profileInputRoll').value || "--";
    const sec = document.getElementById('profileInputSec').value || "--";
    let reg = document.getElementById('profileInputRegNo').value || "--";
    reg = reg.toUpperCase();

    document.getElementById('idCardName').textContent = n;
    document.getElementById('idCardCourse').textContent = `${c} - Semester ${s}`;
    document.getElementById('idCardRoll').textContent = r;
    document.getElementById('idCardSec').textContent = sec;
    document.getElementById('idCardRegNo').textContent = `Reg No: ${reg}`;
};

const avatarInput = document.getElementById('avatarUpload');
if (avatarInput) {
    avatarInput.addEventListener('change', function () {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = e => {
                userProfile.avatar = e.target.result;
                saveToLocal();
                document.getElementById('mainAvatarDisplay').src = userProfile.avatar;
                if (document.getElementById('bottomNavAvatar')) document.getElementById('bottomNavAvatar').src = userProfile.avatar;
                showToast("ID Photo Updated!");
            };
            reader.readAsDataURL(this.files[0]);
        }
    });
}

window.saveProfile = async () => {
    const saveBtn = document.getElementById('saveProfileBtn');
    const originalText = saveBtn ? saveBtn.innerHTML : "Save Profile Changes";
    if (saveBtn) saveBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Saving...";

    userProfile.name = document.getElementById('profileInputName').value.trim();
    userProfile.roll = document.getElementById('profileInputRoll').value.trim();
    userProfile.regNo = document.getElementById('profileInputRegNo').value.trim().toUpperCase();
    userProfile.sec = document.getElementById('profileInputSec').value.trim();
    
    if (document.getElementById('profileInputCourse')) userProfile.course = document.getElementById('profileInputCourse').value.trim();
    if (document.getElementById('profileInputSem')) userProfile.sem = document.getElementById('profileInputSem').value;

    await saveToLocal();
    showToast("Profile Updated Successfully!");

    if (saveBtn) saveBtn.innerHTML = "<i class='bx bx-check'></i> Saved!";
    setTimeout(() => { if (saveBtn) saveBtn.innerHTML = originalText; }, 2000);
};

document.addEventListener('DOMContentLoaded', () => {
    const lp = localStorage.getItem('edu_profile');
    const lpre = localStorage.getItem('edu_preferences');
    if (lp) userProfile = JSON.parse(lp);
    if (lpre) preferences = JSON.parse(lpre);
    refreshAllUI();

    const navLinks = document.querySelectorAll('.main-nav-pill .nav-item');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetUrl = link.getAttribute('href');
            if (window.location.pathname.endsWith(targetUrl) || targetUrl === '#') { e.preventDefault(); return; }
            e.preventDefault();
            navLinks.forEach(n => n.classList.remove('active'));
            link.classList.add('active');
            setTimeout(() => { window.location.href = targetUrl; }, 300); 
        });
    });
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js?v=1.3.0.7'); });
}

// ==========================================
// 9. PWA SERVICE WORKER REGISTRATION
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js?v=3.1.0.7')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(error => {
                console.error('ServiceWorker registration failed: ', error);
            });
    });
}