#!/usr/bin/env python3
"""
RavenLens SQLite to PostgreSQL Migration Script

Migrates data from local SQLite database to production PostgreSQL.

Usage:
    python migrate_sqlite_to_postgres.py --sqlite ./ravenlens.db --postgres postgresql://user:pass@host:5432/dbname
"""

import argparse
import sqlite3
import sys
from urllib.parse import urlparse

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("Error: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)


def get_sqlite_tables(sqlite_conn):
    """Get all user tables from SQLite database."""
    cursor = sqlite_conn.cursor()
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table'
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    """)
    return [row[0] for row in cursor.fetchall()]


def get_table_columns(sqlite_conn, table_name):
    """Get column names for a table."""
    cursor = sqlite_conn.cursor()
    cursor.execute(f"PRAGMA table_info({table_name})")
    return [row[1] for row in cursor.fetchall()]


def migrate_table(sqlite_conn, pg_conn, table_name, columns):
    """Migrate a single table from SQLite to PostgreSQL."""
    sqlite_cursor = sqlite_conn.cursor()
    pg_cursor = pg_conn.cursor()

    # Fetch all rows from SQLite
    sqlite_cursor.execute(f"SELECT * FROM {table_name}")
    rows = sqlite_cursor.fetchall()

    if not rows:
        print(f"  Table '{table_name}': 0 rows (empty)")
        return 0, 0

    # Build the INSERT statement with ON CONFLICT DO NOTHING
    columns_str = ", ".join(columns)
    placeholders = ", ".join(["%s"] * len(columns))

    insert_sql = f"""
        INSERT INTO {table_name} ({columns_str})
        VALUES ({placeholders})
        ON CONFLICT DO NOTHING
    """

    success_count = 0
    error_count = 0

    for row in rows:
        try:
            pg_cursor.execute(insert_sql, row)
            if pg_cursor.rowcount > 0:
                success_count += 1
        except Exception as e:
            error_count += 1
            print(f"  Warning: Failed to insert row in '{table_name}': {str(e)[:100]}")
            pg_conn.rollback()
            continue

    pg_conn.commit()
    return success_count, error_count


def main():
    parser = argparse.ArgumentParser(
        description="Migrate RavenLens data from SQLite to PostgreSQL"
    )
    parser.add_argument(
        "--sqlite",
        required=True,
        help="Path to SQLite database file (e.g., ./ravenlens.db)"
    )
    parser.add_argument(
        "--postgres",
        required=True,
        help="PostgreSQL connection URL (e.g., postgresql://user:pass@host:5432/dbname)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be migrated without making changes"
    )

    args = parser.parse_args()

    print("=" * 50)
    print("RavenLens SQLite to PostgreSQL Migration")
    print("=" * 50)
    print()

    # Connect to SQLite
    print(f"Connecting to SQLite: {args.sqlite}")
    try:
        sqlite_conn = sqlite3.connect(args.sqlite)
    except Exception as e:
        print(f"Error connecting to SQLite: {e}")
        sys.exit(1)

    # Connect to PostgreSQL
    print(f"Connecting to PostgreSQL...")
    try:
        pg_conn = psycopg2.connect(args.postgres)
    except Exception as e:
        print(f"Error connecting to PostgreSQL: {e}")
        sys.exit(1)

    print("Connected successfully!")
    print()

    # Get tables
    tables = get_sqlite_tables(sqlite_conn)
    print(f"Found {len(tables)} tables to migrate: {', '.join(tables)}")
    print()

    if args.dry_run:
        print("DRY RUN MODE - No changes will be made")
        print()
        for table in tables:
            columns = get_table_columns(sqlite_conn, table)
            cursor = sqlite_conn.cursor()
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"  {table}: {count} rows, columns: {columns}")
        print()
        print("Run without --dry-run to perform actual migration")
        return

    # Migrate each table
    total_success = 0
    total_errors = 0

    print("Starting migration...")
    print("-" * 50)

    for table in tables:
        columns = get_table_columns(sqlite_conn, table)
        print(f"\nMigrating table: {table}")

        try:
            success, errors = migrate_table(sqlite_conn, pg_conn, table, columns)
            total_success += success
            total_errors += errors
            print(f"  Migrated: {success} rows, Errors: {errors}")
        except Exception as e:
            print(f"  Error migrating table '{table}': {e}")
            total_errors += 1

    # Close connections
    sqlite_conn.close()
    pg_conn.close()

    # Summary
    print()
    print("=" * 50)
    print("MIGRATION COMPLETE")
    print("=" * 50)
    print(f"  Tables processed: {len(tables)}")
    print(f"  Rows migrated:    {total_success}")
    print(f"  Errors:           {total_errors}")
    print()

    if total_errors > 0:
        print("Some rows failed to migrate. Check the warnings above.")
        print("Common causes: duplicate primary keys, constraint violations")
    else:
        print("All data migrated successfully!")


if __name__ == "__main__":
    main()
