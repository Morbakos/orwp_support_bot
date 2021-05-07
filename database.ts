const mysql = require('mysql');
import * as dotenv from "dotenv";
dotenv.config();

export class Database {

    private databaseConnection;

    constructor(){
        this.databaseConnection = mysql.createConnection({
            host: process.env.DATABASE_HOST,
            user: process.env.DATABASE_USERNAME,
            password: process.env.DATABASE_PASSWORD,
            database: process.env.DATABASE_NAME
        });
    }

    /**
     * 
     * @param {string} query 
     * @returns query result or error
     */ 
    async execQuery (query) {
        return new Promise<any>((resolve, reject) => {
            this.databaseConnection.query(query,
                (error, result) => {
                    return error ? reject(error) : resolve(result);
                }
            );
        });
    }

    /**
     * 
     * @param {string} query 
     * @param {array} params 
     * @returns query result or error
     */
    async execQueryWithParams (query, params) {
        return new Promise<any>((resolve, reject) => {
            this.databaseConnection.query(
                query,
                params,
                (error, result) => {
                    return error ? reject(error) : resolve(result);
                }
            );
        });
    }
}