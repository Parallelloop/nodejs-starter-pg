const {
    DB_NAME,
    DB_USERNAME,
    DB_PASSWORD,
    DB_DIALECT,
    DB_PORT,
    DB_HOST
  } = process.env
  
    export default {
        DB_NAME: DB_NAME as string,
        DB_USERNAME: DB_USERNAME as string,
        DB_PASSWORD: DB_PASSWORD as string,
        DB_HOST: DB_HOST as string,
        DB_DIALECT: DB_DIALECT as string,
        DB_PORT: Number(DB_PORT)
    };