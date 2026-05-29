<?php
/**
 * Front-end category navigation.
 *
 * Expected in scope:
 *   $hld_active_type — slug of the currently active directory type
 *   $hld_nav_counts  — array( slug => listing count )
 */
if ( ! defined( 'ABSPATH' ) ) exit;

$nav_types = HLD_Types::get_all( true );
if ( empty( $nav_types ) ) return;

$counts = isset( $hld_nav_counts ) && is_array( $hld_nav_counts ) ? $hld_nav_counts : HLD_DB::counts_by_type();
$active = isset( $hld_active_type ) ? $hld_active_type : HLD_Types::default_slug();
?>
<nav class="hld-cat-nav" aria-label="Directory categories">
  <div class="hld-cat-nav__scroll">
    <?php foreach ( $nav_types as $nav_slug => $nav_type ):
      $count    = isset( $counts[ $nav_slug ] ) ? (int) $counts[ $nav_slug ] : 0;
      $is_active= ( $nav_slug === $active );
      $is_soon  = ( $count === 0 );
      $url      = hld_directory_url( $nav_slug );
    ?>
      <a href="<?= esc_url( $url ) ?>"
         class="hld-cat-chip<?= $is_active ? ' hld-cat-chip--active' : '' ?><?= $is_soon ? ' hld-cat-chip--soon' : '' ?>"
         data-type="<?= esc_attr( $nav_slug ) ?>"
         <?= $is_active ? 'aria-current="page"' : '' ?>>
        <span class="hld-cat-chip__icon"><?= esc_html( $nav_type['icon'] ) ?></span>
        <span class="hld-cat-chip__label"><?= wp_kses( $nav_type['plural'], array() ) ?></span>
        <?php if ( $is_soon ): ?>
          <span class="hld-cat-chip__badge">Soon</span>
        <?php else: ?>
          <span class="hld-cat-chip__count"><?= esc_html( $count ) ?></span>
        <?php endif; ?>
      </a>
    <?php endforeach; ?>
  </div>
</nav>
