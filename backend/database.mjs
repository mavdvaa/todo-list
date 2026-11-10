export async function initializeDatabase(pool) {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS todo_tasks (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            title VARCHAR(120) NOT NULL,
            completed BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
}

export function createTaskRepository(pool) {
    return {
        async list() {
            const [rows] = await pool.execute(
                'SELECT id, title, completed, created_at FROM todo_tasks ORDER BY id DESC'
            );

            return rows.map(formatTask);
        },

        async create(title) {
            const [result] = await pool.execute(
                'INSERT INTO todo_tasks (title) VALUES (?)',
                [title]
            );

            return getTaskById(pool, String(result.insertId));
        },

        async updateCompleted(id, completed) {
            await pool.execute(
                'UPDATE todo_tasks SET completed = ? WHERE id = ?',
                [completed, id]
            );

            return getTaskById(pool, id);
        },

        async delete(id) {
            const [result] = await pool.execute(
                'DELETE FROM todo_tasks WHERE id = ?',
                [id]
            );

            return result.affectedRows > 0;
        },

        async deleteCompleted() {
            const [result] = await pool.execute(
                'DELETE FROM todo_tasks WHERE completed = TRUE'
            );

            return result.affectedRows;
        }
    };
}

async function getTaskById(pool, id) {
    const [rows] = await pool.execute(
        'SELECT id, title, completed, created_at FROM todo_tasks WHERE id = ?',
        [id]
    );

    return rows[0] ? formatTask(rows[0]) : null;
}

function formatTask(row) {
    return {
        id: String(row.id),
        title: row.title,
        completed: Boolean(row.completed),
        createdAt: row.created_at
    };
}
