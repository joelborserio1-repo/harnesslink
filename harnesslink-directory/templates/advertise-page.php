<?php
/**
 * Advertise / Marketing landing page.
 * Rendered by the [harnesslink_advertise] shortcode.
 *
 * Exposed vars (from the shortcode):
 *   $hld_contact_email  — direct enquiry email (also the lead notification recipient)
 *   $hld_phone          — direct enquiry phone (may be empty)
 *   $hld_hero_image     — optional hero background image URL
 */
if ( ! defined( 'ABSPATH' ) ) exit;

$contact_email = ! empty( $hld_contact_email ) ? $hld_contact_email : get_option( 'admin_email' );
$phone         = isset( $hld_phone ) ? $hld_phone : '';
$hero_image    = isset( $hld_hero_image ) ? trim( (string) $hld_hero_image ) : '';

/* When a hero photo is set, layer a navy scrim over it (keeps the headline legible)
   and override the default gradient background. */
$hero_style = '';
if ( $hero_image ) {
    $hero_style = " style=\"background-image:"
        . "linear-gradient(115deg,rgba(11,27,54,.93) 0%,rgba(11,27,54,.80) 42%,rgba(1,32,96,.55) 100%),"
        . "url('" . esc_url( $hero_image ) . "');"
        . "background-size:cover;background-position:center;\"";
}
?>
<div class="hl-advertise" id="hld-advertise">

  <!-- ══════════ HERO ══════════ -->
  <header class="adv-hero<?= $hero_image ? ' adv-hero--photo' : '' ?>"<?= $hero_style ?>>
    <div class="adv-wrap">
      <div class="adv-eyebrow">Australia's Leading Harness Racing Platform</div>
      <h1 class="adv-serif">Your audience is already here.</h1>
      <p class="adv-hero-sub">HarnessLink is the single digital platform dedicated exclusively to harness racing — reaching <b>539,000 impressions</b> every month across owners, trainers, drivers, breeders and enthusiasts worldwide.</p>

      <div class="adv-hero-cta">
        <a href="#hld-packages" class="adv-btn adv-btn--primary">View Packages</a>
        <a href="#hld-connect" class="adv-btn adv-btn--ghost">Get in Touch</a>
      </div>

      <div class="adv-statband">
        <div class="adv-stat"><div class="adv-stat-num">539,000</div><div class="adv-stat-label">Monthly Impressions</div></div>
        <div class="adv-stat"><div class="adv-stat-num">118,000</div><div class="adv-stat-label">Active Users</div></div>
        <div class="adv-stat"><div class="adv-stat-num">10.1M</div><div class="adv-stat-label">Total Backlinks</div></div>
        <div class="adv-stat"><div class="adv-stat-num">32</div><div class="adv-stat-label">Domain Authority</div></div>
      </div>
    </div>
  </header>

  <!-- ══════════ PULL QUOTE ══════════ -->
  <section class="adv-quote adv-section adv-section--tight">
    <div class="adv-wrap">
      <q class="adv-serif">A stallion that isn't listed is invisible to the people deciding where to send their mares.</q>
    </div>
  </section>

  <!-- ══════════ PLATFORM PERFORMANCE ══════════ -->
  <section class="adv-section">
    <div class="adv-wrap">
      <div class="adv-eyebrow">Platform Performance</div>
      <h2 class="adv-h2">The numbers behind the reach</h2>
      <hr class="adv-rule">

      <div class="adv-perf">
        <div>
          <h4>Audience</h4>
          <ul>
            <li><span class="adv-big">539,000</span> monthly impressions</li>
            <li><span class="adv-big">118,000</span> active users</li>
            <li><span class="adv-big">147,000</span> sessions</li>
            <li><span class="adv-big">97,000</span> direct returning users / month</li>
            <li><span class="adv-big">17,000+</span> Facebook followers globally</li>
          </ul>
        </div>
        <div>
          <h4>Growth vs Prior Period</h4>
          <ul>
            <li><span class="adv-up">↑ 39%</span> Impressions</li>
            <li><span class="adv-up">↑ 48.8%</span> Active users</li>
            <li><span class="adv-up">↑ 38.4%</span> Sessions</li>
            <li><span class="adv-up">↑ 50%</span> Referring domains, year on year</li>
          </ul>
        </div>
        <div>
          <h4>Authority</h4>
          <ul>
            <li><span class="adv-big">10.1M</span> total backlinks</li>
            <li><span class="adv-big">32</span> Domain Authority</li>
            <li><span class="adv-big">4,100+</span> referring domains</li>
            <li><span class="adv-big">19,700</span> organic keywords</li>
          </ul>
        </div>
      </div>

      <div class="adv-callout">
        <div>
          <div class="adv-callout-num adv-serif">22,040</div>
          <div class="adv-callout-lbl">In a single day</div>
        </div>
        <p>One editorial story drove <b>22,040 active users in a single day</b> — 826% above daily baseline.</p>
      </div>
    </div>
  </section>

  <!-- ══════════ QUICK-BUILD PACKAGES ══════════ -->
  <section class="adv-section adv-section--alt" id="hld-packages">
    <div class="adv-wrap">
      <div class="adv-head-center">
        <div class="adv-eyebrow">Advertising Options</div>
        <h2 class="adv-h2">Quick Build Packages</h2>
        <div class="adv-sub">Save time. Choose the package that works for you — per month.</div>
      </div>

      <div class="adv-pkgs">
        <!-- Premium -->
        <div class="adv-pkg">
          <div class="adv-pname">Premium</div>
          <div class="adv-price">$5,000<small> /mo</small></div>
          <div class="adv-valued">Valued at $9,500</div>
          <hr>
          <ul>
            <li>Article, Leaderboard, Sidebar &amp; Mobile Banners</li>
            <li>EDM Sponsored Article + Leaderboard Banner</li>
            <li>Branded &amp; Partner Supplied Articles</li>
            <li>FB &amp; X Advertising</li>
            <li>Instagram Takeover</li>
          </ul>
          <div class="adv-bestfor"><b>Best for</b>Full market visibility and brand positioning.</div>
          <button type="button" class="adv-btn adv-btn--royal adv-pkg-btn adv-choose" data-package="Premium — $5,000/mo">Choose Premium</button>
        </div>

        <!-- Growth -->
        <div class="adv-pkg adv-pkg--dark">
          <div class="adv-ribbon">Most Popular</div>
          <div class="adv-pname">Growth</div>
          <div class="adv-price">$3,000<small> /mo</small></div>
          <div class="adv-valued">Valued at $4,950</div>
          <hr>
          <ul>
            <li>Leaderboard, Sidebar &amp; Mobile Banners</li>
            <li>EDM Leaderboard Banner</li>
            <li>Branded &amp; Partner Supplied Articles</li>
            <li>FB &amp; X Advertising</li>
          </ul>
          <div class="adv-bestfor"><b>Best for</b>Consistent multi-channel exposure.</div>
          <button type="button" class="adv-btn adv-btn--primary adv-pkg-btn adv-choose" data-package="Growth — $3,000/mo">Choose Growth</button>
        </div>

        <!-- Starter -->
        <div class="adv-pkg">
          <div class="adv-pname">Starter</div>
          <div class="adv-price">$1,500<small> /mo</small></div>
          <div class="adv-valued">Valued at $2,700</div>
          <hr>
          <ul>
            <li>Sidebar &amp; Mobile Banners</li>
            <li>Partner Supplied Articles</li>
            <li>FB &amp; X Advertising / Articles</li>
          </ul>
          <div class="adv-bestfor"><b>Best for</b>Getting started with meaningful visibility.</div>
          <button type="button" class="adv-btn adv-btn--royal adv-pkg-btn adv-choose" data-package="Starter — $1,500/mo">Choose Starter</button>
        </div>
      </div>
    </div>
  </section>

  <!-- ══════════ DIFFERENTIATOR: AUTO-LINK ══════════ -->
  <section class="adv-section">
    <div class="adv-wrap">
      <div class="adv-eyebrow">The Differentiator</div>
      <h2 class="adv-h2">The Progeny &amp; Stud <span class="adv-tint">Auto-Link</span></h2>
      <hr class="adv-rule">

      <div class="adv-diff">
        <div>
          <p class="adv-lead">Every race result, news story and breeding update that names a stallion's offspring automatically links to that stallion's directory page.</p>
          <p>It happens on publication — no action required from the stud, ever. If a sire's progeny wins at Menangle and HarnessLink covers the result, every reference to his sire links straight to that sire's directory page. Automatically. The links keep working for as long as the progeny keep racing.</p>
        </div>
        <div class="adv-flow">
          <div class="adv-flowstep"><div class="adv-n adv-serif">1</div><div><b>Progeny Races</b><span>A son or daughter wins, places, or makes news.</span></div></div>
          <div class="adv-flowstep"><div class="adv-n adv-serif">2</div><div><b>HarnessLink Publishes</b><span>The result, story, or breeding update goes live.</span></div></div>
          <div class="adv-flowstep"><div class="adv-n adv-serif">3</div><div><b>Sire Auto-Links</b><span>Every mention links to the stud's directory page.</span></div></div>
        </div>
      </div>

      <div class="adv-equation">
        <div class="adv-eq adv-serif">30 mentions <em>=</em> 30 referrals</div>
        <div class="adv-cap">Every mention becomes a live, permanent inbound referral — automatically, on publication.</div>
      </div>
    </div>
  </section>

  <!-- ══════════ DIRECTORY TIERS ══════════ -->
  <section class="adv-section adv-section--alt">
    <div class="adv-wrap">
      <div class="adv-eyebrow">Two Ways to List</div>
      <h2 class="adv-h2">Directory Tiers</h2>
      <hr class="adv-rule">

      <div class="adv-tiers">
        <div class="adv-tier adv-tier--std">
          <div class="adv-tname">Standard Listing</div>
          <div class="adv-from">From $450<small> / year</small></div>
          <table>
            <tr><td>1–3 stallions</td><td>$550 / yr</td></tr>
            <tr><td>4–7 stallions</td><td>$500 / yr</td></tr>
            <tr><td>8+ stallions</td><td>$450 / yr</td></tr>
          </table>
          <div class="adv-inc"><b>Includes:</b> Directory listing · Full contact details visible · Profile page · 539,000 monthly impressions.</div>
          <div class="adv-foot-note">CPM equivalent <b>$0.09</b> vs industry standard $10–25.</div>
          <button type="button" class="adv-btn adv-btn--royal adv-tier-btn adv-choose" data-package="Standard Listing — from $450/yr">Choose Standard</button>
        </div>

        <div class="adv-tier adv-tier--partner">
          <div class="adv-ribbon">Most Popular</div>
          <div class="adv-tname">Partnering Stud</div>
          <div class="adv-from">From $2,000<small> / year</small></div>
          <table>
            <tr><td>1–3 stallions</td><td>$2,000 / yr</td></tr>
            <tr><td>4–7 stallions</td><td>$3,000 / yr</td></tr>
            <tr><td>8+ stallions</td><td>$4,000 / yr</td></tr>
          </table>
          <div class="adv-plus-head">Everything in Standard, plus:</div>
          <ul>
            <li>Branded banner at top of directory</li>
            <li>Premium stallion table, placed above all standard listings</li>
            <li>Progeny &amp; stud auto-linking across all HarnessLink editorial</li>
            <li>One dedicated feature article per stallion — SEO-optimised, permanently live</li>
            <li><b>5 regional slots globally</b> — AU/NZ · US/CA · Europe. Geo-tagged. Once filled, closed.</li>
          </ul>
          <button type="button" class="adv-btn adv-btn--primary adv-tier-btn adv-choose" data-package="Partnering Stud — from $2,000/yr">Choose Partnering Stud</button>
        </div>
      </div>
    </div>
  </section>

  <!-- ══════════ CONNECT: CONTACT FORM ══════════ -->
  <section class="adv-section adv-connect" id="hld-connect">
    <div class="adv-wrap">
      <div class="adv-eyebrow">Let's Get Started</div>
      <h2 class="adv-h2">Get in touch</h2>
      <p class="adv-connect-intro">Tell us a little about you and which package(s) you're interested in. We'll be in touch — usually within one business day.</p>

      <div class="adv-connect-panels">

        <div class="adv-formcard">
          <form id="adv-form" novalidate>
            <input type="hidden" name="source" value="advertise">

            <div class="adv-form-grid">
              <div class="adv-field">
                <label for="adv-name">Full Name <span class="req">*</span></label>
                <input type="text" id="adv-name" name="contact_name" placeholder="e.g. Alan Galloway" autocomplete="name">
              </div>
              <div class="adv-field">
                <label for="adv-business">Business <span class="req">*</span></label>
                <input type="text" id="adv-business" name="stud_name" placeholder="e.g. Alabar Bloodstock" autocomplete="organization">
              </div>
              <div class="adv-field">
                <label for="adv-phone">Phone <span class="req">*</span></label>
                <input type="tel" id="adv-phone" name="contact_phone" placeholder="+61 3 5555 1234" autocomplete="tel">
              </div>
              <div class="adv-field">
                <label for="adv-email">Email <span class="req">*</span></label>
                <input type="email" id="adv-email" name="contact_email" placeholder="you@yourbusiness.com" autocomplete="email">
              </div>

              <div class="adv-field adv-field--full">
                <label>Package(s) interested in <span class="req">*</span></label>
                <div class="adv-pkg-choices" id="adv-packages">
                  <label class="adv-check"><input type="checkbox" name="packages[]" value="Premium — $5,000/mo"><span>Premium — $5,000/mo</span></label>
                  <label class="adv-check"><input type="checkbox" name="packages[]" value="Growth — $3,000/mo"><span>Growth — $3,000/mo</span></label>
                  <label class="adv-check"><input type="checkbox" name="packages[]" value="Starter — $1,500/mo"><span>Starter — $1,500/mo</span></label>
                  <label class="adv-check"><input type="checkbox" name="packages[]" value="Standard Listing — from $450/yr"><span>Standard Listing — from $450/yr</span></label>
                  <label class="adv-check"><input type="checkbox" name="packages[]" value="Partnering Stud — from $2,000/yr"><span>Partnering Stud — from $2,000/yr</span></label>
                  <label class="adv-check"><input type="checkbox" name="packages[]" value="Not sure yet — happy to discuss"><span>Not sure yet — happy to discuss</span></label>
                </div>
              </div>

              <!-- honeypot: must stay empty -->
              <div class="adv-hp" aria-hidden="true">
                <label for="adv-website">Website</label>
                <input type="text" id="adv-website" name="hld_website" tabindex="-1" autocomplete="off">
              </div>
            </div>

            <div class="adv-form-error" id="adv-form-error"></div>

            <div class="adv-form-foot">
              <button type="submit" class="adv-btn adv-btn--primary" id="adv-submit">Send Enquiry</button>
              <span style="font-size:13px;color:#6f7682;">We'll reply within one business day.</span>
            </div>
          </form>

          <div class="adv-form-success" id="adv-form-success">
            <div class="adv-tick">✓</div>
            <h3>Enquiry received!</h3>
            <p>Thanks for reaching out. A member of the HarnessLink team will be in touch shortly to get you set up.</p>
          </div>
        </div>

      </div>

      <div class="adv-direct">
        <span>Prefer email? <a href="mailto:<?= antispambot( $contact_email ) ?>"><?= antispambot( $contact_email ) ?></a></span>
        <?php if ( $phone ): ?><span>Call us: <a href="tel:<?= esc_attr( preg_replace( '/[^0-9+]/', '', $phone ) ) ?>"><?= esc_html( $phone ) ?></a></span><?php endif; ?>
        <span>harnesslink.com</span>
      </div>
    </div>
  </section>

</div>
