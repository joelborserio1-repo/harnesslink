/**
 * HarnessLink PayWall — front-end enhancements for the List Builder wall.
 *
 * 1. Adds a close (X) button + Esc-to-close so the wall is dismissible
 *    (accessibility / "escapable modal"). Dismissal is per pageview: the
 *    wall still appears on the next gated article. Because the article is
 *    gated server-side, closing only hides the overlay — it does NOT
 *    unlock content.
 * 2. Injects a bold, capitalised "FREE" badge so it's unmistakable that
 *    signing up costs nothing.
 *
 * Pure DOM enhancement — no Leaky Paywall core files are touched.
 */
(function () {
	'use strict';

	// ----------------------------------------------------------------
	// EDIT THIS COPY — the bold/caps "it's free" badge shown on the card.
	// ----------------------------------------------------------------
	var FREE_BADGE_TEXT = '100% FREE — NO PAYMENT REQUIRED';

	var dismissed = false;

	function wallIsVisible() {
		var portal = document.getElementById('lplb-portal');
		return portal && portal.classList.contains('is-visible');
	}

	function closeWall() {
		dismissed = true;
		document.body.classList.add('hlpw-wall-dismissed');
		['lplb-mask', 'lplb-portal'].forEach(function (id) {
			var el = document.getElementById(id);
			if (el) {
				el.classList.remove('is-visible', 'is-active');
			}
		});
	}

	function injectCloseButton(portal) {
		if (portal.querySelector('.hlpw-wall-close')) {
			return;
		}
		var btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'hlpw-wall-close';
		btn.setAttribute('aria-label', 'Close');
		btn.innerHTML = '&times;';
		btn.addEventListener('click', closeWall);
		portal.appendChild(btn);
	}

	function injectFreeBadge() {
		var panel = document.getElementById('lplb-subscribe-panel');
		if (!panel || panel.querySelector('.hlpw-free-badge')) {
			return;
		}
		var badge = document.createElement('div');
		badge.className = 'hlpw-free-badge';
		badge.textContent = FREE_BADGE_TEXT;
		panel.insertBefore(badge, panel.firstChild);
	}

	function enhance() {
		if (dismissed) {
			return false;
		}
		var portal = document.getElementById('lplb-portal');
		if (!portal) {
			return false;
		}
		injectCloseButton(portal);
		injectFreeBadge();
		return true;
	}

	document.addEventListener('keydown', function (e) {
		if ((e.key === 'Escape' || e.key === 'Esc') && wallIsVisible()) {
			closeWall();
		}
	});

	document.addEventListener('DOMContentLoaded', function () {
		enhance();

		// The overlay markup is usually present at load, but guard against it
		// (or its panel) being injected/replaced later.
		var mo = new MutationObserver(function () {
			enhance();
		});
		mo.observe(document.body, { childList: true, subtree: true });
	});

	// Re-enhance if Leaky Paywall fires its own "shown" event.
	document.addEventListener('leaky_paywall_shown', enhance);
})();
