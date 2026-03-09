// ==========================================
// 1. FIREBASE INITIALIZATION & CLOUD SYNC
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBE1dmuSIRa-_Ub7TgiE9ix9cVKYyt0pvE",
    authDomain: "attendance-master-ee26b.firebaseapp.com",
    projectId: "attendance-master-ee26b",
    storageBucket: "attendance-master-ee26b.firebasestorage.app",
    messagingSenderId: "784934726094",
    appId: "1:784934726094:web:002e6c14861d330b96e39f",
    measurementId: "G-NFH4R271VE"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global State Variables
let subjects = [];
let timetable = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] };
let historyLog = [];
let userProfile = { name: "", roll: "", sec: "", course: "", sem: "", regNo: "", targetPct: 75, avatar: "https://placehold.co/120x120/00d2ff/ffffff?text=U" };
let overrides = {}; 
let currentTimetableDay = "Monday";

// Save to Cloud & Local Backup
const saveToLocal = async () => {
    const user = auth.currentUser;
    if (user) {
        try {
            await db.collection("users").doc(user.uid).set({
                subjects, timetable, historyLog, userProfile, overrides
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
    localStorage.setItem('edu_overrides', JSON.stringify(overrides));

    refreshAllUI();
};

// Listen for Login/Logout
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const doc = await db.collection("users").doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                subjects = data.subjects || [];
                timetable = data.timetable || { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };
                historyLog = data.historyLog || [];
                userProfile = data.userProfile || userProfile;
                overrides = data.overrides || {};
            }
        } catch (e) {
            console.error("Failed to fetch from cloud", e);
        }
        refreshAllUI();
    } else {
        if (!window.location.pathname.includes("login.html") && !window.location.pathname.includes("signup.html")) {
            window.location.href = "login.html";
        }
    }
});

const refreshAllUI = () => {
    updateSidebarProfile();
    if (document.getElementById('scheduleContainer')) renderDashboard();
    if (document.getElementById('timetableList')) renderTimetable();
    if (document.getElementById('historyContainer')) renderHistory();
    if (document.getElementById('notificationsList')) renderNotifications();
    if (document.getElementById('profileInputName')) renderAccount();
    renderNotificationsGlobal();
};

window.handleLogout = () => {
    auth.signOut().then(() => {
        localStorage.clear(); 
        window.location.href = "login.html";
    });
};

// ==========================================
// 2. GLOBAL UI UTILS (Toasts & Sidebar)
// ==========================================
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

const menuToggle = document.getElementById('menuToggle');
const closeMenu = document.getElementById('closeMenu');
const sideNav = document.getElementById('sideNav');
const navBackdrop = document.getElementById('navBackdrop');
const toggleSidebar = () => { sideNav.classList.toggle('open'); navBackdrop.classList.toggle('active'); };
if (menuToggle) menuToggle.onclick = toggleSidebar;
if (closeMenu) closeMenu.onclick = toggleSidebar;
if (navBackdrop) navBackdrop.onclick = toggleSidebar;

const updateSidebarProfile = () => {
    // Generate letter avatar if the user hasn't uploaded a custom photo
    if (!userProfile.avatar || userProfile.avatar.includes("placehold.co") || !userProfile.avatar.startsWith("data:")) {
        const firstLetter = (userProfile.name ? userProfile.name.charAt(0).toUpperCase() : "U");
        userProfile.avatar = `https://placehold.co/120x120/00d2ff/ffffff?text=${firstLetter}`;
    }

    // Update Sidebar
    const nameEl = document.getElementById('profileName');
    const infoEl = document.getElementById('profileInfo');
    const avatarEl = document.getElementById('sidebarAvatar');
    if (nameEl) nameEl.textContent = userProfile.name || "Student";
    if (infoEl) infoEl.textContent = `Roll: ${userProfile.roll || "--"} | Sec: ${userProfile.sec || "--"}`;
    if (avatarEl) avatarEl.src = userProfile.avatar;

    // Force Account Page Avatar to sync perfectly with Sidebar!
    const mainAvatar = document.getElementById('mainAvatarDisplay');
    if (mainAvatar && !userProfile.avatar.startsWith("data:")) {
        mainAvatar.src = userProfile.avatar;
    }
};


// ==========================================
// 3. DASHBOARD LOGIC
// ==========================================
const tabs = document.querySelectorAll('.tab-btn');
if (tabs.length > 0) {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const targetContent = document.getElementById(`tab-${tab.dataset.tab}`);
            if (targetContent) targetContent.classList.add('active');
        });
    });
}

const subModal = document.getElementById('modalBackdrop');
if (document.getElementById('addSubjectBtn')) {
    document.getElementById('addSubjectBtn').onclick = () => {
        subModal.style.display = 'flex';
        document.getElementById('modalTitle').textContent = "Add Subject";
        document.getElementById('editFields').style.display = 'none';
        document.getElementById('editSubjectId').value = '';
    };
}

window.openSubModalGlobal = (isEdit = false, subId = null) => {
    if (!subModal) return;
    subModal.style.display = 'flex';
    if (isEdit) {
        const sub = subjects.find(s => s.id === subId);
        document.getElementById('modalTitle').textContent = "Edit Subject";
        document.getElementById('editFields').style.display = 'block';
        document.getElementById('editSubjectId').value = sub.id;
        document.getElementById('subjectName').value = sub.name;
        document.getElementById('subjectTime').value = sub.time;
        document.getElementById('editPresent').value = sub.present;
        document.getElementById('editTotal').value = sub.total;
    }
};

const closeSubModal = () => {
    if (subModal) subModal.style.display = 'none';
    ['subjectName', 'editPresent', 'editTotal', 'subjectTime'].forEach(id => {
        if (document.getElementById(id)) document.getElementById(id).value = '';
    });
};
if (document.getElementById('closeModal')) document.getElementById('closeModal').onclick = closeSubModal;
if (document.getElementById('closeModalIcon')) document.getElementById('closeModalIcon').onclick = closeSubModal;

if (document.getElementById('saveSubject')) {
    document.getElementById('saveSubject').onclick = () => {
        const id = document.getElementById('editSubjectId').value;
        const name = document.getElementById('subjectName').value.trim();
        const time = document.getElementById('subjectTime').value || "09:00";
        if (!name) return alert("Fill Subject Name");
        if (id) {
            const sub = subjects.find(s => s.id == id);
            sub.name = name; sub.time = time;
            sub.present = parseInt(document.getElementById('editPresent').value) || 0;
            sub.total = parseInt(document.getElementById('editTotal').value) || 0;
        } else {
            subjects.push({ id: Date.now(), name, time, present: 0, total: 0 });
        }
        saveToLocal(); closeSubModal(); showToast("Subject saved!");
    };
}

// ==========================================
// 4. DASHBOARD STATS & SUBJECTS
// ==========================================
const renderDashboard = () => {
    const statsCont = document.getElementById('subjectsContainer');
    if (!statsCont) return;

    statsCont.innerHTML = '';
    let gPres = 0, gTotal = 0;
    const target = userProfile.targetPct || 75;
    const targetDecimal = target / 100;

    subjects.forEach(sub => {
        gPres += sub.present; gTotal += sub.total;
        const pct = sub.total === 0 ? 0 : Math.round((sub.present / sub.total) * 100);
        let bunkInfo = sub.total === 0 ? { txt: "No classes yet", cls: "safe" } :
            pct >= target ? { txt: `Can safely miss <b>${Math.floor(sub.present / targetDecimal) - sub.total}</b> classes`, cls: "safe" } :
                { txt: `Must attend next <b>${Math.ceil((targetDecimal * sub.total - sub.present) / (1 - targetDecimal))}</b> classes`, cls: "danger" };

        statsCont.innerHTML += `
            <div class="glass-card subject-row" style="flex-direction: column; align-items: flex-start; gap: 15px;">
                <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                    <div class="subject-details"><h4>${sub.name}</h4><p style="margin:0; font-size:0.85rem; color:var(--text-muted);">${sub.present} / ${sub.total} Classes</p></div>
                    <div class="actions" style="align-items: center;">
                        <span style="font-size:1.3rem; font-weight:700; color:${pct < target && sub.total > 0 ? 'var(--danger)' : 'var(--success)'}; margin-right:10px;">${pct}%</span>
                        <button class="icon-btn" onclick="openSubModalGlobal(true, ${sub.id})"><i class='bx bx-pencil'></i></button>
                        <button class="icon-btn delete-btn" onclick="deleteSubject(${sub.id})"><i class='bx bx-trash'></i></button>
                    </div>
                </div>
                <div class="bunk-calc ${bunkInfo.cls}"><i class='bx bx-analyse'></i> ${bunkInfo.txt}</div>
            </div>`;
    });

    const gPct = gTotal === 0 ? 0 : Math.round((gPres / gTotal) * 100);
    if (document.getElementById('overallPct')) {
        document.getElementById('overallPct').textContent = `${gPct}%`;
        document.getElementById('overallPct').style.color = (gPct < target && gTotal > 0) ? 'var(--danger)' : 'var(--text)';
    }
    if (document.getElementById('overallBar')) {
        document.getElementById('overallBar').style.width = `${gPct}%`;
        document.getElementById('overallBar').style.background = (gPct < target && gTotal > 0) ? 'var(--danger)' : 'linear-gradient(90deg, #00d2ff, #3a86ff)';
    }
    if (document.getElementById('todayCount')) document.getElementById('todayCount').textContent = subjects.length;

    renderTodaySchedule();
};

// ==========================================
// 5. CORE ENGINE (Marking, Deleting, Undo)
// ==========================================
window.markAttendance = (id, isPresent) => {
    const sub = subjects.find(s => s.id === id);
    if (sub) {
        sub.total++; if (isPresent) sub.present++;
        const now = new Date();
        historyLog.unshift({
            logId: Date.now(), subId: sub.id, subName: sub.name, status: isPresent ? 'Present' : 'Absent',
            date: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        });
        if (historyLog.length > 50) historyLog.pop();
        saveToLocal();
        showToast(`Marked ${isPresent ? 'Present' : 'Absent'} for ${sub.name}`, isPresent ? 'success' : 'error');
    }
};

window.deleteSubject = (id) => {
    if (confirm("Delete subject? This removes it from stats, timetables, and history.")) {
        subjects = subjects.filter(s => s.id !== id);
        for (let day in timetable) timetable[day] = timetable[day].filter(slot => slot.subId !== id);
        historyLog = historyLog.filter(log => log.subId !== id);
        saveToLocal(); showToast("Subject deleted", "error");
    }
};

window.deleteHistoryLog = (logId) => {
    const logIndex = historyLog.findIndex(l => l.logId === logId);
    if (logIndex !== -1) {
        const log = historyLog[logIndex];
        const sub = subjects.find(s => s.id === log.subId);
        
        // ONLY affect stats if it was Present or Absent (Canceled doesn't affect stats)
        if (sub && log.status !== 'Canceled') {
            sub.total = Math.max(0, sub.total - 1);
            if (log.status === 'Present') sub.present = Math.max(0, sub.present - 1);
        }
        
        historyLog.splice(logIndex, 1);
        saveToLocal(); 
        showToast("Action undone successfully!");
    }
};

window.clearAllHistory = () => {
    if (confirm("Clear all history? Your subject stats will remain untouched.")) {
        historyLog = []; saveToLocal(); showToast("History cleared", "error");
    }
};

// ==========================================
// 6. TIMETABLE, SCHEDULE & EXCEPTIONS
// ==========================================
window.removeSlot = (slotId) => {
    timetable[currentTimetableDay] = timetable[currentTimetableDay].filter(s => s.slotId !== slotId);
    saveToLocal();
    showToast("Class removed from timetable", "error");
};

window.cancelTodayClass = (slotId, subId, isExtra = false) => {
    const todayStr = new Date().toDateString();
    if (!overrides[todayStr]) overrides[todayStr] = { canceled: [], extra: [] };

    const sub = subjects.find(s => s.id === subId);

    if (isExtra) {
        overrides[todayStr].extra = overrides[todayStr].extra.filter(s => s.slotId !== slotId);
        showToast("Extra class removed.");
    } else {
        if (!overrides[todayStr].canceled.includes(slotId)) {
            overrides[todayStr].canceled.push(slotId);
            
            // --- NEW: LOG TO HISTORY ---
            if (sub) {
                const now = new Date();
                historyLog.unshift({
                    logId: Date.now(), subId: sub.id, subName: sub.name, status: 'Canceled',
                    date: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
                    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                });
                if (historyLog.length > 50) historyLog.pop();
            }
            showToast("Class canceled for today!");
        }
    }
    saveToLocal();
};

window.openExtraClassModal = () => {
    if (subjects.length === 0) return alert("Please add a subject first.");
    const select = document.getElementById('extraSubjectSelect');
    if (select) select.innerHTML = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (document.getElementById('extraTimeInput')) document.getElementById('extraTimeInput').value = "";
    if (document.getElementById('extraClassModal')) document.getElementById('extraClassModal').style.display = 'flex';
};

window.saveExtraClass = () => {
    const subId = document.getElementById('extraSubjectSelect').value;
    const time = document.getElementById('extraTimeInput').value;
    if (!time) return alert("Please specify a time.");
    const todayStr = new Date().toDateString();
    if (!overrides[todayStr]) overrides[todayStr] = { canceled: [], extra: [] };
    overrides[todayStr].extra.push({ slotId: 'extra_' + Date.now(), subId: parseInt(subId), time: time, isExtra: true });
    saveToLocal();
    if (document.getElementById('extraClassModal')) document.getElementById('extraClassModal').style.display = 'none';
    showToast("Extra class added for today!");
};

const renderTimetable = () => {
    const list = document.getElementById('timetableList');
    if (!list) return;
    const daySlots = timetable[currentTimetableDay] || [];
    daySlots.sort((a, b) => a.time.localeCompare(b.time));

    if (daySlots.length === 0) {
        list.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:30px;">No classes scheduled for ${currentTimetableDay}.</p>`;
        return;
    }

    list.innerHTML = daySlots.map(slot => {
        let subName = slot.subId === 'free' ? "☕ Free Period / Break" : (subjects.find(s => s.id == slot.subId)?.name || "Deleted Subject");
        return `
            <div class="glass-card subject-row" ${slot.subId === 'free' ? 'style="border: 1px dashed var(--glass-border); opacity: 0.8;"' : ''}>
                <div class="row-info"><span class="time-tag">${slot.time}</span><div class="subject-details"><h4>${subName}</h4></div></div>
                <div class="actions"><button class="icon-btn delete-btn" onclick="removeSlot('${slot.slotId}')"><i class='bx bx-trash'></i></button></div>
            </div>`;
    }).join('');
};

const renderTodaySchedule = () => {
    const scheduleCont = document.getElementById('scheduleContainer');
    if (!scheduleCont) return;

    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const actualToday = daysOfWeek[new Date().getDay()];
    const todayStr = new Date().toDateString();
    const todayOverrides = overrides[todayStr] || { canceled: [], extra: [] };
    const target = userProfile.targetPct || 75;

    let allTodaySlots = [...(timetable[actualToday] || []), ...todayOverrides.extra];
    allTodaySlots.sort((a, b) => a.time.localeCompare(b.time));

    if (allTodaySlots.length === 0) {
        scheduleCont.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);"><p>No classes scheduled for <b>${actualToday}</b>.</p></div>`;
        return;
    }

    if (document.querySelector('.tab-btn[data-tab="today"]')) document.querySelector('.tab-btn[data-tab="today"]').innerHTML = `<i class='bx bx-calendar-check'></i> ${actualToday}'s Classes`;

    scheduleCont.innerHTML = allTodaySlots.map(slot => {
        if (slot.subId === 'free') return `<div class="glass-card subject-row" style="opacity: 0.7; border: 1px dashed var(--glass-border);"><div class="row-info"><span class="time-tag" style="background: transparent;">${slot.time}</span><div class="subject-details"><h4 style="color: var(--text-muted);">☕ Free Period</h4></div></div></div>`;

        const sub = subjects.find(s => s.id === slot.subId);
        if (!sub) return '';

        if (todayOverrides.canceled.includes(slot.slotId)) {
            return `<div class="glass-card subject-row" style="opacity: 0.5; border-color: var(--danger);"><div class="row-info"><span class="time-tag" style="background: rgba(255,118,117,0.1); color: var(--danger); text-decoration: line-through;">${slot.time}</span><div class="subject-details"><h4 style="text-decoration: line-through;">${sub.name}</h4><div class="status-badge danger">Canceled Today</div></div></div></div>`;
        }

        const pct = sub.total === 0 ? 0 : Math.round((sub.present / sub.total) * 100);
        const extraTag = slot.isExtra ? `<span style="font-size:0.7rem; background: var(--accent); color:#0f172a; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">Extra Class</span>` : '';

        // REPLACED ICONS WITH TEXT BUTTONS HERE:
        return `
            <div class="glass-card subject-row" ${slot.isExtra ? 'style="border: 1px solid var(--accent);"' : ''}>
                <div class="row-info"><span class="time-tag">${slot.time}</span>
                    <div class="subject-details"><h4>${sub.name} ${extraTag}</h4><div class="status-badge ${pct < target && sub.total > 0 ? 'danger' : 'safe'}"><i class='bx bx-check-circle'></i> ${pct}%</div></div>
                </div>
                <div class="actions" style="gap: 8px;">
                    <button class="glass-btn present text-btn" onclick="markAttendance(${sub.id}, true)">Present</button>
                    <button class="glass-btn absent text-btn" onclick="markAttendance(${sub.id}, false)">Absent</button>
                    <button class="glass-btn delete-btn text-btn" style="border-color: var(--danger); color: var(--danger);" onclick="cancelTodayClass('${slot.slotId}', ${sub.id}, ${slot.isExtra || false})">Canceled</button>
                </div>
            </div>`;
    }).join('');
};

const dayBtns = document.querySelectorAll('.day-btn');
if (dayBtns.length > 0) {
    dayBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            dayBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentTimetableDay = e.target.getAttribute('data-day');
            if (document.getElementById('currentDayText')) document.getElementById('currentDayText').textContent = currentTimetableDay;
            renderTimetable();
        });
    });
}

if (document.getElementById('addTimetableSlotBtn') && document.getElementById('slotModalBackdrop')) {
    document.getElementById('addTimetableSlotBtn').onclick = () => {
        if (subjects.length === 0) return alert("Please create a Subject in the Dashboard first!");
        const slotSelect = document.getElementById('slotSubjectSelect');
        if (slotSelect) {
            let optionsHTML = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            optionsHTML += `<option value="free">☕ Free Period / Break</option>`;
            slotSelect.innerHTML = optionsHTML;
        }
        if (document.getElementById('slotTimeInput')) document.getElementById('slotTimeInput').value = "";
        document.getElementById('slotModalBackdrop').style.display = 'flex';
    };
    if (document.getElementById('closeSlotModal')) document.getElementById('closeSlotModal').onclick = () => document.getElementById('slotModalBackdrop').style.display = 'none';
    if (document.getElementById('saveSlotBtn')) {
        document.getElementById('saveSlotBtn').onclick = () => {
            const subId = document.getElementById('slotSubjectSelect').value;
            const time = document.getElementById('slotTimeInput').value;
            if (!time) return alert("Please specify a time.");
            timetable[currentTimetableDay].push({ slotId: 'slot_' + Date.now(), subId: subId === 'free' ? 'free' : parseInt(subId), time: time });
            saveToLocal();
            document.getElementById('slotModalBackdrop').style.display = 'none';
            showToast(subId === 'free' ? "Free period added!" : "Class added to timetable!");
        };
    }
}

// ==========================================
// 7. HISTORY & NOTIFICATIONS PAGE LOGIC
// ==========================================
const renderHistory = () => {
    const container = document.getElementById('historyContainer');
    if (!container) return;
    if (historyLog.length === 0) { container.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:30px;">No activity logged yet.</p>`; return; }

    container.innerHTML = historyLog.map(log => {
        // Determine styling based on status
        let badgeClass = 'safe';
        let borderColor = 'var(--success)';
        let textStyle = '';

        if (log.status === 'Absent') {
            badgeClass = 'danger';
            borderColor = 'var(--danger)';
        } else if (log.status === 'Canceled') {
            badgeClass = ''; // Custom inline style for canceled
            borderColor = 'var(--text-muted)';
            textStyle = 'text-decoration: line-through; opacity: 0.7;';
        }

        return `
            <div class="glass-card history-card" style="padding: 15px; border-left: 4px solid ${borderColor}; display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <div class="history-info">
                    <h4 style="margin: 0 0 5px 0; font-size: 1.1rem; ${textStyle}">${log.subName}</h4>
                    <p class="history-date" style="margin: 0; font-size: 0.85rem; color: var(--text-muted);"><i class='bx bx-time-five'></i> ${log.date} at ${log.time}</p>
                </div>
                <div class="history-actions" style="display:flex; align-items:center; gap: 15px;">
                    <div class="status-badge ${badgeClass}" style="${log.status === 'Canceled' ? 'background: rgba(255,255,255,0.1); color: var(--text-muted);' : ''}">${log.status}</div>
                    <button class="icon-btn delete-btn" onclick="deleteHistoryLog(${log.logId})" title="Undo/Delete Log"><i class='bx bx-undo'></i></button>
                </div>
            </div>`;
    }).join('');
};

const renderNotificationsGlobal = () => {
    let alertsCount = 0;
    const target = userProfile.targetPct || 75;
    subjects.forEach(sub => {
        const pct = sub.total === 0 ? 0 : Math.round((sub.present / sub.total) * 100);
        if (pct < target && sub.total > 0) alertsCount++;
    });

    document.querySelectorAll('.badge').forEach(b => {
        b.textContent = alertsCount;
        b.style.display = alertsCount > 0 ? 'inline-block' : 'none';
    });
};

const renderNotifications = () => {
    const list = document.getElementById('notificationsList');
    if (!list) return;

    let alertsHTML = '';
    let alertsCount = 0;
    const target = userProfile.targetPct || 75;
    const targetDecimal = target / 100;

    subjects.forEach(sub => {
        const pct = sub.total === 0 ? 0 : Math.round((sub.present / sub.total) * 100);
        if (pct < target && sub.total > 0) {
            alertsCount++;
            const mustAttend = Math.ceil((targetDecimal * sub.total - sub.present) / (1 - targetDecimal));
            alertsHTML += `
                <div class="glass-card subject-row" style="border-left: 4px solid var(--danger); margin-bottom: 15px; display:flex; align-items:center; gap:15px;">
                    <i class='bx bx-error-circle' style="font-size: 2.5rem; color: var(--danger);"></i>
                    <div class="subject-details">
                        <h4 style="color: var(--danger); margin: 0 0 5px 0;">Warning: ${sub.name}</h4>
                        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">Attendance is critically low (${pct}%). You must attend the next <b>${mustAttend}</b> classes to reach your goal of ${target}%.</p>
                    </div>
                </div>`;
        }
    });

    if (alertsCount === 0) {
        list.innerHTML = `<div class="glass-card" style="text-align:center; padding: 40px;"><i class='bx bx-check-shield' style="font-size: 4rem; color: var(--success); margin-bottom:10px;"></i><h3 style="margin:0;">You're in the safe zone!</h3><p style="color:var(--text-muted); margin-top:5px;">No low attendance warnings right now.</p></div>`;
    } else {
        list.innerHTML = alertsHTML;
    }
};

// ==========================================
// 8. ACCOUNT & SETTINGS PAGE LOGIC
// ==========================================
const renderAccount = () => {
    const nameInput = document.getElementById('profileInputName');
    const emailInput = document.getElementById('profileInputEmail');
    const regInput = document.getElementById('profileInputRegNo');
    const rollInput = document.getElementById('profileInputRoll');

    if (!nameInput) return; 

    const user = firebase.auth().currentUser;

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('newuser') === 'true') {
        showToast("Welcome! Please complete your profile to get started.", "info");
        const headerTitle = document.querySelector('.header h1');
        if(headerTitle) headerTitle.innerHTML = "Complete Your <span>Profile</span>";
    }
    
    // Auto-render Data
    nameInput.value = userProfile.name || "";
    if (emailInput) {
        emailInput.value = userProfile.email || (user ? user.email : "");
        emailInput.setAttribute('readonly', true);
        emailInput.style.opacity = "0.7";
        emailInput.style.cursor = "not-allowed";
    }

    // Reg No and Roll Auto-Sync logic
    if(regInput) {
        regInput.value = (userProfile.regNo || "").toUpperCase();
        
        // Auto-extract Roll No if it exists in Reg No but isn't saved yet
        if (!userProfile.roll && regInput.value.length >= 5) {
            userProfile.roll = regInput.value.slice(-5);
        }

        // Live typing logic: Forces uppercase and auto-fills Roll Number
       regInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
            if (rollInput) {
                // Auto-fill the Roll Input
                rollInput.value = e.target.value.length >= 5 ? e.target.value.slice(-5) : e.target.value;
                // FORCE the ID Card and Sidebar to catch this programmatic change!
                updateIDCardRealtime(); 
            }
        });
    }

    if(rollInput) rollInput.value = userProfile.roll || "";
    
    document.getElementById('profileInputSec').value = userProfile.sec || "";
    if(document.getElementById('profileInputCourse')) document.getElementById('profileInputCourse').value = userProfile.course || "";
    if(document.getElementById('profileInputSem')) document.getElementById('profileInputSem').value = userProfile.sem || "1";
    
    document.getElementById('mainAvatarDisplay').src = userProfile.avatar || "https://placehold.co/120x120/00d2ff/ffffff?text=U";
    updateIDCardRealtime();
};

window.updateIDCardRealtime = () => {
    if(!document.getElementById('idCardName')) return;
    
    const n = document.getElementById('profileInputName').value || "Student Name";
    const c = document.getElementById('profileInputCourse').value || "Course";
    const s = document.getElementById('profileInputSem').value || "1";
    const r = document.getElementById('profileInputRoll').value || "--";
    const sec = document.getElementById('profileInputSec').value || "--";
    const regEl = document.getElementById('profileInputRegNo');
    const reg = regEl ? regEl.value || "--" : "--";

    document.getElementById('idCardName').textContent = n;
    document.getElementById('idCardCourse').textContent = `${c} - Semester ${s}`;
    document.getElementById('idCardRoll').textContent = r;
    document.getElementById('idCardSec').textContent = sec;
    const idRegEl = document.getElementById('idCardRegNo');
    if(idRegEl) idRegEl.textContent = `Reg No: ${reg}`;

    userProfile.name = n !== "Student Name" ? n : "";
    userProfile.roll = r !== "--" ? r : "";
    userProfile.sec = sec !== "--" ? sec : "";
    updateSidebarProfile();
};

// Avatar Upload Logic
const avatarInput = document.getElementById('avatarUpload');
if (avatarInput) {
    avatarInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = e => { 
                userProfile.avatar = e.target.result; 
                saveToLocal();
                document.getElementById('mainAvatarDisplay').src = userProfile.avatar;
                if(document.getElementById('sidebarAvatar')) document.getElementById('sidebarAvatar').src = userProfile.avatar;
                showToast("ID Photo Updated!");
            };
            reader.readAsDataURL(this.files[0]);
        }
    });
}

// Save Profile Logic
window.saveProfile = async () => {
    const saveBtn = document.querySelector('button[onclick="saveProfile()"]');
    const originalText = saveBtn ? saveBtn.innerHTML : "Save Profile Changes";
    if(saveBtn) saveBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Saving to Cloud...";

    userProfile.name = document.getElementById('profileInputName').value.trim();
    
    const regInput = document.getElementById('profileInputRegNo');
    if(regInput) userProfile.regNo = regInput.value.trim().toUpperCase();

    const rollInput = document.getElementById('profileInputRoll');
    if(rollInput) {
        userProfile.roll = rollInput.value.trim();
    } else if (userProfile.regNo && userProfile.regNo.length >= 5) {
        userProfile.roll = userProfile.regNo.slice(-5);
    }

    userProfile.sec = document.getElementById('profileInputSec').value.trim();
    
    const emailInput = document.getElementById('profileInputEmail');
    if(emailInput) userProfile.email = emailInput.value;
    
    if(document.getElementById('profileInputCourse')) 
        userProfile.course = document.getElementById('profileInputCourse').value.trim();
    
    if(document.getElementById('profileInputSem')) 
        userProfile.sem = document.getElementById('profileInputSem').value;
    
    await saveToLocal(); 
    updateSidebarProfile();
    showToast("Profile Updated Successfully!");

    if(saveBtn) saveBtn.innerHTML = "<i class='bx bx-check'></i> Saved!";
    setTimeout(() => {
        if(saveBtn) saveBtn.innerHTML = originalText;
    }, 2000);

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('newuser') === 'true') {
        setTimeout(() => {
            window.location.href = "attendance.html";
        }, 1500);
    }
};

// Settings Page 
// Target Attendance Slider Logic
const targetSlider = document.getElementById('targetSlider');
if (targetSlider) {
    targetSlider.value = userProfile.targetPct || 75;
    document.getElementById('targetDisplay').textContent = `${targetSlider.value}%`;

    targetSlider.addEventListener('input', (e) => {
        document.getElementById('targetDisplay').textContent = `${e.target.value}%`;
    });

    targetSlider.addEventListener('change', (e) => {
        userProfile.targetPct = parseInt(e.target.value);
        saveToLocal();
        showToast(`Goal updated to ${userProfile.targetPct}%`);
    });
}

// Data Management: CSV Export 
window.exportToCSV = () => {
    if (historyLog.length === 0) return showToast("No history to export!", "error");
    let csvContent = "data:text/csv;charset=utf-8,Date,Time,Subject,Status\n";
    historyLog.forEach(log => { 
        csvContent += `"${log.date}","${log.time}","${log.subName}","${log.status}"\n`; 
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const identifier = userProfile.regNo || userProfile.roll || "Report";
    link.setAttribute("download", `Attendance_${identifier}.csv`);
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
    showToast("Download Started!");
};

window.startNewSemester = () => {
    if(confirm("Start a new semester? This sets all attendance to 0 but keeps your Subjects and Timetable.")) {
        subjects.forEach(sub => { sub.present = 0; sub.total = 0; });
        historyLog = [];
        if(userProfile.sem) {
            let nextSem = parseInt(userProfile.sem) + 1;
            if(nextSem <= 8) userProfile.sem = nextSem.toString();
        }
        saveToLocal();
        showToast("New Semester Started! Good luck!");
    }
};

// Account Deletion
window.hardResetApp = () => {
    if(confirm("DANGER: Are you absolutely sure? This deletes ALL subjects and data!")) {
        const user = firebase.auth().currentUser;
        if(user) {
            db.collection("users").doc(user.uid).delete().then(() => {
                localStorage.clear();
                window.location.href = "login.html";
            }).catch(e => {
                console.error(e);
                alert("Failed to delete cloud data.");
            });
        } else {
            localStorage.clear();
            window.location.href = "login.html";
        }
    }
};

// ==========================================
// 9. INITIAL BOOT SEQUENCE
// ==========================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log("Service Worker Registered"));
}

document.addEventListener('DOMContentLoaded', () => {
    let localProfile = localStorage.getItem('edu_profile');
    if (localProfile) userProfile = JSON.parse(localProfile);

    refreshAllUI();
});