import { seedDefaultTemplates } from '../seed/templates.js';
import { createRelease } from '../domain/release.js';
import { updateTaskStatus } from '../domain/task.js';
import { instantiateTemplate } from '../domain/template.js';
import { add, getAll, get, update, queryByIndex } from '../storage/db.js';

// Helpers
function nowISO() {
    return new Date().toISOString();
}

function currentYear() {
    return new Date().getFullYear();
}

// DOM Elements
const form = document.getElementById('create-release-form');
const loading = document.getElementById('loading');
const statusMessage = document.getElementById('status-message');
const yearInput = document.getElementById('year');
const releasesContainer = document.getElementById('releases-container');
const releasesList = document.getElementById('releases-list');
const taskView = document.getElementById('task-view');
const taskList = document.getElementById('task-list');
const taskViewTitle = document.getElementById('task-view-title');
const backToReleasesBtn = document.getElementById('back-to-releases');

// State for editing reminders (taskId -> boolean)
const editState = {};

// Initialize App
async function init() {
    try {
        yearInput.value = currentYear();

        await seedDefaultTemplates();

        // Check notifications only on app load
        await checkAndFireNotifications();

        await loadReleases();

        loading.style.display = 'none';
        form.style.display = 'block';
        releasesContainer.style.display = 'block';
    } catch (error) {
        showStatus('Failed to initialize app. Please refresh.', 'error');
        loading.style.display = 'none';
    }
}

// Load Releases
async function loadReleases() {
    const releases = await getAll('releases');
    releases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    releasesList.innerHTML = '';

    if (releases.length === 0) {
        releasesList.innerHTML = '<p>No releases found.</p>';
        return;
    }

    releases.forEach(release => {
        const div = document.createElement('div');
        div.className = 'release-item';
        div.textContent = `${release.name} (ID: ${release.id})`;
        div.onclick = () => showTaskView(release);
        releasesList.appendChild(div);
    });
}

// Show Task View
async function showTaskView(release) {
    // Clear edit state when switching views/releases
    for (const key in editState) delete editState[key];

    form.style.display = 'none';
    releasesContainer.style.display = 'none';
    statusMessage.style.display = 'none';

    taskView.style.display = 'block';
    taskViewTitle.textContent = release.name;
    taskList.innerHTML = 'Loading tasks...';

    await loadTasks(release.id);
}

// Load Tasks
async function loadTasks(releaseId) {
    const tasks = await queryByIndex('tasks', 'releaseId', releaseId);
    tasks.sort((a, b) => a.sequence - b.sequence);

    renderTasks(tasks);
}

// Render Tasks
function renderTasks(tasks) {
    taskList.innerHTML = '';

    let nextActiveFound = false;

    tasks.forEach(task => {
        const div = document.createElement('div');
        const isDone = task.status === 'DONE';
        const isNA = task.status === 'NOT_APPLICABLE';
        const isCompleted = isDone || isNA;

        let activeClass = '';
        if (!isCompleted && !nextActiveFound) {
            activeClass = 'active';
            nextActiveFound = true;
        }

        div.className = `task-item ${isCompleted ? 'completed' : ''} ${activeClass}`;

        // Branch Info
        let branchInfo = '';
        if (task.branchFrom && task.branchTo) {
            const to = Array.isArray(task.branchTo) ? task.branchTo.join(', ') : task.branchTo;
            branchInfo = `<div>Branch: <code>${task.branchFrom}</code> → <code>${to}</code></div>`;
        }

        // Proposed Date (Pre-fill)
        let dateStr = '';
        let timeStr = ''; // HH:mm
        if (task.proposedDateTime) {
            const dt = new Date(task.proposedDateTime);
            dateStr = dt.toISOString().split('T')[0]; // yyyy-mm-dd
            timeStr = dt.toTimeString().substring(0, 5);
        } else {
            // Default to tomorrow 09:00 for new setting
            const tmrw = new Date();
            tmrw.setDate(tmrw.getDate() + 1);
            dateStr = tmrw.toISOString().split('T')[0];
            timeStr = '09:00';
        }

        // Reminder Block
        const hasReminder = !!task.proposedDateTime;
        const isEditing = editState[task.id];
        let reminderBlock = '';

        // Add release-id to buttons to avoid unnecessary fetches
        const commonData = `data-task-id="${task.id}" data-release-id="${task.releaseId}"`;

        if (!isCompleted) {
            if (hasReminder && !isEditing) {
                // View Mode
                reminderBlock = `
              <div class="reminder-info">
                 <span class="notification-badge">🔔</span>
                 <span>Reminder set for ${dateStr}, ${timeStr}</span>
                 <button class="link" ${commonData} data-action="EDIT_REMINDER">Edit</button>
                 <button class="link" ${commonData} data-action="CLEAR_REMINDER">Clear</button>
              </div>
            `;
            } else {
                // Edit or Set Mode
                reminderBlock = `
              <div class="schedule-group">
                 <input type="date" class="schedule-date" value="${dateStr}" max="2100-12-31">
                 <input type="time" class="schedule-time" value="${timeStr}">
                 <button class="small secondary" ${commonData} data-action="SCHEDULE">
                    ${hasReminder ? 'Update Reminder' : 'Set Reminder'}
                 </button>
                 ${isEditing ? `<button class="link" ${commonData} data-action="CANCEL_EDIT">Cancel</button>` : ''}
              </div>
            `;
            }
        }

        div.innerHTML = `
      <div class="task-meta">
        <span>Step ${task.sequence} &middot; Status: ${task.status}</span>
      </div>
      <h3>${task.title}</h3>
      ${task.description ? `<p>${task.description}</p>` : ''}
      ${branchInfo}
      
      <div class="task-actions">
        ${!isDone ? `<button class="small" ${commonData} data-action="DONE">Mark Done</button>` : ''}
        ${!isNA ? `<button class="small secondary" ${commonData} data-action="NOT_APPLICABLE">Mark N/A</button>` : ''}
        ${isCompleted ? `<button class="small secondary" ${commonData} data-action="PLANNED">Reset</button>` : ''}

        ${reminderBlock}
      </div>
    `;

        taskList.appendChild(div);
    });
}

// --- Reminder & Notification Helpers ---

// Helper to suppress duplication logic
async function suppressActiveNotifications(taskId) {
    const notifications = await queryByIndex('notifications', 'taskId', taskId);
    const updates = [];
    for (const n of notifications) {
        if (!n.firedAt && !n.suppressed) {
            n.suppressed = true;
            updates.push(update('notifications', n));
        }
    }
    await Promise.all(updates);
}

async function clearTaskReminder(taskId, releaseId) {
    const task = await get('tasks', taskId);
    if (!task) return;

    // 1. Suppress all active notifications
    await suppressActiveNotifications(taskId);

    // 2. Remove proposedDateTime
    const updatedTask = { ...task, proposedDateTime: null };
    await update('tasks', updatedTask);

    await loadTasks(releaseId || task.releaseId);
    showStatus("Reminder cleared", "success");
}

async function rescheduleTaskReminder(taskId, dateVal, timeVal, releaseId) {
    if (!('Notification' in window)) {
        showStatus("Notifications not supported in this browser", "error");
        return;
    }

    if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            // Friendly warning for non-technical users
            showStatus("Reminder saved, but you won't get a popup to alert you.", "warning");
        }
    }

    const time = timeVal || '09:00';
    const isoString = new Date(`${dateVal}T${time}`).toISOString();

    const task = await get('tasks', taskId);
    if (!task) return;

    // 1. Suppress existing active notifications
    await suppressActiveNotifications(taskId);

    // 2. Update task
    const updatedTask = { ...task, proposedDateTime: isoString };
    await update('tasks', updatedTask);

    // 3. Create NEW Notification Record
    const notification = {
        id: `${taskId}-${isoString}`,
        taskId: taskId,
        releaseId: task.releaseId,
        scheduledFor: isoString,
        firedAt: null,
        suppressed: false
    };

    await add('notifications', notification);

    // Clear edit state
    delete editState[taskId];

    showStatus("Reminder set!", "success");
    await loadTasks(releaseId || task.releaseId);
}

// Notifications Check (App Load Only)
async function checkAndFireNotifications() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== "granted") return;

    const allNotifications = await getAll('notifications');
    const now = new Date();

    for (const n of allNotifications) {
        if (n.firedAt || n.suppressed) continue;

        const scheduleDate = new Date(n.scheduledFor);
        if (scheduleDate <= now) {
            const task = await get('tasks', n.taskId);

            // Validate task status
            if (!task || task.status !== 'PLANNED') {
                n.suppressed = true;
                await update('notifications', n);
                continue;
            }

            // Fire
            new Notification("Release Task Reminder", {
                body: `${task.title}`
            });

            n.firedAt = nowISO();
            await update('notifications', n);
        }
    }
}

// Global Click Delegation
taskList.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const taskId = button.dataset.taskId;
    const action = button.dataset.action;
    // Use releaseId from DOM to optimize reloads
    const releaseId = button.dataset.releaseId;

    if (!taskId || !action) return;

    // --- Reminder Actions ---
    if (action === 'SCHEDULE') {
        const container = button.closest('.schedule-group');
        const dateInput = container.querySelector('.schedule-date');
        const timeInput = container.querySelector('.schedule-time');

        if (!dateInput.value) {
            showStatus("Please pick a date for the reminder", "error");
            return;
        }

        await rescheduleTaskReminder(taskId, dateInput.value, timeInput.value, releaseId);
        return;
    }

    if (action === 'EDIT_REMINDER') {
        editState[taskId] = true;
        if (releaseId) await loadTasks(releaseId);
        return;
    }

    if (action === 'CANCEL_EDIT') {
        delete editState[taskId];
        if (releaseId) await loadTasks(releaseId);
        return;
    }

    if (action === 'CLEAR_REMINDER') {
        if (confirm('Are you sure you want to clear this reminder?')) {
            await clearTaskReminder(taskId, releaseId);
        }
        return;
    }

    // --- Task Status Actions ---
    try {
        const task = await get('tasks', taskId);
        if (!task) throw new Error('Task not found');

        const timestamp = (action === 'DONE' || action === 'NOT_APPLICABLE') ? nowISO() : undefined;
        const updatedTask = updateTaskStatus(task, action, timestamp);

        await update('tasks', updatedTask);

        // Auto-clear reminders if completing
        if (action === 'DONE' || action === 'NOT_APPLICABLE') {
            await suppressActiveNotifications(taskId);
        }

        // Effective release ID logic to avoid repetition
        const effectiveReleaseId = releaseId || task.releaseId;
        await loadTasks(effectiveReleaseId);
    } catch (error) {
        showStatus(`Failed to update task: ${error.message}`, 'error');
    }
});

// Back to Releases
backToReleasesBtn.addEventListener('click', () => {
    taskView.style.display = 'none';
    form.style.display = 'block';
    releasesContainer.style.display = 'block';
    loadReleases();
});

// Handle release creation
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusMessage.style.display = 'none';

    const formData = new FormData(form);
    const type = formData.get('releaseType');
    const quarter = formData.get('quarter');
    const year = formData.get('year');

    try {
        const name = `${quarter} ${type} ${year}`;
        const id = `${quarter.toLowerCase()}-${type.toLowerCase()}-${year}`;

        const existing = await get('releases', id);
        if (existing) throw new Error('Release already exists');

        const release = createRelease(id, name, nowISO());
        await add('releases', release);

        const templates = await getAll('templates');
        const template = templates.find(t => t.releaseType === type);
        if (!template) throw new Error(`No default template for type: ${type}`);

        const tasks = instantiateTemplate(template, release);
        const tasksToSave = tasks.map(task => ({
            ...task,
            id: `${release.id}-task-${task.sequence}`
        }));

        for (const task of tasksToSave) {
            await add('tasks', task);
        }

        showStatus(`Successfully created release: ${name}`, 'success');
        form.reset();
        yearInput.value = currentYear();
        await loadReleases();
    } catch (error) {
        if (error.name === 'ConstraintError') {
            showStatus('Error: A release with this ID already exists.', 'error');
        } else {
            showStatus(`Error: ${error.message}`, 'error');
        }
    }
});

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = type === 'warning' ? 'warning-status' : type;
    statusMessage.style.display = 'block';
}

// Start
init();
