import * as dotenv from "dotenv";
import { Connection, createConnection } from "mysql";
dotenv.config();

export class Database {
  private static instance: Database;

  public static getInstance(): Database {
    if (!this.instance) {
      this.instance = new Database();
    }
    return this.instance;
  }

  private databaseConnection: Connection;

  constructor() {
    this.databaseConnection = createConnection({
      host: process.env.DATABASE_HOST,
      user: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      connectTimeout: 999999,
    });

    this.databaseConnection.on('error', function(err) {
      console.log('db error', err);
      if(err.code === 'PROTOCOL_CONNECTION_LOST') {
        Database.getInstance();
      } else {
        throw err;
      }
    });
  }

  /**
   *
   * @param {string} query
   * @returns query result or error
   */
  execQuery(query: string): Promise<any> {
    return this.execQueryWithParams(query);
  }

  /**
   *
   * @param {string} query
   * @param {array} params
   * @returns query result or error
   */
  async execQueryWithParams(query: string, params?: any[]): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.databaseConnection.query(query, params, (error, result) => {
        return error ? reject(error) : resolve(result);
      });
    });
  }
}
