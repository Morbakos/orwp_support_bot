const mysql = require("mysql");
import * as dotenv from "dotenv";
dotenv.config();

export class Database {
  private static instance: Database;

  public static getInstance(): Database {
    if (!this.instance) {
      this.instance = new Database();
    }
    return this.instance;
  }

  private databaseConnection: any;

  constructor() {
    this.databaseConnection = mysql.createConnection({
      host: process.env.DATABASE_HOST,
      user: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      connectTimeout: 999999,
    });
  }

  /**
   *
   * @param {string} query
   * @returns query result or error
   */
  execQuery(query: string) {
    return this.execQueryWithParams(query);
  }

  /**
   *
   * @param {string} query
   * @param {array} params
   * @returns query result or error
   */
  async execQueryWithParams(query: string, params: Array<any> = undefined) {
    return new Promise<any[]>((resolve, reject) => {
      this.databaseConnection.query(query, params, (error, result) => {
        return error ? reject(error) : resolve(result);
      });
    });
  }
}
