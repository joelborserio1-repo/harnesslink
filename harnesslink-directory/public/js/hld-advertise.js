/* HarnessLink — Advertise landing page JS
   - "Choose <package>" buttons tick the matching package checkbox + scroll to form
   - basic contact form submit (reuses the hld_submit_enquiry AJAX endpoint;
     leads are emailed to the configured advertise address, e.g. sales@harnesslink.com)
*/
(function ($) {
  'use strict';

  var $root = $('#hld-advertise');
  if (!$root.length) return;

  var ajax  = (window.HLD && HLD.ajax_url) || '';
  var nonce = (window.HLD && HLD.nonce) || '';

  function scrollToConnect() {
    var el = document.getElementById('hld-connect');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── Package card "Choose" buttons → tick checkbox + scroll to form ── */
  $root.on('click', '.adv-choose', function () {
    var pkg = $(this).data('package');
    if (pkg) {
      $('#adv-packages input[name="packages[]"]').each(function () {
        if ($(this).val() === pkg) $(this).prop('checked', true);
      });
    }
    scrollToConnect();
  });

  /* ── Contact form submit ── */
  $('#adv-form').on('submit', function (e) {
    e.preventDefault();

    var $btn = $('#adv-submit');
    var $err = $('#adv-form-error').hide();

    var name    = $('#adv-name').val().trim();
    var business= $('#adv-business').val().trim();
    var phone   = $('#adv-phone').val().trim();
    var email   = $('#adv-email').val().trim();
    var hp      = $('#adv-website').val(); // honeypot

    var packages = $('#adv-packages input[name="packages[]"]:checked')
      .map(function () { return $(this).val(); }).get();

    if (!name)     return $err.show().text('Please enter your full name.');
    if (!business) return $err.show().text('Please enter your business name.');
    if (!phone)    return $err.show().text('Please enter your phone number.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                   return $err.show().text('Please enter a valid email address.');
    if (!packages.length)
                   return $err.show().text('Please select at least one package.');

    // Short label for the enquiry list; full list goes in the message body.
    var listingType = packages.length === 1 ? packages[0] : (packages.length + ' packages');
    var message = 'Package(s) interested in:\n- ' + packages.join('\n- ');

    $btn.prop('disabled', true).text('Sending…');

    $.post(ajax, {
      action: 'hld_submit_enquiry',
      nonce: nonce,
      source: 'advertise',
      listing_type: listingType,
      contact_name: name,
      stud_name: business,
      contact_phone: phone,
      contact_email: email,
      message: message,
      hld_website: hp
    }, function (res) {
      $btn.prop('disabled', false).text('Send Enquiry');
      if (res && res.success) {
        $('#adv-form').hide();
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
