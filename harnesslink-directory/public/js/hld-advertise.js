/* HarnessLink — Advertise landing page JS
   - package selection → contact form
   - Choose a Package / Book a Meeting toggle
   - enquiry submit (reuses the hld_submit_enquiry AJAX endpoint)
   - lazy-loads the Calendly widget script only when needed
*/
(function ($) {
  'use strict';

  var $root = $('#hld-advertise');
  if (!$root.length) return;

  var ajax  = (window.HLD && HLD.ajax_url) || '';
  var nonce = (window.HLD && HLD.nonce) || '';

  /* ── Mode toggle: package form ↔ meeting calendar ── */
  function setMode(mode) {
    $root.find('.adv-mode-btn').each(function () {
      var on = $(this).data('adv-mode') === mode;
      $(this).toggleClass('is-active', on).attr('aria-selected', on ? 'true' : 'false');
    });
    $('#adv-panel-package').toggleClass('is-active', mode === 'package');
    $('#adv-panel-meeting').toggleClass('is-active', mode === 'meeting');
    if (mode === 'meeting') { loadCalendly(); loadCal(); }
  }

  // Tabs inside the connect section
  $root.on('click', '.adv-mode-btn', function () {
    setMode($(this).data('adv-mode'));
  });

  // Hero / anywhere shortcuts that request a specific mode (e.g. "Book a Meeting")
  $(document).on('click', '[data-adv-mode]', function (e) {
    if ($(this).hasClass('adv-mode-btn')) return; // handled above
    var mode = $(this).data('adv-mode');
    if (mode !== 'package' && mode !== 'meeting') return;
    setMode(mode);
    scrollToConnect();
    e.preventDefault();
  });

  /* ── Package "Choose" buttons → preselect + scroll to form ── */
  $root.on('click', '.adv-choose', function () {
    var pkg = $(this).data('package') || '';
    setMode('package');
    if (pkg) {
      $('#adv-package').val(pkg);
      // If the value wasn't an exact <option>, fall back to "discuss"
      if (!$('#adv-package').val()) $('#adv-package').val('Not sure yet — let\'s discuss');
      var label = $('#adv-package option:selected').text();
      $('#adv-chosen-label').text(label);
      $('#adv-chosen').addClass('is-shown');
    }
    scrollToConnect();
  });

  // Keep the chip in sync if the user changes the dropdown manually
  $('#adv-package').on('change', function () {
    var v = $(this).val();
    if (v) {
      $('#adv-chosen-label').text($('#adv-package option:selected').text());
      $('#adv-chosen').addClass('is-shown');
    } else {
      $('#adv-chosen').removeClass('is-shown');
    }
  });

  function scrollToConnect() {
    var el = document.getElementById('hld-connect');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── Calendly: lazy-load script once when the meeting tab opens ── */
  var calendlyRequested = false;
  function loadCalendly() {
    if (calendlyRequested) return;
    if (!$('#adv-panel-meeting .calendly-inline-widget').length) return;
    calendlyRequested = true;
    if (!document.querySelector('link[href*="calendly.com/assets/external/widget.css"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://assets.calendly.com/assets/external/widget.css';
      document.head.appendChild(link);
    }
    var s = document.createElement('script');
    s.src = 'https://assets.calendly.com/assets/external/widget.js';
    s.async = true;
    document.body.appendChild(s);
  }

  /* ── Cal.com / cal.diy: lazy-init the official inline embed once ──
     Works for both cal.com and self-hosted cal.diy — embed.js, origin and
     calLink are all read from the container's data-* attributes (PHP-supplied). */
  var calRequested = false;
  function loadCal() {
    if (calRequested) return;
    var el = document.getElementById('hld-cal-inline');
    if (!el) return;
    var origin  = el.getAttribute('data-cal-origin');
    var link    = el.getAttribute('data-cal-link');
    var embedjs = el.getAttribute('data-cal-embedjs');
    if (!origin || !link || !embedjs) return;
    calRequested = true;

    // Official Cal embed bootstrap snippet, parameterised for self-hosting.
    (function (C, A, L) {
      var p = function (a, ar) { a.q.push(ar); };
      var d = C.document;
      C.Cal = C.Cal || function () {
        var cal = C.Cal; var ar = arguments;
        if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement('script')).src = A; cal.loaded = true; }
        if (ar[0] === L) {
          var api = function () { p(api, arguments); };
          var namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === 'string') { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]); }
          else { p(cal, ar); }
          return;
        }
        p(cal, ar);
      };
    })(window, embedjs, 'init');

    window.Cal('init', { origin: origin });
    window.Cal('inline', {
      elementOrSelector: '#hld-cal-inline',
      calLink: link,
      layout: 'month_view'
    });
  }

  /* ── Enquiry submit ── */
  $('#adv-form').on('submit', function (e) {
    e.preventDefault();

    var $btn = $('#adv-submit');
    var $err = $('#adv-form-error').hide();

    var pkg     = $('#adv-package').val();
    var name    = $('#adv-name').val().trim();
    var email   = $('#adv-email').val().trim();
    var phone   = $('#adv-phone').val().trim();
    var stud    = $('#adv-business').val().trim();
    var country = $('#adv-country').val().trim();
    var region  = $('#adv-region').val().trim();
    var note    = $('#adv-message').val().trim();
    var hp      = $('#adv-website').val(); // honeypot

    if (!pkg)   return $err.show().text('Please choose a package or option.');
    if (!name)  return $err.show().text('Please enter your name.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                return $err.show().text('Please enter a valid email address.');

    // Fold the chosen package into the message so it's captured in the admin enquiry record.
    var message = 'Interested in: ' + pkg + (note ? ('\n\n' + note) : '');

    $btn.prop('disabled', true).text('Sending…');

    $.post(ajax, {
      action: 'hld_submit_enquiry',
      nonce: nonce,
      listing_type: pkg,
      contact_name: name,
      contact_email: email,
      contact_phone: phone,
      stud_name: stud,
      country: country,
      region: region,
      message: message,
      hld_website: hp
    }, function (res) {
      $btn.prop('disabled', false).text('Send Enquiry');
      if (res && res.success) {
        $('#adv-form').hide();
        $('#adv-chosen').hide();
        $('#adv-form-success').show();
      } else {
        $err.show().text((res && res.data) || 'Something went wrong. Please try again.');
      }
    }).fail(function () {
      $btn.prop('disabled', false).text('Send Enquiry');
      $err.show().text('Server error. Please try again.');
    });
  });

})(jQuery);
