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

        div.innerHTML = `
      <div class="task-meta">Step ${task.sequence} &middot; Status: ${task.status}</div>
      <h3>${task.title}</h3>
      ${task.description ? `<p>${task.description}</p>` : ''}
      ${branchInfo}
      
      <div class="task-actions">
        ${!isDone ? `<button class="small" data-task-id="${task.id}" data-action="DONE">Mark Done</button>` : ''}
        ${!isNA ? `<button class="small secondary" data-task-id="${task.id}" data-action="NOT_APPLICABLE">Mark N/A</button>` : ''}
        ${isCompleted ? `<button class="small secondary" data-task-id="${task.id}" data-action="PLANNED">Reset</button>` : ''}
      </div>
    `;

        taskList.appendChild(div);
    });
}

// Task Actions (Event Delegation)
taskList.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const taskId = button.dataset.taskId;
    const action = button.dataset.action;

    if (!taskId || !action) return;

    try {
        const task = await get('tasks', taskId);
        if (!task) throw new Error('Task not found');

        // Record timestamp for DONE and NOT_APPLICABLE
        // Reset passes undefined
        const timestamp = (action === 'DONE' || action === 'NOT_APPLICABLE') ? nowISO() : undefined;
        const updatedTask = updateTaskStatus(task, action, timestamp);

        await update('tasks', updatedTask);

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

// Handle Form Submit
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear status
    statusMessage.style.display = 'none';
    statusMessage.className = '';

    const formData = new FormData(form);
    const type = formData.get('releaseType');
    const quarter = formData.get('quarter');
    const year = formData.get('year');

    try {
        // 1. Construct Release Name
        const name = `${quarter} ${type} ${year}`;
        const id = `${quarter.toLowerCase()}-${type.toLowerCase()}-${year}`;

        // Guard against duplicate
        const existing = await get('releases', id);
        if (existing) {
            throw new Error('Release already exists');
        }

        // 2. Create Release Object
        const release = createRelease(id, name, nowISO());

        // 3. Persist Release
        await add('releases', release);

        // 4. Fetch Template
        const templates = await getAll('templates');
        const template = templates.find(t => t.releaseType === type);

        if (!template) {
            throw new Error(`No default template found for type: ${type}`);
        }

        // 5. Instantiate Tasks
        const tasks = instantiateTemplate(template, release);

        // 6. Persist Tasks with IDs
        // Generate deterministic IDs here for simplicity in this layer
        // task id format: releaseId-sequence
        const tasksToSave = tasks.map(task => ({
            ...task,
            id: `${release.id}-task-${task.sequence}`
        }));

        // Save strictly sequentially or parallel (Parallel is fine for IndexedDB usually, but loop is safer for logic)
        for (const task of tasksToSave) {
            await add('tasks', task);
        }

        // 7. Success
        showStatus(`Successfully created release: ${name}`, 'success');
        form.reset();
        yearInput.value = currentYear(); // Reset year default

        // Refresh List
        await loadReleases();

    } catch (error) {
        // Handle duplicate key error specially if possible, otherwise generic
        if (error.name === 'ConstraintError') {
            showStatus('Error: A release with this ID already exists.', 'error');
        } else {
            showStatus(`Error: ${error.message}`, 'error');
        }
    }
});

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = type; // 'error' or 'success'
    statusMessage.style.display = 'block';
}

// Start
init();
