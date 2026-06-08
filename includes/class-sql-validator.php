<?php
/**
 * SQL Injection Protection & Validation
 *
 * Implements a strict whitelist-based SQL validator. Only SELECT queries
 * against known WooCommerce tables are allowed. All DML/DDL statements
 * are rejected outright.
 *
 * @package SILC_WooInsight_AI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * SQL Validator class.
 */
class SILC_WIA_SQL_Validator {

	/**
	 * Known safe SQL functions/expressions allowed in queries.
	 */
	private const ALLOWED_FUNCTIONS = array(
		'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'IFNULL', 'NULLIF',
		'CONCAT', 'CONCAT_WS', 'GROUP_CONCAT',
		'DATE', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND',
		'DATE_FORMAT', 'DATE_ADD', 'DATE_SUB', 'DATEDIFF',
		'UNIX_TIMESTAMP', 'FROM_UNIXTIME',
		'STR_TO_DATE', 'CAST', 'CONVERT',
		'ROUND', 'FLOOR', 'CEIL', 'ABS',
		'LOWER', 'UPPER', 'TRIM', 'SUBSTRING',
		'IF', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
		'EXISTS', 'IN', 'BETWEEN', 'LIKE', 'NOT',
		'IS', 'NULL',
		'ASC', 'DESC',
		'DISTINCT',
	);

	/**
	 * Statement types that are BLOCKED.
	 */
	private const FORBIDDEN_KEYWORDS = array(
		'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
		'TRUNCATE', 'REPLACE', 'LOAD', 'INTO OUTFILE', 'INTO DUMPFILE',
		'EXEC', 'EXECUTE', 'CALL', 'SHOW', 'DESCRIBE', 'EXPLAIN',
		'GRANT', 'REVOKE', 'FLUSH', 'KILL', 'SET', 'LOCK', 'UNLOCK',
		'RENAME', 'USE',
		'INFORMATION_SCHEMA', 'MYSQL', 'PG_SLEEP', 'SLEEP',
		'BENCHMARK', 'WAITFOR', 'DELAY',
		'\\/\\*', '\\*\\/', '--', '#',
		'CHAR(', 'UNICODE(', 'NCHAR(',
	);

	/**
	 * Validate and sanitize a generated SQL query.
	 *
	 * @param string $sql The raw SQL query to validate.
	 * @return array{valid: bool, sql: string, error: string}
	 */
	public static function validate( string $sql ): array {
		$result = array(
			'valid' => false,
			'sql'   => $sql,
			'error' => '',
		);

		// Trim whitespace.
		$sql = trim( $sql );

		if ( empty( $sql ) ) {
			$result['error'] = __( 'Empty SQL query.', 'silc-wooinsight-ai' );
			return $result;
		}

		// Strip surrounding backticks if any.
		$sql = trim( $sql, '`' );

		// Normalize for checking.
		$upper = strtoupper( $sql );

		// 1. Must start with SELECT.
		if ( ! preg_match( '/^\s*SELECT\b/i', $sql ) ) {
			$result['error'] = __( 'Only SELECT queries are allowed.', 'silc-wooinsight-ai' );
			return $result;
		}
		// 2. Block forbidden keywords.
		foreach ( self::FORBIDDEN_KEYWORDS as $keyword ) {
			// Use word-boundary matching for SQL keywords to avoid false
			// positives with column/table names (e.g., date_created vs CREATE).
			// Comment/function-call patterns (--, #, CHAR(, etc.) use strpos.
			$found = false;
			if ( preg_match( '/^\w/', $keyword ) && preg_match( '/\w$/', $keyword ) ) {
				$found = (bool) preg_match( '/\b' . preg_quote( $keyword, '/' ) . '\b/', $upper );
			} else {
				$found = ( false !== strpos( $upper, $keyword ) );
			}
			if ( $found ) {
				$result['error'] = sprintf(
					/* translators: %s: forbidden keyword */
					__( 'Query contains forbidden keyword: %s', 'silc-wooinsight-ai' ),
					$keyword
				);
				return $result;
			}
		}
		// 3. Normalize: strip trailing semicolons first (they are not multi-statement).
		$sql = rtrim( $sql, "; \t\n\r\0\x0B" );

		// Then check for internal semicolons that would indicate multi-statement.
		// Strip both single and double-quoted string literals to avoid false positives.
		$stripped = preg_replace( "/'[^']*'/", '', $sql );
		$stripped = preg_replace( '/"[^"]*"/', '', $stripped );
		if ( substr_count( $stripped, ';' ) > 0 ) {
			$result['error'] = __( 'Multi-statement queries are not allowed.', 'silc-wooinsight-ai' );
			return $result;
		}

		// 4. Validate that all referenced tables are in the whitelist.
		$table_check = self::check_tables( $sql );
		if ( ! $table_check['valid'] ) {
			$result['error'] = $table_check['error'];
			return $result;
		}

		// 5. Check for suspicious patterns (hex, eval, etc.).
		if ( self::has_suspicious_patterns( $sql ) ) {
			$result['error'] = __( 'Query contains suspicious patterns.', 'silc-wooinsight-ai' );
			return $result;
		}

		// Normalize the SQL for execution.
		$sql = self::normalize( $sql );

		$result['valid'] = true;
		$result['sql']   = $sql;
		return $result;
	}

	/**
	 * Check that all table references are whitelisted.
	 *
	 * @param string $sql The SQL query.
	 * @return array{valid: bool, error: string}
	 */
	private static function check_tables( string $sql ): array {
		global $wpdb;
		$prefix  = $wpdb->prefix;
		$allowed = SILC_WIA_Woo_Schema::get_table_names();

		// Build full prefixed whitelist.
		$whitelist = array( $prefix . 'woocommerce_order_items', $prefix . 'woocommerce_order_itemmeta' );
		foreach ( $allowed as $table ) {
			$whitelist[] = $prefix . $table;
		}

		// Strip string literals to avoid false positives.
		$stripped = preg_replace( "/'[^']*'/", "''", $sql );

		// Find all table references: FROM table, JOIN table, UPDATE table, INTO table.
		preg_match_all(
			'/(?:FROM|JOIN|INTO|TABLE|UPDATE|INSERT\s+INTO)\s+`?(\w+)`?\s*/i',
			$stripped,
			$matches
		);

		$tables_found = array();
		if ( ! empty( $matches[1] ) ) {
			foreach ( $matches[1] as $tbl ) {
				$tbl = trim( $tbl, '`' );
				$tables_found[] = $tbl;
			}
		}

		// Also check implicit cross joins: FROM table1, table2.
		preg_match_all(
			'/FROM\s+`?(\w+)`?(?:\s*,\s*`?(\w+)`?)*/i',
			$stripped,
			$from_matches
		);

		if ( ! empty( $from_matches[1] ) ) {
			foreach ( $from_matches[1] as $tbl ) {
				$tables_found[] = $tbl;
			}
		}

		if ( ! empty( $from_matches[2] ) ) {
			foreach ( $from_matches[2] as $tbl ) {
				if ( ! empty( $tbl ) ) {
					$tables_found[] = $tbl;
				}
			}
		}

		// Remove duplicates.
		$tables_found = array_unique( $tables_found );

		foreach ( $tables_found as $tbl ) {
			$matched = false;
			foreach ( $whitelist as $allowed_tbl ) {
				// Allow if exact match or if user used alias that maps to real table via JOIN.
				if ( $tbl === $allowed_tbl ) {
					$matched = true;
					break;
				}
			}

			if ( ! $matched ) {
				// Allow WordPress core tables that might be needed.
				if ( in_array( $tbl, array( $prefix . 'posts', $prefix . 'postmeta', $prefix . 'users', $prefix . 'usermeta', $prefix . 'terms', $prefix . 'term_taxonomy', $prefix . 'term_relationships', $prefix . 'termmeta', $prefix . 'comments' ), true ) ) {
					$matched = true;
				}

				// Allow aliases that are single letters (a, b, p, pm, o, etc.).
				if ( preg_match( '/^[a-z]{1,4}$/i', $tbl ) ) {
					$matched = true;
				}
			}

			if ( ! $matched ) {
				return array(
					'valid' => false,
					'error' => sprintf(
						/* translators: %s: table name */
						__( 'Unauthorized table reference: %s', 'silc-wooinsight-ai' ),
						$tbl
					),
				);
			}
		}

		return array( 'valid' => true, 'error' => '' );
	}

	/**
	 * Check for suspicious patterns that indicate SQL injection.
	 *
	 * @param string $sql The SQL query.
	 * @return bool True if suspicious.
	 */
	private static function has_suspicious_patterns( string $sql ): bool {
		$patterns = array(
			'/0x[0-9a-fA-F]+/',                        // Hex literals.
			'/\\\\x[0-9a-fA-F]{2}/',                   // Escaped hex.
			'/CONVERT\s*\(/i',                          // Convert (can be used for injection).
			'/0[eE]\s*[0-9]+/',                         // Scientific notation hacks.
			'/\/\*.*\*\//',                             // Block comments.
		);

		foreach ( $patterns as $pattern ) {
			if ( preg_match( $pattern, $sql ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Normalize SQL for safe execution via wpdb.
	 *
	 * @param string $sql Raw SQL.
	 * @return string Normalized SQL.
	 */
	private static function normalize( string $sql ): string {
		global $wpdb;

		// Remove trailing semicolon.
		$sql = rtrim( $sql, "; \t\n\r\0\x0B" );

		// Ensure table prefix is used. The AI prompt includes prefix, but just in case.
		$prefix = $wpdb->prefix;
		if ( ! preg_match( '/\b' . preg_quote( $prefix, '/' ) . '/', $sql ) ) {
			// Try to add prefix to un-prefixed WooCommerce table names.
			$tables = SILC_WIA_Woo_Schema::get_table_names();
			foreach ( $tables as $table ) {
				$sql = preg_replace(
					'/\b' . preg_quote( $table, '/' ) . '\b(?!\s*\.)/',
					$prefix . $table,
					$sql
				);
			}
		}

		return $sql;
	}

	/**
	 * Execute a validated SQL query safely.
	 *
	 * @param string $sql The validated SQL query.
	 * @return array{success: bool, data: array|null, error: string, time_ms: float}
	 */
	public static function execute( string $sql ): array {
		global $wpdb;

		$start    = microtime( true );
		$results  = $wpdb->get_results( $sql, ARRAY_A );
		$time_ms  = ( microtime( true ) - $start ) * 1000;

		if ( $wpdb->last_error ) {
			return array(
				'success' => false,
				'data'    => null,
				'error'   => $wpdb->last_error,
				'time_ms' => round( $time_ms, 2 ),
			);
		}

		// Limit result size for display.
		$max_rows = 200;
		if ( count( $results ) > $max_rows ) {
			$results = array_slice( $results, 0, $max_rows );
		}

		return array(
			'success' => true,
			'data'    => $results,
			'error'   => '',
			'time_ms' => round( $time_ms, 2 ),
			'rows'    => count( $results ),
		);
	}
}
