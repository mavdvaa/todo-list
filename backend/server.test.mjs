import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from './server.mjs';

const tasks = [];
let nextId = 1;
let server;
let baseUrl;

const repository = {
    async list() {
        return [...tasks];
    },
    async create(title) {
        const task = {
            id: String(nextId++),
            title,
            completed: false
        };
        tasks.unshift(task);
        return task;
    },
    async updateCompleted(id, completed) {
        const task = tasks.find(item => item.id === id);

        if (!task) {
            return null;
        }

        task.completed = completed;
        return { ...task };
    },
    async delete(id) {
        const index = tasks.findIndex(item => item.id === id);

        if (index === -1) {
            return false;
        }

        tasks.splice(index, 1);
        return true;
    },
    async deleteCompleted() {
        const activeTasks = tasks.filter(task => !task.completed);
        const deletedCount = tasks.length - activeTasks.length;
        tasks.splice(0, tasks.length, ...activeTasks);
        return deletedCount;
    }
};

before(async () => {
    server = createApp(repository).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
    });
});

test('creates a task and returns it from the task list', async () => {
    const createdResponse = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '  Проверить API  ' })
    });
    const createdTask = await createdResponse.json();

    assert.equal(createdResponse.status, 201);
    assert.equal(createdTask.title, 'Проверить API');
    assert.equal(createdTask.completed, false);

    const listResponse = await fetch(`${baseUrl}/api/tasks`);
    assert.deepEqual(await listResponse.json(), [createdTask]);
});

test('rejects empty and overlong task titles', async () => {
    const emptyResponse = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '  ' })
    });
    const longResponse = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'x'.repeat(121) })
    });

    assert.equal(emptyResponse.status, 400);
    assert.equal(longResponse.status, 400);
});

test('updates and deletes a task', async () => {
    const createdResponse = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Задача для удаления' })
    });
    const task = await createdResponse.json();
    const updatedResponse = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true })
    });

    assert.equal(updatedResponse.status, 200);
    assert.equal((await updatedResponse.json()).completed, true);

    const deletedResponse = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
        method: 'DELETE'
    });

    assert.equal(deletedResponse.status, 204);
    assert.equal((await fetch(`${baseUrl}/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: false })
    })).status, 404);
});

test('rejects invalid completion values and identifiers', async () => {
    const invalidIdResponse = await fetch(`${baseUrl}/api/tasks/invalid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true })
    });
    const invalidStatusResponse = await fetch(`${baseUrl}/api/tasks/1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: 'yes' })
    });

    assert.equal(invalidIdResponse.status, 400);
    assert.equal(invalidStatusResponse.status, 400);
});
