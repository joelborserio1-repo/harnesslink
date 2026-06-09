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
		prefillEmail();
		return true;
	}

	// Post-signup "complete your profile" prompt (name / mobile / opt-in).
	function initProfilePrompt() {
		var prompt = document.getElementById('hlpw-profile-prompt');
		if (!prompt || prompt.dataset.hlpwInit) {
			return;
		}
		prompt.dataset.hlpwInit = '1';

		var laterFlag = false;
		try {
			laterFlag = !!sessionStorage.getItem('hlpw_pp_later');
		} catch (e) {}
		if (laterFlag) {
			prompt.style.display = 'none';
			return;
		}

		var form = prompt.querySelector('#hlpw-profile-form');
		var msg = prompt.querySelector('.hlpw-pp-msg');

		function dismiss() {
			try {
				sessionStorage.setItem('hlpw_pp_later', '1');
			} catch (e) {}
			prompt.style.display = 'none';
		}

		prompt.querySelectorAll('.hlpw-pp-close, .hlpw-pp-skip').forEach(function (b) {
			b.addEventListener('click', dismiss);
		});

		form.addEventListener('submit', function (e) {
			e.preventDefault();
			var cfg = window.HLPW || {};
			var data = new URLSearchParams(new FormData(form));
			data.append('action', 'hlpw_save_profile');
			data.append('nonce', cfg.nonce || '');

			var saveBtn = form.querySelector('.hlpw-pp-save');
			if (saveBtn) {
				saveBtn.disabled = true;
			}

			fetch(cfg.ajaxUrl || '/wp-admin/admin-ajax.php', {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: data.toString()
			})
				.then(function (r) { return r.json(); })
				.then(function (res) {
					if (res && res.success) {
						if (msg) {
							msg.textContent = (res.data && res.data.message) || 'Saved!';
						}
						setTimeout(function () { prompt.style.display = 'none'; }, 1300);
					} else {
						if (msg) {
							msg.textContent = (res && res.data && res.data.message) || 'Something went wrong.';
						}
						if (saveBtn) { saveBtn.disabled = false; }
					}
				})
				.catch(function () {
					if (msg) { msg.textContent = 'Something went wrong.'; }
					if (saveBtn) { saveBtn.disabled = false; }
				});
		});
	}

	document.addEventListener('keydown', function (e) {
		if ((e.key === 'Escape' || e.key === 'Esc') && wallIsVisible()) {
			closeWall();
		}
	});

	document.addEventListener('DOMContentLoaded', function () {
		enhance();
		initProfilePrompt();

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
