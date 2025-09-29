import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

class Database {
    constructor() {
        this.connection = null;
        this.mysql = mysql;
    }

    async connect() {
        try {
            this.connection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 3306,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME
            });
            
            console.log('Connected to MariaDB database');
        } catch (error) {
            console.error('Database connection failed:', error.message);
            throw error;
        }
    }

    async prepare(query){
        this.connection.prepare(query)
    }

    /**
     * Add a user to the database
     * @param {string} username
     * @param {string} password
     * @returns {number} 
     */
    async registerUser(username) {

    }


    async close() {
        if (this.connection) {
            await this.connection.end();
            console.log('✅ Database connection closed');
        }
    }
}

async function setupDatabase() {
    const db = new Database();
    
    try {
        await db.connect();
        await db.createTables();
        
        console.log('Database setup complete!');
        return db;
    } catch (error) {
        console.error('Failed to setup database:', error.message);
        process.exit(1);
    }
}

export default Database;
export { setupDatabase };