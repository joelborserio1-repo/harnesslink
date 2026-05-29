/* HarnessLink Directory — Public JS */
(function ($) {
  'use strict';

  const ajax  = HLD.ajax_url;
  const nonce = HLD.nonce;

  /* ══════════════════════════════════════════
     DIRECTORY: LIVE SEARCH + FILTER + PAGINATION
  ══════════════════════════════════════════ */
  if ($('#hld-table-body').length) {

    let page  = 1;
    let pages = parseInt($('#hld-pager').text().match(/of (\d+)/)?.[1] || 1);
    let timer = null;

    // Active directory type is declared on the directory wrapper.
    const directoryType = $('.hl-directory[data-directory-type]').data('directory-type') || '';

    function params() {
      return {
        action:         'hld_search',
        nonce:          nonce,
        directory_type: directoryType,
        search:         $('#hld-search').val(),
        country:        $('#hld-filter-country').val(),
        region:         '',
        type:           $('#hld-filter-type').val() || '',
        page:           page,
      };
    }

    function doSearch(resetPage) {
      if (resetPage) page = 1;
      const cols = $('.hld-dir-table thead th').length || 6;
      $.post(ajax, params(), function (res) {
        if (!res.success) return;
        const d = res.data;
        $('#hld-table-body').html(d.html || '<tr><td colspan="' + cols + '" class="hld-dir-empty">No listings found matching your search.</td></tr>');
        $('#hld-count').text('Showing ' + d.total + ' listing' + (d.total !== 1 ? 's' : ''));
        pages = d.pages;
        page  = d.page;
        const $pg = $('#hld-pagination');
        if (pages <= 1) {
          $pg.hide();
        } else {
          $pg.show();
          $('#hld-pager').text('Page ' + page + ' of ' + pages);
          $('#hld-prev').prop('disabled', page <= 1);
          $('#hld-next').prop('disabled', page >= pages);
        }
      });
    }

    $('#hld-search').on('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { doSearch(true); }, 320);
    });

    $('#hld-filter-country, #hld-filter-type').on('change', function () {
      doSearch(true);
    });

    $('#hld-prev').on('click', function () { if (page > 1) { page--; doSearch(false); } });
    $('#hld-next').on('click', function () { if (page < pages) { page++; doSearch(false); } });

    $('#hld-search-btn').on('click', function () { doSearch(true); });

    $(document).on('click', '.hld-claim-toggle', function (e) {
      e.preventDefault();
      const id = $(this).data('id');
      const $row = $('#hld-claim-' + id);
      $('.hld-claim-row').not($row).hide();
      $row.toggle();
    });

    $(document).on('click', '.hld-claim-cancel', function () {
      $(this).closest('.hld-claim-row').hide();
    });

    $(document).on('click', '.hld-claim-submit', function () {
      const $btn = $(this);
      const $panel = $btn.closest('.hld-claim-panel');
      const $err = $panel.find('.hld-claim-error').hide();
      const $success = $panel.find('.hld-claim-success').hide();

      const stallion = $panel.data('stallion') || '';
      const listingType = $panel.data('listing-type') || 'Stallion';
      const country = $panel.data('country') || '';
      const region = $panel.data('region') || '';
      const contact_name = $panel.find('.hld-claim-name').val().trim();
      const contact_email = $panel.find('.hld-claim-email').val().trim();
      const contact_phone = $panel.find('.hld-claim-phone').val().trim();
      const stud_name = $panel.find('.hld-claim-stud').val().trim() || stallion;
      const note = $panel.find('.hld-claim-message').val().trim();
      const message = 'Is this yours claim for existing listing: ' + stallion + (note ? '\n\nNotes: ' + note : '');

      if (!contact_name) return $err.show().text('Please enter your name.');
      if (!contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
        return $err.show().text('Please enter a valid email address.');
      }

      $btn.prop('disabled', true).text('Sending...');

      $.post(ajax, {
        action: 'hld_submit_enquiry',
        nonce,
        listing_type: listingType,
        contact_name,
        contact_email,
        contact_phone,
        stud_name,
        country,
        region,
        message,
      }, function (res) {
        $btn.prop('disabled', false).text('Send for Review');
        if (res.success) {
          $panel.find('.hld-claim-form input, .hld-claim-form textarea, .hld-claim-submit').hide();
          $success.show();
        } else {
          $err.show().text(res.data || 'Something went wrong. Please try again.');
        }
      }).fail(function () {
        $btn.prop('disabled', false).text('Send for Review');
        $err.show().text('Server error. Please try again.');
      });
    });
  }

  /* ══════════════════════════════════════════
     LISTING ENQUIRY MODAL
  ══════════════════════════════════════════ */
  const enqOverlay = $('#hld-enquiry-overlay');

  function openEnqModal(listingType) {
    enqOverlay.show();
    if (listingType) {
      $('#enq-pub-listing_type').val(listingType);
    }
    $('body').css('overflow', 'hidden');
    setTimeout(function () { $('#enq-pub-listing_type').focus(); }, 100);
  }

  function closeEnqModal() {
    enqOverlay.hide();
    $('body').css('overflow', '');
  }

  $(document).on('click', '.hld-open-enquiry-btn', function () {
    openEnqModal($(this).data('listing-type') || 'Stallion');
  });
  $('#hld-enq-close, #hld-enq-cancel').on('click', closeEnqModal);
  enqOverlay.on('click', function (e) {
    if ($(e.target).is(enqOverlay)) closeEnqModal();
  });

  /* Submit enquiry */
  $('#hld-enq-submit').on('click', function () {
    const $btn = $(this);

    const listing_type  = $('#enq-pub-listing_type').val();
    const contact_name  = $('#enq-pub-contact_name').val().trim();
    const contact_email = $('#enq-pub-contact_email').val().trim();
    const contact_phone = $('#enq-pub-contact_phone').val().trim();
    const stud_name     = $('#enq-pub-stud_name').val().trim();
    const country       = $('#enq-pub-country').val().trim();
    const region        = $('#enq-pub-region').val().trim();
    const message       = $('#enq-pub-message').val().trim();

    const $err = $('#hld-enq-error').hide();

    if (!listing_type)  return $err.show().text('Please select a listing type.');
    if (!contact_name)  return $err.show().text('Please enter your name.');
    if (!contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email))
                        return $err.show().text('Please enter a valid email address.');

    $btn.prop('disabled', true).text('Submitting…');

    $.post(ajax, {
      action: 'hld_submit_enquiry',
      nonce, listing_type, contact_name, contact_email,
      contact_phone, stud_name, country, region, message,
    }, function (res) {
      $btn.prop('disabled', false).text('Submit Enquiry');
      if (res.success) {
        $('#hld-enq-form').hide();
        $('#hld-enq-footer').hide();
        $('#hld-enq-success').show();
      } else {
        $err.show().text(res.data || 'Something went wrong. Please try again.');
      }
    }).fail(function () {
      $btn.prop('disabled', false).text('Submit Enquiry');
      $err.show().text('Server error. Please try again.');
    });
  });

  /* Escape key closes enquiry modal */
  $(document).on('keydown', function (e) {
    if (e.key === 'Escape' && enqOverlay.is(':visible')) closeEnqModal();
  });

  /* ══════════════════════════════════════════
     LIGHTBOX
  ══════════════════════════════════════════ */
  const $lb        = $('#hld-lightbox');
  const $lbImg     = $('.hld-lightbox__img');
  const $lbVideo   = $('.hld-lightbox__video');
  const $lbCaption = $('.hld-lightbox__caption');
  let   lbItems    = [];
  let   lbIndex    = 0;

  function lbOpen(index) {
    lbIndex = index;
    lbShow();
    $lb.show();
    $('body').css('overflow', 'hidden');
  }

  function lbClose() {
    $lb.hide();
    if ($lbVideo.length) { $lbVideo[0].pause(); }
    $lbVideo.attr('src', '').hide();
    $lbImg.attr('src', '').show();
    $('body').css('overflow', '');
  }

  function lbShow() {
    const item = lbItems[lbIndex];
    if (!item) return;
    $lbCaption.text(item.caption || '');

    if (item.type === 'video') {
      $lbImg.hide();
      $lbVideo.attr('src', item.url).show();
    } else {
      if ($lbVideo.length) $lbVideo[0].pause();
      $lbVideo.hide();
      $lbImg.attr('src', item.url).show();
    }
    $('.hld-lightbox__prev').toggle(lbIndex > 0);
    $('.hld-lightbox__next').toggle(lbIndex < lbItems.length - 1);
  }

  $(document).on('click', '.hld-lightbox-trigger', function (e) {
    e.preventDefault();
    const $triggers = $('.hld-lightbox-trigger');
    lbItems = [];
    $triggers.each(function () {
      lbItems.push({
        url:     $(this).attr('href'),
        caption: $(this).data('caption') || '',
        type:    $(this).data('type') || 'image',
      });
    });
    lbOpen($triggers.index(this));
  });

  $(document).on('click', '.hld-lightbox__close', lbClose);
  $(document).on('click', '.hld-lightbox__backdrop', lbClose);
  $(document).on('click', '.hld-lightbox__prev', function () {
    if (lbIndex > 0) { lbIndex--; lbShow(); }
  });
  $(document).on('click', '.hld-lightbox__next', function () {
    if (lbIndex < lbItems.length - 1) { lbIndex++; lbShow(); }
  });

  $(document).on('keydown', function (e) {
    if (!$lb.is(':visible')) return;
    if (e.key === 'Escape')     lbClose();
    if (e.key === 'ArrowLeft')  { if (lbIndex > 0) { lbIndex--; lbShow(); } }
    if (e.key === 'ArrowRight') { if (lbIndex < lbItems.length - 1) { lbIndex++; lbShow(); } }
  });

})(jQuery);
