
let config;
let baseUrl;
let headers;
let editingId = null;

let tasksCache = [];
let currentFilter = 'all';
let searchQuery = '';

const form = document.getElementById('task-form');
const titleInput = document.getElementById('task-title');
const descInput = document.getElementById('task-description');
const submitBtn = document.getElementById('task-submit');
const cancelEditBtn = document.getElementById('cancel-edit');
const list = document.getElementById('task-list');
const statusEl = document.getElementById('status-message');

const totalCount = document.getElementById('total-count');
const activeCount = document.getElementById('active-count');
const completedCount = document.getElementById('completed-count');
const visibleCount = document.getElementById('visible-count');

const searchInput = document.getElementById('task-search');
const filterButtons = document.querySelectorAll('.filter-button');


/* ========================================
   STATUS MESSAGES
======================================== */

function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', isError);
}


/* ========================================
   SUPABASE API
======================================== */

async function api(path, options = {}) {

    const response = await fetch(
        `${baseUrl}/${config.tableName}${path}`,
        {
            ...options,
            headers: {
                ...headers,
                ...(options.headers || {})
            }
        }
    );

    if (!response.ok) {

        const errorText = await response.text();

        let errorMessage = errorText;

        try {
            const errorData = JSON.parse(errorText);

            errorMessage =
                errorData.message ||
                errorData.error_description ||
                errorData.error ||
                errorText;

        } catch {
            // Keep the original response text.
        }

        throw new Error(
            `Request failed (${response.status}): ${errorMessage}`
        );
    }

    const text = await response.text();

    return text ? JSON.parse(text) : null;
}


/* ========================================
   LOAD TASKS
======================================== */

async function loadTasks() {

    try {

        const tasks = await api('?select=*&order=id.asc');

        tasksCache = Array.isArray(tasks) ? tasks : [];

        render();

        if (tasksCache.length === 0) {
            setStatus('No tasks yet. Add one above.');
        } else {
            setStatus('');
        }

    } catch (error) {

        setStatus(
            'Could not load tasks: ' + error.message,
            true
        );

        console.error('Loading tasks failed:', error);
    }
}


/* ========================================
   UPDATE DASHBOARD STATISTICS
======================================== */

function updateStats() {

    const total = tasksCache.length;

    const completed = tasksCache.filter(
        task => task.completed
    ).length;

    const active = total - completed;

    totalCount.textContent = total;
    activeCount.textContent = active;
    completedCount.textContent = completed;
}


/* ========================================
   FILTER AND SEARCH TASKS
======================================== */

function getFilteredTasks() {

    return tasksCache.filter(task => {

        const matchesFilter =
            currentFilter === 'all' ||
            (currentFilter === 'active' && !task.completed) ||
            (currentFilter === 'completed' && task.completed);

        const searchText =
            `${task.title} ${task.description || ''}`.toLowerCase();

        const matchesSearch =
            searchText.includes(searchQuery);

        return matchesFilter && matchesSearch;

    });
}


/* ========================================
   RENDER TASKS
======================================== */

function render() {

    list.innerHTML = '';

    updateStats();

    const filteredTasks = getFilteredTasks();

    visibleCount.textContent = filteredTasks.length;

    if (filteredTasks.length === 0) {

        const emptyState = document.createElement('div');

        emptyState.className = 'empty-state';

        if (tasksCache.length === 0) {
            emptyState.textContent =
                'No tasks yet. Add your first task!';
        } else if (searchQuery) {
            emptyState.textContent =
                'No tasks match your search.';
        } else {
            emptyState.textContent =
                'No tasks in this category.';
        }

        list.appendChild(emptyState);

        return;
    }

    filteredTasks.forEach(task => {

        const item = document.createElement('div');

        item.className =
            'task-item' + (task.completed ? ' done' : '');

        item.dataset.id = task.id;


        // Task title

        const title = document.createElement('p');

        title.className = 'task-title';

        title.textContent = task.title;


        // Task description

        const description = document.createElement('p');

        description.className = 'task-description';

        description.textContent = task.description || '';


        // Task status

        const status = document.createElement('p');

        status.className = 'task-status';

        status.textContent = task.completed
            ? 'Completed'
            : 'Not completed';


        // Toggle completion button

        const toggle = document.createElement('button');

        toggle.type = 'button';
        toggle.className = 'toggle-task';

        toggle.textContent = task.completed
            ? 'Mark incomplete'
            : 'Mark complete';

        toggle.addEventListener('click', () => {
            toggleTask(task);
        });


        // Edit button

        const edit = document.createElement('button');

        edit.type = 'button';
        edit.className = 'edit-task';
        edit.textContent = 'Edit';

        edit.addEventListener('click', () => {
            startEdit(task);
        });


        // Delete button

        const del = document.createElement('button');

        del.type = 'button';
        del.className = 'delete-task';
        del.textContent = 'Delete';

        del.addEventListener('click', () => {
            deleteTask(task.id);
        });


        // Add everything to the task card

        item.append(
            title,
            description,
            status,
            toggle,
            edit,
            del
        );

        list.appendChild(item);

    });

}


/* ========================================
   START EDITING A TASK
======================================== */

function startEdit(task) {

    editingId = task.id;

    titleInput.value = task.title;

    descInput.value = task.description || '';

    submitBtn.innerHTML = '<span>Save changes</span>';

    cancelEditBtn.hidden = false;

    titleInput.focus();

}


/* ========================================
   RESET FORM
======================================== */

function resetForm() {

    editingId = null;

    form.reset();

    submitBtn.innerHTML =
        '<span class="button-plus">＋</span><span>Add task</span>';

    cancelEditBtn.hidden = true;

}


/* ========================================
   CANCEL EDITING
======================================== */

cancelEditBtn.addEventListener('click', () => {

    resetForm();

    setStatus('Editing cancelled.');

});


/* ========================================
   TOGGLE TASK COMPLETION
======================================== */

async function toggleTask(task) {

    try {

        await api(`?id=eq.${task.id}`, {

            method: 'PATCH',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                completed: !task.completed
            })

        });

        await loadTasks();

        setStatus('Task updated successfully.');

    } catch (error) {

        setStatus(
            'Could not update task: ' + error.message,
            true
        );

        console.error('Updating task failed:', error);

    }

}


/* ========================================
   DELETE TASK
======================================== */

async function deleteTask(id) {

    const confirmed = window.confirm(
        'Are you sure you want to delete this task?'
    );

    if (!confirmed) {
        return;
    }

    try {

        await api(`?id=eq.${id}`, {
            method: 'DELETE'
        });

        if (editingId === id) {
            resetForm();
        }

        await loadTasks();

        setStatus('Task deleted successfully.');

    } catch (error) {

        setStatus(
            'Could not delete task: ' + error.message,
            true
        );

        console.error('Deleting task failed:', error);

    }

}


/* ========================================
   ADD OR EDIT TASK
======================================== */

form.addEventListener('submit', async (event) => {

    event.preventDefault();

    const body = {
        title: titleInput.value.trim(),
        description: descInput.value.trim()
    };

    if (!body.title) {

        setStatus('Title is required.', true);

        titleInput.focus();

        return;
    }

    try {

        if (editingId === null) {

            // Add a new task

            await api('', {

                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },

                body: JSON.stringify(body)

            });

            resetForm();

            await loadTasks();

            setStatus('Task added successfully.');

        } else {

            // Update an existing task

            const id = editingId;

            await api(`?id=eq.${id}`, {

                method: 'PATCH',

                headers: {
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },

                body: JSON.stringify(body)

            });

            resetForm();

            await loadTasks();

            setStatus('Task saved successfully.');

        }

    } catch (error) {

        setStatus(
            'Could not save task: ' + error.message,
            true
        );

        console.error('Saving task failed:', error);

    }

});


/* ========================================
   SEARCH TASKS
======================================== */

searchInput.addEventListener('input', () => {

    searchQuery = searchInput.value.trim().toLowerCase();

    render();

});


/* ========================================
   FILTER BUTTONS
======================================== */

filterButtons.forEach(button => {

    button.addEventListener('click', () => {

        currentFilter = button.dataset.filter;

        filterButtons.forEach(filterButton => {

            const isActive =
                filterButton === button;

            filterButton.classList.toggle(
                'active',
                isActive
            );

            filterButton.setAttribute(
                'aria-pressed',
                String(isActive)
            );

        });

        render();

    });

});


/* ========================================
   KEYBOARD SHORTCUTS
======================================== */

document.addEventListener('keydown', event => {

    const target = event.target;

    const isTyping =
        target instanceof HTMLElement &&
        (
            target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
        );


    // Press / to focus the search field

    if (
        event.key === '/' &&
        !isTyping &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
    ) {

        event.preventDefault();

        searchInput.focus();

    }


    // Press Escape to clear the search

    if (event.key === 'Escape') {

        if (searchInput.value || document.activeElement === searchInput) {

            searchInput.value = '';

            searchQuery = '';

            searchInput.blur();

            render();

        }

    }

});


/* ========================================
   INITIALIZE APPLICATION
======================================== */

async function init() {

    try {

        // Load Supabase configuration

        const response = await fetch('config.json');

        if (!response.ok) {
            throw new Error(
                `Could not load config.json (${response.status})`
            );
        }

        config = await response.json();


        // Validate configuration

        if (
            !config.supabaseUrl ||
            !config.supabasePublishableKey ||
            !config.tableName
        ) {

            throw new Error(
                'Missing Supabase configuration values.'
            );

        }


        // Build the REST API URL

        const projectUrl = config.supabaseUrl
            .replace(/\/+$/, '')
            .replace(/\/rest\/v1$/, '');

        baseUrl = `${projectUrl}/rest/v1`;


        // Supabase publishable keys belong in the apikey header.
        // Do not send them as Authorization Bearer tokens.

        headers = {
            apikey: config.supabasePublishableKey
        };


        // Load tasks from Supabase

        await loadTasks();

    } catch (error) {

        setStatus(
            'Could not initialize application: ' + error.message,
            true
        );

        console.error('Initialization failed:', error);

    }

}


// Start the application

init();
