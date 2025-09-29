import mysql from "mysql2/promise";
import dotenv from 'dotenv';
dotenv.config();

async function setupDatabase() {
    try {
        // First connect without database to create it if needed
        const tempConnection = await mysql.createConnection({
            host: process.env.OCEANHERO_DB_HOST || process.env.DB_HOST || 'localhost',
            port: process.env.OCEANHERO_DB_PORT || process.env.DB_PORT || 3306,
            user: process.env.OCEANHERO_DB_USER || process.env.DB_USER,
            password: process.env.OCEANHERO_DB_PASSWORD || process.env.DB_PASSWORD,
        });

        // So nennen wir die DB
        const dbName = process.env.OCEANHERO_DB_NAME || 'oceanshare';
        
        // DB erstellen falls nicht vorhanden
        await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        console.log(`✓ Database "${dbName}" created/verified!`);
        await tempConnection.end();

        // Jetzt zur DB connecten
        const connection = await mysql.createConnection({
            host: process.env.OCEANHERO_DB_HOST || process.env.DB_HOST || 'localhost',
            port: process.env.OCEANHERO_DB_PORT || process.env.DB_PORT || 3306,
            user: process.env.OCEANHERO_DB_USER || process.env.DB_USER,
            password: process.env.OCEANHERO_DB_PASSWORD || process.env.DB_PASSWORD,
            database: dbName,
        });
        
        console.log(`✓ Connected to ${dbName}`);

        const tables = [
            
            `
            CREATE TABLE IF NOT EXISTS users (
                id INT,
                name VARCHAR(255) NOT NULL,
                shells_counter INT DEFAULT 0,
                search_counter INT DEFAULT 0,
                country VARCHAR(2),
                teamid INT,
                OCEANID VARCHAR(16)

            );
            `,

            `
            CREATE TABLE IF NOT EXISTS teams (
                teamid INT,
                name VARCHAR(255) NOT NULL,
                shells_counter INT DEFAULT 0,
                search_counter INT DEFAULT 0,
                country VARCHAR(2)
            );
            `
        ];

        // Create tables
        for (const sql of tables) {
            await connection.query(sql);
            const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
            console.log(`✓ Table created/verified: ${tableName}`);
        }

        // Show all tables
        const [tables_result] = await connection.query('SHOW TABLES');
        console.log(`\n📋 Tables in database:`);
        tables_result.forEach(table => {
            console.log(`   - ${Object.values(table)[0]}`);
        });

        await connection.end();
        console.log("\n🔌 Database connection closed.");
        console.log("🎉 Database setup completed successfully!");

    } catch (err) {
        console.error("❌ Error setting up database:", err);
        throw err;
    }
}

setupDatabase().catch(console.error);


export { setupDatabase };