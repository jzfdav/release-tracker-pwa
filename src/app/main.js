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

// Initialize App
async function init() {
    try {
        // Set default year
        yearInput.value = currentYear();

        // Seed data
        await seedDefaultTemplates();

        // Check notifications on load (ONLY here)
        await checkAndFireNotifications();

        // Load Releases
        await loadReleases();

        // Ready
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
    // Sort by createdAt descending
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
    // Hide List / Form
    form.style.display = 'none';
    releasesContainer.style.display = 'none';
    statusMessage.style.display = 'none';

    // Show Task View
    taskView.style.display = 'block';
    taskViewTitle.textContent = release.name;
    taskList.innerHTML = 'Loading tasks...';

    // Load tasks
    await loadTasks(release.id);
}

// Load Tasks
async function loadTasks(releaseId) {
    const tasks = await queryByIndex('tasks', 'releaseId', releaseId);
    // Sort by sequence
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

        // Task Meta
        let branchInfo = '';
        if (task.branchFrom && task.branchTo) {
            const to = Array.isArray(task.branchTo) ? task.branchTo.join(', ') : task.branchTo;
            branchInfo = `<div>Branch: <code>${task.branchFrom}</code> → <code>${to}</code></div>`;
        }

        // Proposed Date inputs (Pre-fill)
        const dt = task.proposedDateTime ? new Date(task.proposedDateTime) : null;
        let dateStr = '';
        let timeStr = '';
        if (dt) {
            // iso format yyyy-mm-dd
            dateStr = dt.toISOString().split('T')[0];
            // HH:mm for time input
            timeStr = dt.toTimeString().substring(0, 5);
        }

        const hasNotification = !!task.proposedDateTime;

        div.innerHTML = `
      <div class="task-meta">
        <span>Step ${task.sequence} &middot; Status: ${task.status}</span>
        ${hasNotification ? '<span class="notification-badge">🔔</span>' : ''}
      </div>
      <h3>${task.title}</h3>
      ${task.description ? `<p>${task.description}</p>` : ''}
      ${branchInfo}
      
      <div class="task-actions">
        ${!isDone ? `<button class="small" data-task-id="${task.id}" data-action="DONE">Mark Done</button>` : ''}
        ${!isNA ? `<button class="small secondary" data-task-id="${task.id}" data-action="NOT_APPLICABLE">Mark N/A</button>` : ''}
        ${isCompleted ? `<button class="small secondary" data-task-id="${task.id}" data-action="PLANNED">Reset</button>` : ''}

        ${!isCompleted ? `
          <div class="schedule-group">
             <input type="date" class="schedule-date" data-task-id="${task.id}" value="${dateStr}" max="2100-12-31">
             <input type="time" class="schedule-time" data-task-id="${task.id}" value="${timeStr}">
             <button class="small secondary" data-task-id="${task.id}" data-action="SCHEDULE">Set Reminder</button>
          </div>
        ` : ''}
      </div>
    `;

        taskList.appendChild(div);
    });
}

// Notifications Logic
async function scheduleNotification(taskId, dateVal, timeVal) {
    if (!('Notification' in window)) {
        showStatus("Notifications not supported in this browser", "error");
        return;
    }

    if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            showStatus("Notification permission denied. Reminder set but won't pop up.", "warning");
        }
    }

    // Default time 09:00 if missing
    const time = timeVal || '09:00';
    const isoString = new Date(`${dateVal}T${time}`).toISOString();

    const task = await get('tasks', taskId);
    if (!task) return;

    // 1. SUPPRESS EXISTING ACTIVE NOTIFICATIONS FOR THIS TASK
    const taskNotifications = await queryByIndex('notifications', 'taskId', taskId);
    for (const n of taskNotifications) {
        if (!n.firedAt && !n.suppressed) {
            n.suppressed = true;
            await update('notifications', n);
        }
    }

    // 2. Clone and Update task (No direct mutation)
    const updatedTask = { ...task, proposedDateTime: isoString };
    await update('tasks', updatedTask);

    // 3. Create Notification Record
    const notification = {
        id: `${taskId}-${isoString}`,
        taskId: taskId,
        releaseId: task.releaseId,
        scheduledFor: isoString,
        firedAt: null,
        suppressed: false
    };

    await add('notifications', notification);

    showStatus("Reminder scheduled!", "success");
    await loadTasks(task.releaseId);
}

async function checkAndFireNotifications() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== "granted") return;

    const allNotifications = await getAll('notifications');

    const now = new Date();

    for (const n of allNotifications) {
        if (n.firedAt || n.suppressed) continue;

        const scheduleDate = new Date(n.scheduledFor);
        if (scheduleDate <= now) {
            // Check task status
            const task = await get('tasks', n.taskId);

            // If task done/NA, suppress
            if (!task || task.status !== 'PLANNED') {
                n.suppressed = true;
                await update('notifications', n);
                continue;
            }

            // Fire
            new Notification("Release Task Reminder", {
                body: `${task.title}`
                // removed icon key as requested
            });

            n.firedAt = nowISO();
            await update('notifications', n);
        }
    }
}

// Global Click Delegation (Task Actions)
taskList.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const taskId = button.dataset.taskId;
    const action = button.dataset.action;

    if (!taskId || !action) return;

    // Handle SCHEDULE separately
    if (action === 'SCHEDULE') {
        const container = button.closest('.schedule-group');
        const dateInput = container.querySelector('.schedule-date');
        const timeInput = container.querySelector('.schedule-time');

        if (!dateInput.value) {
            showStatus("Please pick a date for the reminder", "error");
            return;
        }

        await scheduleNotification(taskId, dateInput.value, timeInput.value);
        return;
    }

    // Handle Standard Status Updates
    try {
        const task = await get('tasks', taskId);
        if (!task) throw new Error('Task not found');

        const timestamp = (action === 'DONE' || action === 'NOT_APPLICABLE') ? nowISO() : undefined;
        const updatedTask = updateTaskStatus(task, action, timestamp);

        await update('tasks', updatedTask);

        // Suppress pending notifications if completing
        if (action === 'DONE' || action === 'NOT_APPLICABLE') {
            const notifications = await queryByIndex('notifications', 'taskId', taskId);
            for (const n of notifications) {
                if (!n.firedAt && !n.suppressed) {
                    n.suppressed = true;
                    await update('notifications', n);
                }
            }
        }

        // Refresh view
        await loadTasks(task.releaseId);
    } catch (error) {
        showStatus(`Failed to update task: ${error.message}`, 'error');
    }
});

// Back to Releases
backToReleasesBtn.addEventListener('click', () => {
    taskView.style.display = 'none';
    form.style.display = 'block';
    releasesContainer.style.display = 'block';
    loadReleases(); // Refresh list in case of new adds (though we are here)
});

// Handle Release Creation
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
