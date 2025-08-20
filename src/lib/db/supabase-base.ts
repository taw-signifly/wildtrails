import { z } from 'zod';
import { createServiceRoleClient } from './supabase';
import { Result, tryCatch } from '@/types';

/**
 * Supabase database error classes
 */
export class DatabaseError extends Error {
	constructor(message: string, public readonly cause?: Error) {
		super(message);
		this.name = 'DatabaseError';
	}
}

export class ValidationError extends DatabaseError {
	constructor(message: string, public readonly issues: z.ZodIssue[]) {
		super(message);
		this.name = 'ValidationError';
	}
}

export class RecordNotFoundError extends DatabaseError {
	constructor(id: string, entityType: string) {
		super(`${entityType} with ID ${id} not found`);
		this.name = 'RecordNotFoundError';
	}
}

/**
 * Base interface for all database entities
 */
export interface BaseEntity {
	id: string;
	created_at: string;
	updated_at: string;
}

/**
 * Database configuration options
 */
export interface SupabaseConfig {
	tableName: string;
	enableRealtime?: boolean;
}

/**
 * Abstract base class for all Supabase database operations
 */
export abstract class SupabaseDB<T extends BaseEntity> {
	protected readonly entityName: string;
	protected readonly tableName: string;
	protected readonly enableRealtime: boolean;
	private _supabase: ReturnType<typeof createServiceRoleClient> | null = null;

	constructor(entityName: string, config: SupabaseConfig, protected readonly schema: z.ZodSchema<T>) {
		this.entityName = entityName;
		this.tableName = config.tableName;
		this.enableRealtime = config.enableRealtime ?? false;
		// Don't create the client in constructor - use lazy initialization
	}

	/**
	 * Get Supabase client with lazy initialization
	 */
	protected get supabase(): ReturnType<typeof createServiceRoleClient> {
		if (!this._supabase) {
			this._supabase = createServiceRoleClient();
		}
		return this._supabase;
	}

	/**
	 * Create a new record
	 */
	async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<Result<T, DatabaseError>> {
		return tryCatch(async () => {
			// Validate data before insertion
			const recordData = {
				...data,
				// Let PostgreSQL generate id, created_at, updated_at automatically
			};

			const { data: insertedData, error } = await this.supabase.from(this.tableName).insert(recordData).select().single();

			if (error) {
				throw new DatabaseError(`Failed to create ${this.entityName}: ${error.message}`, new Error(error.message));
			}

			return this.validateData(insertedData);
		});
	}

	/**
	 * Find a record by ID
	 */
	async findById(id: string): Promise<Result<T | null, DatabaseError>> {
		return tryCatch(async () => {
			const { data, error } = await this.supabase.from(this.tableName).select('*').eq('id', id).single();

			if (error) {
				// Handle "not found" case specifically
				if (error.code === 'PGRST116') {
					return null;
				}
				throw new DatabaseError(`Failed to find ${this.entityName} by ID: ${error.message}`, new Error(error.message));
			}

			return data ? this.validateData(data) : null;
		});
	}

	/**
	 * Find all records with optional filtering
	 */
	async findAll(
		filters?: Record<string, any>,
		options?: {
			orderBy?: string;
			ascending?: boolean;
			limit?: number;
			offset?: number;
		}
	): Promise<Result<T[], DatabaseError>> {
		return tryCatch(async () => {
			let query = this.supabase.from(this.tableName).select('*');

			// Apply filters
			if (filters && Object.keys(filters).length > 0) {
				Object.entries(filters).forEach(([key, value]) => {
					if (value !== undefined && value !== null) {
						if (Array.isArray(value)) {
							query = query.in(key, value);
						} else if (typeof value === 'string' && key.includes('name')) {
							// Use ilike for name-based searches
							query = query.ilike(key, `%${value}%`);
						} else {
							query = query.eq(key, value);
						}
					}
				});
			}

			// Apply ordering
			const orderBy = options?.orderBy || 'updated_at';
			const ascending = options?.ascending ?? false;
			query = query.order(orderBy, { ascending });

			// Apply pagination
			if (options?.limit) {
				query = query.limit(options.limit);
				if (options.offset) {
					query = query.range(options.offset, options.offset + options.limit - 1);
				}
			}

			const { data, error } = await query;

			if (error) {
				throw new DatabaseError(`Failed to find ${this.entityName} records: ${error.message}`, new Error(error.message));
			}

			// Validate all records
			const validatedRecords: T[] = [];
			const errors: string[] = [];

			for (const record of data || []) {
				try {
					validatedRecords.push(this.validateData(record));
				} catch (validationError) {
					const errorMsg = `Failed to validate record ${record.id}: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`;
					errors.push(errorMsg);
					console.warn(errorMsg, validationError);
				}
			}

			// If too many records failed validation, this might indicate a systemic issue
			if (errors.length > 0 && data && errors.length >= data.length / 2) {
				throw new DatabaseError(
					`Too many validation errors (${errors.length}/${data.length}): ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`
				);
			}

			return validatedRecords;
		});
	}

	/**
	 * Update an existing record
	 */
	async update(id: string, updateData: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>): Promise<Result<T, DatabaseError>> {
		return tryCatch(async () => {
			const { data, error } = await this.supabase
				.from(this.tableName)
				.update({
					...updateData,
					updated_at: new Date().toISOString(),
				})
				.eq('id', id)
				.select()
				.single();

			if (error) {
				if (error.code === 'PGRST116') {
					throw new RecordNotFoundError(id, this.entityName);
				}
				throw new DatabaseError(`Failed to update ${this.entityName}: ${error.message}`, new Error(error.message));
			}

			return this.validateData(data);
		});
	}

	/**
	 * Delete a record
	 */
	async delete(id: string): Promise<Result<void, DatabaseError>> {
		return tryCatch(async () => {
			const { error } = await this.supabase.from(this.tableName).delete().eq('id', id);

			if (error) {
				throw new DatabaseError(`Failed to delete ${this.entityName}: ${error.message}`, new Error(error.message));
			}
		});
	}

	/**
	 * Get the count of records matching filters
	 */
	async count(filters?: Record<string, any>): Promise<Result<number, DatabaseError>> {
		return tryCatch(async () => {
			let query = this.supabase.from(this.tableName).select('*', { count: 'exact', head: true });

			// Apply filters
			if (filters && Object.keys(filters).length > 0) {
				Object.entries(filters).forEach(([key, value]) => {
					if (value !== undefined && value !== null) {
						if (Array.isArray(value)) {
							query = query.in(key, value);
						} else if (typeof value === 'string' && key.includes('name')) {
							query = query.ilike(key, `%${value}%`);
						} else {
							query = query.eq(key, value);
						}
					}
				});
			}

			const { count, error } = await query;

			if (error) {
				throw new DatabaseError(`Failed to count ${this.entityName} records: ${error.message}`, new Error(error.message));
			}

			return count || 0;
		});
	}

	/**
	 * Check if a record exists
	 */
	async exists(id: string): Promise<Result<boolean, DatabaseError>> {
		return tryCatch(async () => {
			const recordResult = await this.findById(id);
			if (recordResult.error) {
				throw recordResult.error;
			}
			return recordResult.data !== null;
		});
	}

	/**
	 * Execute a batch of operations in a transaction
	 */
	async batch(operations: Array<() => Promise<any>>): Promise<Result<any[], DatabaseError>> {
		return tryCatch(async () => {
			// Note: Supabase doesn't have native transaction support for multiple tables
			// This is a simple sequential execution - for true transactions,
			// we'd need to use database functions or move complex operations to the database
			const results = [];
			for (const operation of operations) {
				const result = await operation();
				results.push(result);
			}
			return results;
		});
	}

	/**
	 * Subscribe to real-time changes (if enabled)
	 */
	subscribeToChanges(callback: (payload: any) => void, filters?: Record<string, any>) {
		if (!this.enableRealtime) {
			throw new Error(`Real-time not enabled for ${this.entityName}`);
		}

		const subscription = this.supabase
			.channel(`${this.tableName}_changes`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: this.tableName,
					filter: filters
						? Object.entries(filters)
								.map(([key, value]) => `${key}=eq.${value}`)
								.join(',')
						: undefined,
				},
				callback
			)
			.subscribe();

		return {
			unsubscribe: () => subscription.unsubscribe(),
		};
	}

	// Protected utility methods

	/**
	 * Validate data against schema
	 */
	protected validateData(data: unknown): T {
		const result = this.schema.safeParse(data);
		if (!result.success) {
			throw new ValidationError(`Validation failed for ${this.entityName}`, result.error.issues);
		}
		return result.data;
	}

	/**
	 * Handle and transform errors
	 */
	protected handleError(operation: string, error: unknown): DatabaseError {
		if (error instanceof DatabaseError) {
			return error;
		}

		if (error instanceof Error) {
			return new DatabaseError(`Failed to ${operation} ${this.entityName}: ${error.message}`, error);
		}

		return new DatabaseError(`Failed to ${operation} ${this.entityName}: Unknown error`);
	}

	/**
	 * Build dynamic filters for complex queries
	 */
	protected buildFilters(query: any, filters: Record<string, any>) {
		Object.entries(filters).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				if (Array.isArray(value)) {
					query = query.in(key, value);
				} else if (typeof value === 'object' && 'min' in value && 'max' in value) {
					// Handle range filters
					query = query.gte(key, value.min).lte(key, value.max);
				} else if (typeof value === 'string' && key.endsWith('_search')) {
					// Handle text search
					const searchKey = key.replace('_search', '');
					query = query.ilike(searchKey, `%${value}%`);
				} else {
					query = query.eq(key, value);
				}
			}
		});
		return query;
	}
}
