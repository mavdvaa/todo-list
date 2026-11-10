const taskForm = document.querySelector('#task-form');
const taskInput = document.querySelector('#task-input');
const taskList = document.querySelector('#task-list');
const taskCount = document.querySelector('#task-count');
const progressValue = document.querySelector('#progress-value');
const progressBar = document.querySelector('#progress-bar');
const clearCompletedButton = document.querySelector('#clear-completed');
const statusMessage = document.querySelector('#status-message');
const filterButtons = document.querySelectorAll('[data-filter]');

let tasks = [];
let activeFilter = 'all';

document.querySelector('#today-date').textContent = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
}).format(new Date());

taskForm.addEventListener('submit', addTask);
taskList.addEventListener('change', updateTaskStatus);
taskList.addEventListener('click', handleTaskClick);
clearCompletedButton.addEventListener('click', clearCompletedTasks);

for (const button of filterButtons) {
    button.addEventListener('click', () => {
        activeFilter = button.dataset.filter;
        renderTasks();
    });
}

renderTasks();
refreshTasks();

async function requestApi(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers
        }
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `Ошибка сервера (${response.status}).`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

async function refreshTasks() {
    statusMessage.textContent = 'Загружаем задачи...';

    try {
        tasks = await requestApi('/api/tasks');
        statusMessage.textContent = '';
        renderTasks();
    } catch (error) {
        console.error('Не удалось загрузить список задач:', error);
        statusMessage.textContent = `Не удалось загрузить задачи: ${error.message}`;
    }
}

async function addTask(event) {
    event.preventDefault();
    const title = taskInput.value.trim();

    if (!title) {
        taskInput.focus();
        statusMessage.textContent = 'Введите текст задачи.';
        return;
    }

    try {
        const task = await requestApi('/api/tasks', {
            method: 'POST',
            body: JSON.stringify({ title })
        });

        tasks.unshift(task);
        taskInput.value = '';
        activeFilter = 'all';
        statusMessage.textContent = '';
        renderTasks();
        taskInput.focus();
    } catch (error) {
        console.error('Не удалось добавить задачу:', error);
        statusMessage.textContent = error.message;
    }
}

async function updateTaskStatus(event) {
    if (!event.target.matches('.task-checkbox')) {
        return;
    }

    const task = tasks.find(item => item.id === event.target.dataset.taskId);

    if (!task) {
        return;
    }

    const completed = event.target.checked;

    try {
        const updatedTask = await requestApi(`/api/tasks/${encodeURIComponent(task.id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ completed })
        });

        tasks = tasks.map(item => item.id === updatedTask.id ? updatedTask : item);
        statusMessage.textContent = '';
        renderTasks();
    } catch (error) {
        console.error('Не удалось изменить статус задачи:', error);
        statusMessage.textContent = error.message;
        renderTasks();
    }
}

async function handleTaskClick(event) {
    const deleteButton = event.target.closest('.delete-button');

    if (!deleteButton) {
        return;
    }

    try {
        await requestApi(`/api/tasks/${encodeURIComponent(deleteButton.dataset.taskId)}`, {
            method: 'DELETE'
        });

        tasks = tasks.filter(task => task.id !== deleteButton.dataset.taskId);
        statusMessage.textContent = '';
        renderTasks();
    } catch (error) {
        console.error('Не удалось удалить задачу:', error);
        statusMessage.textContent = error.message;
    }
}

async function clearCompletedTasks() {
    try {
        await requestApi('/api/tasks/completed', { method: 'DELETE' });
        tasks = tasks.filter(task => !task.completed);
        statusMessage.textContent = '';
        renderTasks();
    } catch (error) {
        console.error('Не удалось удалить выполненные задачи:', error);
        statusMessage.textContent = error.message;
    }
}

function renderTasks() {
    const completedCount = tasks.filter(task => task.completed).length;
    const remainingCount = tasks.length - completedCount;
    const completionPercentage = tasks.length
        ? Math.round((completedCount / tasks.length) * 100)
        : 0;

    taskCount.textContent = String(remainingCount);
    progressValue.textContent = `${completionPercentage}%`;
    progressBar.style.width = `${completionPercentage}%`;
    progressBar.setAttribute('role', 'progressbar');
    progressBar.setAttribute('aria-valuemin', '0');
    progressBar.setAttribute('aria-valuemax', '100');
    progressBar.setAttribute('aria-valuenow', String(completionPercentage));
    clearCompletedButton.disabled = completedCount === 0;

    for (const button of filterButtons) {
        const isActive = button.dataset.filter === activeFilter;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    }

    const visibleTasks = tasks.filter(task => {
        if (activeFilter === 'active') {
            return !task.completed;
        }

        if (activeFilter === 'completed') {
            return task.completed;
        }

        return true;
    });

    if (visibleTasks.length === 0) {
        taskList.replaceChildren(createEmptyState());
        return;
    }

    taskList.replaceChildren(...visibleTasks.map(createTaskElement));
}

function createTaskElement(task) {
    const item = document.createElement('li');
    const checkbox = document.createElement('input');
    const label = document.createElement('label');
    const deleteButton = document.createElement('button');

    item.className = `task-row${task.completed ? ' is-completed' : ''}`;

    checkbox.className = 'task-checkbox';
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.dataset.taskId = task.id;
    checkbox.id = `task-${task.id}`;
    checkbox.setAttribute('aria-label', `Отметить задачу «${task.title}» выполненной`);

    label.className = 'task-title';
    label.htmlFor = checkbox.id;
    label.textContent = task.title;

    deleteButton.className = 'delete-button';
    deleteButton.type = 'button';
    deleteButton.dataset.taskId = task.id;
    deleteButton.textContent = '×';
    deleteButton.setAttribute('aria-label', `Удалить задачу «${task.title}»`);

    item.append(checkbox, label, deleteButton);
    return item;
}

function createEmptyState() {
    const item = document.createElement('li');
    const icon = document.createElement('span');
    const message = document.createElement('p');
    const messages = {
        all: 'Пока здесь пусто. Добавьте первую задачу.',
        active: 'Все задачи выполнены. Отличная работа!',
        completed: 'Выполненные задачи появятся здесь.'
    };

    item.className = 'empty-state';
    icon.className = 'empty-icon';
    icon.textContent = activeFilter === 'active' ? '✓' : '＋';
    icon.setAttribute('aria-hidden', 'true');
    message.textContent = messages[activeFilter];
    item.append(icon, message);

    return item;
}
