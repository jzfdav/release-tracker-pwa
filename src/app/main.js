import { seedDefaultTemplates } from '../seed/templates.js';
import { createRelease } from '../domain/release.js';
import { instantiateTemplate } from '../domain/template.js';
import { add, getAll, get } from '../storage/db.js';

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

// Initialize App
async function init() {
    try {
        // Set default year
        yearInput.value = currentYear();

        // Seed data
        await seedDefaultTemplates();

        // Ready
        loading.style.display = 'none';
        form.style.display = 'block';
    } catch (error) {
        showStatus('Failed to initialize app. Please refresh.', 'error');
        loading.style.display = 'none';
    }
}

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
