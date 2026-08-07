<?php
/**
 * HLN_Cron_Utils — shared WP-Cron interval helpers.
 *
 * Every polling channel (race-data adapters in Phase 2; RSS and the
 * verified-X poller in Phase 3) needs to turn a per-source
 * check_frequency string like "30m" or "6h" into a registered WP-Cron
 * schedule. Centralised here once a second channel needed the same
 * logic, rather than duplicating it per class.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Cron_Utils {

	const DEFAULT_FREQUENCY = '1h';

	/**
	 * @param  string $freq e.g. "15m", "30m", "1h", "6h"
	 * @return int Seconds.
	 */
	public static function seconds_for_frequency( $freq ) {
		if ( preg_match( '/^(\d+)([mh])$/', trim( (string) $freq ), $m ) ) {
			$value = (int) $m[1];
			return 'h' === $m[2] ? $value * HOUR_IN_SECONDS : $value * MINUTE_IN_SECONDS;
		}
		return HOUR_IN_SECONDS;
	}

	/**
	 * @param  string $freq
	 * @return string WP-Cron schedule key, e.g. "hln_every_1800s".
	 */
	public static function schedule_key_for_frequency( $freq ) {
		return 'hln_every_' . self::seconds_for_frequency( $freq ) . 's';
	}

	/**
	 * Register a custom cron interval for the given frequency if it
	 * isn't already a known schedule. Intended to be called from a
	 * 'cron_schedules' filter callback.
	 *
	 * @param  array  $schedules
	 * @param  string $freq
	 * @return array
	 */
	public static function register_interval( array $schedules, $freq ) {
		$seconds = self::seconds_for_frequency( $freq );
		$key     = 'hln_every_' . $seconds . 's';
		if ( ! isset( $schedules[ $key ] ) ) {
			$schedules[ $key ] = [
				'interval' => $seconds,
				'display'  => sprintf( __( 'Every %d seconds (HarnessLink Newsroom)', 'hl-newsroom' ), $seconds ),
			];
		}
		return $schedules;
	}
}
