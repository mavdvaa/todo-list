import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mysql from 'mysql2/promise';
import { createTaskRepository, initializeDatabase } from './database.mjs';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));

export function createApp(taskRepository) {
    const app = express();

    app.use(express.json({ limit: '10kb' }));

    app.get('/api/tasks', async (request, response) => {
        response.json(await taskRepository.list());
    });

    app.post('/api/tasks', async (request, response) => {
        const title = typeof request.body?.title === 'string'
            ? request.body.title.trim()
            : '';

        if (!title) {
            return response.status(400).json({ error: 'Введите текст задачи.' });
        }

        if (title.length > 120) {
            return response.status(400).json({ error: 'Задача не может быть длиннее 120 символов.' });
        }

        const task = await taskRepository.create(title);
        return response.status(201).json(task);
    });

    app.patch('/api/tasks/:id', async (request, response) => {
        if (!isValidId(request.params.id)) {
            return response.status(400).json({ error: 'Некорректный идентификатор задачи.' });
        }

        if (typeof request.body?.completed !== 'boolean') {
            return response.status(400).json({ error: 'Поле completed должно быть логическим значением.' });
        }

        const task = await taskRepository.updateCompleted(request.params.id, request.body.completed);

        if (!task) {
            return response.status(404).json({ error: 'Задача не найдена.' });
        }

        return response.json(task);
    });

    app.delete('/api/tasks/completed', async (request, response) => {
        const deletedCount = await taskRepository.deleteCompleted();
        return response.json({ deletedCount });
    });

    app.delete('/api/tasks/:id', async (request, response) => {
        if (!isValidId(request.params.id)) {
            return response.status(400).json({ error: 'Некорректный идентификатор задачи.' });
        }

        const deleted = await taskRepository.delete(request.params.id);

        if (!deleted) {
            return response.status(404).json({ error: 'Задача не найдена.' });
        }

        return response.status(204).end();
    });

    app.use('/api', (request, response) => {
        response.status(404).json({ error: 'Маршрут API не найден.' });
    });

    app.get('/', (request, response) => {
        response.sendFile(path.join(projectDirectory, 'index.html'));
    });

    app.get('/style.css', (request, response) => {
        response.sendFile(path.join(projectDirectory, 'style.css'));
    });

    app.get('/script.js', (request, response) => {
        response.sendFile(path.join(projectDirectory, 'script.js'));
    });

    app.use((request, response) => {
        response.status(404).send('Страница не найдена.');
    });

    app.use((error, request, response, next) => {
        if (response.headersSent) {
            return next(error);
        }

        if (error instanceof SyntaxError && 'body' in error) {
            return response.status(400).json({ error: 'Тело запроса должно содержать корректный JSON.' });
        }

        if (error.type === 'entity.too.large') {
            return response.status(413).json({ error: 'Запрос слишком большой.' });
        }

        console.error('Ошибка обработки запроса:', error);
        return response.status(500).json({ error: 'Внутренняя ошибка сервера.' });
    });

    return app;
}

function isValidId(id) {
    return typeof id === 'string' && /^[1-9]\d{0,19}$/.test(id);
}

async function startServer() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'todo_user',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'todo_list',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    await initializeDatabase(pool);

    const port = Number(process.env.PORT || 3000);
    const server = createApp(createTaskRepository(pool)).listen(port, '0.0.0.0', () => {
        console.log(`Сайт и API запущены: http://localhost:${port}`);
    });

    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, () => {
            server.close(async () => {
                await pool.end();
                process.exit(0);
            });
        });
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    startServer().catch(error => {
        console.error('Не удалось запустить приложение или подключиться к MySQL:', error);
        process.exitCode = 1;
    });
}
