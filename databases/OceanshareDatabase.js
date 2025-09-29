import mysql from 'mysql2/promise';
import Database from './Database.js';
import dotenv from 'dotenv';
dotenv.config();

class OceanshareDatabase extends Database {
    /**
     * @param {string} prefix - Environment variable prefix (e.g., "OCEAN")
     */
    constructor(prefix = 'OCEAN') {
        super();
        this.prefix = prefix;
        this.dbName = process.env[`${prefix}_DB_NAME`] || 'oceanhero_db';
    }

    async connect() {
        try {
            this.connection = await this.mysql.createConnection({
                host: process.env[`${this.prefix}_DB_HOST`] || process.env.DB_HOST || 'localhost',
                port: process.env[`${this.prefix}_DB_PORT`] || process.env.DB_PORT || 3306,
                user: process.env[`${this.prefix}_DB_USER`] || process.env.DB_USER,
                password: process.env[`${this.prefix}_DB_PASSWORD`] || process.env.DB_PASSWORD,
                database: this.dbName,
            });
            console.log(`Connected to ${this.prefix} database: ${this.dbName}`);
        } catch (error) {
            console.error(`${this.prefix} DB connection failed:`, error.message);
            throw error;
        }
    }

    async checkDatabaseExists() {
        try {
            const connection = await mysql.createConnection({
                host: process.env[`${this.prefix}_DB_HOST`] || process.env.DB_HOST || 'localhost',
                port: process.env[`${this.prefix}_DB_PORT`] || process.env.DB_PORT || 3306,
                user: process.env[`${this.prefix}_DB_USER`] || process.env.DB_USER,
                password: process.env[`${this.prefix}_DB_PASSWORD`] || process.env.DB_PASSWORD,
            });
            
            await connection.query(`CREATE DATABASE IF NOT EXISTS \`${this.dbName}\`;`);
            console.log(`✅ Database "${this.dbName}" exists!`);
            await connection.end();
        } catch (error) {
            console.error(`❌ Failed to check/create ${this.prefix} database:`, error.message);
            throw error;
        }
    }

    async createTables() {
        try {
            
            await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS users (
                    id INT,
                    name VARCHAR(255) NOT NULL,
                    shells_counter INT DEFAULT 0,
                    search_counter INT DEFAULT 0,
                    country VARCHAR(2),
                    teamid INT,
                    OCEANID VARCHAR(16)
                );
            `);

            await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS teams (
                    teamid INT,
                    name VARCHAR(255) NOT NULL,
                    shells_counter INT DEFAULT 0,
                    search_counter INT DEFAULT 0,
                    country VARCHAR(2)
                );
            `);

            console.log('✅ All tables created successfully');
        } catch (error) {
            console.error('❌ Failed to create tables:', error.message);
            throw error;
        }
    }

    /**
     * Add or update a user in the database
     * @param {Object} userData - User data object
     * @param {number} teamid - Optional team ID to assign user to
     * @returns {string} user id
     */
    async upsertUser(userData, teamid = null) {
        try {
            const {
                id,
                name,
                shellsCounter = 0,
                counter = 0,
                country = null
            } = userData;

            await this.connection.execute(
                `INSERT INTO users 
                (id, name, shells_counter, search_counter, country, teamid, oceanid)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                shells_counter = VALUES(shells_counter),
                search_counter = VALUES(search_counter),
                country = VALUES(country),
                teamid = VALUES(teamid),
                oceanid = VALUES(oceanid)`,
                [id, name, shellsCounter, counter, country, teamid]
            );

            console.log(`✅ User "${name}" (${id}) upserted successfully`);
            return id;
        } catch (error) {
            console.error('❌ Failed to upsert user:', error.message);
            throw error;
        }
    }

    /**
     * Static factory method to create and initialize the database
     * @param {string} prefix - Environment variable prefix (default: "OCEAN")
     * @returns {Promise<OceanshareDatabase>}
     */
    static async create(prefix = 'OCEAN') {
        const db = new OceanshareDatabase(prefix);
        await db.checkDatabaseExists();
        await db.connect();
        await db.createTables();
        return db;
    }
}

export default OceanshareDatabase;