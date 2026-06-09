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

	// Reassurance line shown under the button (addresses "will this cost me?").
	var REASSURE_TEXT = 'No payment · No credit card · Sign up in 10 seconds';

	var EMAIL_KEY = 'hlpw_email';
	var dismissed = false;

	function getStoredEmail() {
		try {
			return localStorage.getItem(EMAIL_KEY) || '';
		} catch (e) {
			return '';
		}
	}

	function storeEmail(value) {
		try {
			if (value && value.indexOf('@') > 0) {
				localStorage.setItem(EMAIL_KEY, value);
			}
		} catch (e) {}
	}

	// Pre-fill the wall's email box for returning visitors so they land
	// straight on the "Welcome back" password step without retyping.
	function prefillEmail() {
		var stored = getStoredEmail();
		if (!stored) {
			return;
		}
		var input = document.querySelector('#lplb-portal form[data-step="email"] input[name="email"]');
		if (input && !input.value) {
			input.value = stored;
		}
	}

	// Remember the email as they type it.
	document.addEventListener('input', function (e) {
		var t = e.target;
		if (t && t.name === 'email' && t.closest && t.closest('#lplb-portal')) {
			storeEmail(t.value.trim());
		}
	});

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

	// Move the First/Last/Mobile rows above the password field for a natural
	// signup order (LP renders our hook fields after the password).
	function reorderSignupFields() {
		var form = document.querySelector('form[data-step="signup"]');
		if (!form) {
			return;
		}
		var pwField = form.querySelector('.Slider__PasswordField');
		var pwRow = pwField ? pwField.closest('.Slider__InputRow') : null;
		if (!pwRow) {
			return;
		}
		form.querySelectorAll('.hlpw-field').forEach(function (row) {
			if (row.dataset.hlpwMoved) {
				return;
			}
			pwRow.parentNode.insertBefore(row, pwRow);
			row.dataset.hlpwMoved = '1';
		});
	}

	// Reassurance microcopy under the free signup button (subscribe panel only,
	// never the paid upgrade panel).
	function injectReassurance() {
		var panel = document.getElementById('lplb-subscribe-panel');
		if (!panel || panel.querySelector('.hlpw-free-reassure')) {
			return;
		}
		var btn = panel.querySelector('.Slider__ExpandedButton');
		if (!btn) {
			return;
		}
		var el = document.createElement('div');
		el.className = 'hlpw-free-reassure';
		el.textContent = REASSURE_TEXT;
		btn.insertAdjacentElement('afterend', el);
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
		injectReassurance();
		reorderSignupFields();
		prefillEmail();
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
