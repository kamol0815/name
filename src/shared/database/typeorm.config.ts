import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from '../config';
import * as entities from './entities';

export const dataSourceOptions: DataSourceOptions = {
    type: 'postgres',
    url: config.POSTGRES_URI,
    entities: Object.values(entities).filter(
        (entity) => typeof entity === 'function',
    ),
    synchronize: config.NODE_ENV === 'development', // Auto-sync in development
    logging: false, // Disable SQL query logs
    migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
    migrationsRun: false,
    ssl: false,
};

export const AppDataSource = new DataSource(dataSourceOptions);

export const initializeDatabase = async () => {
    try {
        await AppDataSource.initialize();
        console.log('✅ PostgreSQL connected successfully');
        return AppDataSource;
    } catch (error) {
        console.error('❌ PostgreSQL connection error:', error);
        throw error;
    }
};
