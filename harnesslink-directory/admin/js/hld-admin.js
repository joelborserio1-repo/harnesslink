/* HarnessLink Directory — Admin JS */
(function ($) {
  'use strict';

  const ajax = HLD_Admin.ajax_url;
  const nonce = HLD_Admin.nonce;

  /* ══ MODAL ══ */
  const overlay = $('#hld-modal-overlay');
  const form    = {
    id:              $('#hld-id'),
    directory_type:  $('#hld-directory_type'),
    name:            $('#hld-name'),
    stud_name:       $('#hld-stud_name'),
    stud_master:     $('#hld-stud_master'),
    country:         $('#hld-country'),
    region:          $('#hld-region'),
    type:            $('#hld-type'),
    suburb:          $('#hld-suburb'),
    industry:        $('#hld-industry'),
    coverage:        $('#hld-coverage'),
    status_note:     $('#hld-status_note'),
    is_paying:       $('#hld-is_paying'),
    is_featured:     $('#hld-is_featured'),
    contact_phone:   $('#hld-contact_phone'),
    contact_email:   $('#hld-contact_email'),
    contact_website: $('#hld-contact_website'),
    stud_website:    $('#hld-stud_website'),
    contact_address: $('#hld-contact_address'),
    contact_au:      $('#hld-contact_au'),
    contact_us:      $('#hld-contact_us'),
    contact_nz:      $('#hld-contact_nz'),
    contact_fr:      $('#hld-contact_fr'),
    contact_other:   $('#hld-contact_other'),
    profile_bio:     $('#hld-profile_bio'),
    profile_image:   $('#hld-profile_image'),
    race_record:     $('#hld-race_record'),
    progeny_note:    $('#hld-progeny_note'),
    tagline:         $('#hld-tagline'),
    short_summary:   $('#hld-short_summary'),
    year_of_birth:   $('#hld-year_of_birth'),
    colour:          $('#hld-colour'),
    sex:             $('#hld-sex'),
    service_fee:     $('#hld-service_fee'),
    booking_label:   $('#hld-booking_label'),
    booking_url:     $('#hld-booking_url'),
    hero_image_id:   $('#hld-hero_image_id'),
    crosses_intro:   $('#hld-crosses_intro'),
    related_ids:     $('#hld-related_ids'),
    ped_sire: $('#hld-ped_sire'), ped_dam: $('#hld-ped_dam'),
    ped_ss: $('#hld-ped_ss'), ped_sd: $('#hld-ped_sd'), ped_ds: $('#hld-ped_ds'), ped_dd: $('#hld-ped_dd'),
    ped_sss: $('#hld-ped_sss'), ped_ssd: $('#hld-ped_ssd'), ped_sds: $('#hld-ped_sds'), ped_sdd: $('#hld-ped_sdd'),
    ped_dss: $('#hld-ped_dss'), ped_dsd: $('#hld-ped_dsd'), ped_dds: $('#hld-ped_dds'), ped_ddd: $('#hld-ped_ddd'),
  };

  /**
   * Adapt the modal fields to the selected directory type:
   * stallion layout shows its full bespoke form; service layout shows only
   * its configured fields (and relabels e.g. Region → State).
   */
  function applyTypeSchema(slug) {
    const cfg = (HLD_Admin.types && HLD_Admin.types[slug]) || { layout: 'service', fields: [], labels: {} };
    const isStallion = cfg.layout === 'stallion';

    // Stallion-only fields
    $('#hld-modal-overlay [data-stallion-only]').each(function () {
      $(this).toggle(isStallion);
    });

    // Shared / service fields driven by the schema
    $('#hld-modal-overlay .hld-field[data-field]').each(function () {
      if (this.hasAttribute('data-stallion-only')) return;
      const key  = $(this).attr('data-field');
      const show = isStallion ? true : (cfg.fields.indexOf(key) >= 0);
      $(this).toggle(show);

      const $label = $(this).children('label').first();
      if ($label.length) {
        if (!$label.attr('data-base')) $label.attr('data-base', $.trim($label.text()));
        const base = $label.attr('data-base');
        $label.text((!isStallion && cfg.labels[key]) ? cfg.labels[key] : base);
      }
    });
  }

  function openModal(title) {
    $('#hld-modal-title').text(title);
    overlay.show();
    switchTab('basic');
    applyTypeSchema(form.directory_type.val());
    // Reset gallery panel for new listing
    galleryReset();
    mediaReset();
    progenyReset();
    crossesReset();
    relatedReset();
    bannerReset();
  }

  $(document).on('change', '#hld-directory_type', function () {
    applyTypeSchema($(this).val());
  });

  function closeModal() {
    overlay.hide();
    resetForm();
    galleryReset();
    mediaReset();
    crossesReset();
    relatedReset();
    bannerReset();
  }

  function resetForm() {
    $.each(form, function (k, el) {
      if (el.is(':checkbox')) el.prop('checked', false);
      else if (k === 'directory_type') el.val(el.data('default') || 'stallion');
      else if (k === 'hero_image_id') el.val(0);
      else el.val('');
    });
    updateProfileImagePreview('');
    heroImagePicker.showPreview('');
  }

  function fillForm(s) {
    $.each(form, function (k, el) {
      if (k === 'is_paying' || k === 'is_featured') el.prop('checked', s[k] == 1);
      else el.val(s[k] || '');
    });
    updateProfileImagePreview(s.profile_image || '');
    heroImagePicker.loadPreviewFromId(s.hero_image_id);
  }

  form.is_featured.on('change', function () {
    if ($(this).prop('checked')) {
      form.is_paying.prop('checked', true);
    }
  });

  form.is_paying.on('change', function () {
    if (!$(this).prop('checked')) {
      form.is_featured.prop('checked', false);
    }
  });

  /* Open for new */
  $(document).on('click', '#hld-add-new, #hld-add-new-inline', function (e) {
    e.preventDefault();
    openModal('Add Listing');
  });

  /* Open for edit */
  $(document).on('click', '.hld-edit', function () {
    const id = $(this).data('id');
    $.post(ajax, { action: 'hld_get_stallion', nonce, id }, function (res) {
      if (!res.success) return alert('Could not load listing.');
      fillForm(res.data);
      openModal('Edit Listing');
    });
  });

  /* Close */
  $('#hld-modal-close, #hld-modal-cancel').on('click', closeModal);
  overlay.on('click', function (e) {
    if ($(e.target).is(overlay)) closeModal();
  });

  /* Save */
  $('#hld-save-stallion').on('click', function () {
    const name = form.name.val().trim();
    if (!name) { form.name.focus(); alert('Name is required.'); return; }

    const payload = { action: 'hld_save_stallion', nonce };
    $.each(form, function (k, el) {
      if (el.is(':checkbox')) payload[k] = el.prop('checked') ? 1 : 0;
      else payload[k] = el.val();
    });

    const $btn = $(this).prop('disabled', true).text('Saving…');
    $.post(ajax, payload, function (res) {
      $btn.prop('disabled', false).text('Save Listing');
      if (res.success) {
        if (res.data && res.data.stallion && res.data.stallion.is_paying !== undefined) {
          const $row = $('tr[data-id="' + res.data.stallion.id + '"]');
          const $status = $row.find('.hld-status');
          if ($status.length) {
            if (String(res.data.stallion.is_paying) === '1') {
              $status.removeClass('hld-status--free').addClass('hld-status--paying').text('✓ Paying');
            } else {
              $status.removeClass('hld-status--paying').addClass('hld-status--free').text('Free Listing');
            }
          }
        }
        closeModal();
        location.reload();
      } else {
        alert('Error: ' + (res.data || 'Unknown error'));
      }
    }).fail(function (xhr) {
      $btn.prop('disabled', false).text('Save Listing');
      alert('Save failed. Please refresh and try again. Server said: ' + (xhr.responseText || xhr.statusText || 'Unknown error'));
    });
  });

  /* Delete */
  $(document).on('click', '.hld-delete', function () {
    const id   = $(this).data('id');
    const name = $(this).data('name');
    if (!confirm('Delete "' + name + '"? This cannot be undone.')) return;
    $.post(ajax, { action: 'hld_delete_stallion', nonce, id }, function (res) {
      if (res.success) location.reload();
      else alert('Delete failed.');
    });
  });

  /* Profile image picker */
  let profileImageFrame = null;

  function updateProfileImagePreview(url) {
    const $preview = $('#hld-profile-image-preview');
    const $img = $preview.find('img');
    if (url) {
      $img.attr('src', url);
      $preview.show();
    } else {
      $img.attr('src', '');
      $preview.hide();
    }
  }

  form.profile_image.on('input', function () {
    updateProfileImagePreview($(this).val().trim());
  });

  $('#hld-profile-image-pick').on('click', function (e) {
    e.preventDefault();

    if (profileImageFrame) {
      profileImageFrame.open();
      return;
    }

    profileImageFrame = wp.media({
      title: 'Choose Profile Picture',
      button: { text: 'Use this image' },
      library: { type: 'image' },
      multiple: false,
    });

    profileImageFrame.on('select', function () {
      const attachment = profileImageFrame.state().get('selection').first().toJSON();
      const url = attachment.sizes && attachment.sizes.large ? attachment.sizes.large.url : attachment.url;
      form.profile_image.val(url);
      updateProfileImagePreview(url);
    });

    profileImageFrame.open();
  });

  $('#hld-profile-image-clear').on('click', function (e) {
    e.preventDefault();
    form.profile_image.val('');
    updateProfileImagePreview('');
  });

  /* ══ HERO IMAGE PICKER (single, WP media ID based) ══ */
  function singleImagePicker(opts) {
    let frame = null;
    const $hidden  = opts.hiddenField;
    const $preview = $(opts.previewSelector);
    const $img     = $preview.find('img');

    function showPreview(url) {
      if (url) { $img.attr('src', url); $preview.show(); }
      else     { $img.attr('src', ''); $preview.hide(); }
    }

    function loadPreviewFromId(id) {
      id = parseInt(id) || 0;
      if (!id) { showPreview(''); return; }
      const attachment = wp.media.attachment(id);
      attachment.fetch().done(function () {
        const url = (attachment.get('sizes') && attachment.get('sizes').large) ? attachment.get('sizes').large.url : attachment.get('url');
        showPreview(url);
      });
    }

    $(opts.pickBtn).on('click', function (e) {
      e.preventDefault();
      if (frame) { frame.open(); return; }
      frame = wp.media({ title: opts.title, button: { text: 'Use this image' }, library: { type: 'image' }, multiple: false });
      frame.on('select', function () {
        const attachment = frame.state().get('selection').first().toJSON();
        $hidden.val(attachment.id);
        const url = attachment.sizes && attachment.sizes.large ? attachment.sizes.large.url : attachment.url;
        showPreview(url);
      });
      frame.open();
    });

    $(opts.clearBtn).on('click', function (e) {
      e.preventDefault();
      $hidden.val(0);
      showPreview('');
    });

    return { loadPreviewFromId: loadPreviewFromId, showPreview: showPreview };
  }

  const heroImagePicker = singleImagePicker({
    hiddenField: form.hero_image_id,
    previewSelector: '#hld-hero-image-preview',
    pickBtn: '#hld-hero-image-pick',
    clearBtn: '#hld-hero-image-clear',
    title: 'Choose Hero Image',
  });

  /* ══ MODAL TABS ══ */
  function switchTab(id) {
    $('.hld-tab').removeClass('active');
    $('.hld-tab-panel').removeClass('active');
    $('.hld-tab[data-tab="' + id + '"]').addClass('active');
    $('#hld-tab-' + id).addClass('active');
  }
  $(document).on('click', '.hld-tab', function () {
    const tab = $(this).data('tab');
    switchTab(tab);
    if (tab === 'progeny') progenyOnOpen();
    if (tab === 'images')  { imagesOnOpen(); bannerOnOpen(); }
    if (tab === 'media')   mediaOnOpen();
    if (tab === 'content') crossesOnOpen();
    if (tab === 'related') relatedOnOpen();
  });

  /* ══ PROGENY (per-stallion) ══ */
  let progenyFile = null;

  function progenyStallionId() { return parseInt($('#hld-id').val()) || 0; }

  function progenyReset() {
    progenyFile = null;
    $('#hld-progeny-file').val('');
    $('#hld-progeny-filename').text('');
    $('#hld-progeny-import').prop('disabled', true);
    $('#hld-progeny-result').hide().removeClass('error success');
    $('#hld-progeny-tbody').html('<tr><td colspan="10" class="hld-empty">No progeny for this stallion.</td></tr>');
    $('#hld-progeny-count').text('No progeny loaded yet.');
  }

  function progenyRenderRows(items) {
    if (!items || !items.length) {
      $('#hld-progeny-tbody').html('<tr><td colspan="10" class="hld-empty">No progeny for this stallion.</td></tr>');
      $('#hld-progeny-count').text('No progeny for this stallion.');
      return;
    }
    let html = '';
    items.forEach(function (p) {
      html += '<tr>' +
        '<td><strong>' + esc(p.name) + '</strong></td>' +
        '<td>' + esc(p.foaling_date) + '</td>' +
        '<td>' + esc(p.country) + '</td>' +
        '<td>' + esc(p.sex) + '</td>' +
        '<td>' + esc(p.dam) + '</td>' +
        '<td>' + esc(p.broodmare_sire) + '</td>' +
        '<td>' + esc(p.prizemoney) + '</td>' +
        '<td>' + esc(p.mile_rate) + '</td>' +
        '<td>' + esc(p.starts) + '</td>' +
        '<td>' + esc(p.wins) + '</td>' +
      '</tr>';
    });
    $('#hld-progeny-tbody').html(html);
    $('#hld-progeny-count').text(items.length + ' progeny loaded.');
  }

  function esc(v) {
    return $('<div>').text(v == null ? '' : String(v)).html();
  }

  function progenyOnOpen() {
    const id = progenyStallionId();
    if (!id) {
      $('#hld-progeny-needs-save').show();
      $('#hld-progeny-import, #hld-progeny-clear').prop('disabled', true);
      return;
    }
    $('#hld-progeny-needs-save').hide();
    $('#hld-progeny-clear').prop('disabled', false);
    $.post(ajax, { action: 'hld_get_progeny', nonce, stallion_id: id }, function (res) {
      if (res.success) progenyRenderRows(res.data);
    });
  }

  $('#hld-progeny-file').on('change', function () {
    const f = this.files[0];
    if (!f || !f.name.match(/\.csv$/i)) { alert('Please select a .csv file.'); return; }
    progenyFile = f;
    $('#hld-progeny-filename').text('✓ ' + f.name);
    $('#hld-progeny-import').prop('disabled', !progenyStallionId());
  });

  $('#hld-progeny-import').on('click', function () {
    const id = progenyStallionId();
    if (!id || !progenyFile) return;
    const fd = new FormData();
    fd.append('action', 'hld_import_progeny');
    fd.append('nonce', nonce);
    fd.append('stallion_id', id);
    fd.append('progeny_csv', progenyFile);

    const $btn = $(this).prop('disabled', true).text('Importing…');
    const $res = $('#hld-progeny-result').hide().removeClass('error success');
    $.ajax({
      url: ajax, type: 'POST', data: fd, processData: false, contentType: false,
      success: function (res) {
        $btn.prop('disabled', false).text('Import Progeny');
        if (res.success) {
          $res.addClass('success').text(res.data.message).show();
          progenyRenderRows(res.data.items);
          progenyFile = null;
          $('#hld-progeny-file').val('');
          $('#hld-progeny-filename').text('');
        } else {
          $res.addClass('error').text(res.data || 'Import failed.').show();
        }
      },
      error: function () {
        $btn.prop('disabled', false).text('Import Progeny');
        $res.addClass('error').text('Server error during import.').show();
      }
    });
  });

  $('#hld-progeny-clear').on('click', function () {
    const id = progenyStallionId();
    if (!id) return;
    if (!confirm('Remove all progeny for this stallion? This cannot be undone.')) return;
    $.post(ajax, { action: 'hld_clear_progeny', nonce, stallion_id: id }, function (res) {
      if (res.success) progenyRenderRows([]);
    });
  });

  $('#hld-progeny-sample').on('click', function (e) {
    e.preventDefault();
    const headers = 'Name,Foaling Date,Country of Birth,Sex,Dam,Broodmare Sire,Lifetime Prizemoney,Best Mile Rate,Starts,Wins';
    const sample  = 'LEAP TO FAME,05-Nov-2018,AU,Colt,LETTUCEREASON,ART MAJOR USA,"$6,335,863",1:48.3MS,89,70';
    const blob = new Blob([headers + '\n' + sample], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'harnesslink-progeny-sample.csv';
    a.click();
  });

  /* ══ CSV IMPORT ══ */
  const dropZone  = $('#hld-drop-zone');
  const fileInput = $('#hld-csv-input');
  const importBtn = $('#hld-import-btn');
  const result    = $('#hld-import-result');
  let   csvFile   = null;

  function setFile(file) {
    if (!file || !file.name.match(/\.csv$/i)) {
      alert('Please select a .csv file.');
      return;
    }
    csvFile = file;
    $('#hld-file-name').text('✓ ' + file.name);
    importBtn.prop('disabled', false);
  }

  fileInput.on('change', function () { setFile(this.files[0]); });

  dropZone.on('click', function () { fileInput.click(); });

  dropZone.on('dragover dragenter', function (e) {
    e.preventDefault(); $(this).addClass('drag-over');
  }).on('dragleave drop', function (e) {
    e.preventDefault(); $(this).removeClass('drag-over');
    if (e.type === 'drop') setFile(e.originalEvent.dataTransfer.files[0]);
  });

  importBtn.on('click', function () {
    if (!csvFile) return;
    const importType = $('#hld-import-type').val() || 'stallion';
    const fd = new FormData();
    fd.append('action',   'hld_import_csv');
    fd.append('nonce',    nonce);
    fd.append('csv_file', csvFile);
    fd.append('directory_type', importType);
    fd.append('replace_all', $('#hld-replace-all').is(':checked') ? 1 : 0);

    if ($('#hld-replace-all').is(':checked') && !confirm('This will clear all existing "' + importType + '" listings before importing this CSV. Continue?')) {
      return;
    }

    importBtn.prop('disabled', true).text('Importing…');
    result.hide();

    $.ajax({
      url:         ajax,
      type:        'POST',
      data:        fd,
      processData: false,
      contentType: false,
      success: function (res) {
        importBtn.prop('disabled', false).text('Import CSV');
        result.show().removeClass('error success');
        if (res.success) {
          result.addClass('success').text(res.data.message);
        } else {
          result.addClass('error').text(res.data || 'Import failed.');
        }
      },
      error: function () {
        importBtn.prop('disabled', false).text('Import CSV');
        result.show().addClass('error').text('Server error during import.');
      }
    });
  });

  /* ══ ENQUIRY INBOX ══ */
  const enqOverlay = $('#hld-enq-modal-overlay');

  function openEnqModal(data) {
    $('#enq-id').val(data.id);
    $('#enq-contact_name').text(data.contact_name || '—');
    $('#enq-contact_email').text(data.contact_email || '—').attr('href', 'mailto:' + data.contact_email);
    $('#enq-contact_phone').text(data.contact_phone || '—');
    $('#enq-listing_type').text(data.listing_type || '—');
    $('#enq-stud_name').text(data.stud_name || '—');
    const loc = [data.country, data.region].filter(Boolean).join(' / ') || '—';
    $('#enq-location').text(loc);
    $('#enq-message').text(data.message || '(No message provided)');
    $('#enq-status').val(data.status || 'new');
    $('#enq-admin_notes').val(data.admin_notes || '');
    $('#enq-mailto').attr('href', 'mailto:' + data.contact_email);
    enqOverlay.show();
  }

  function closeEnqModal() { enqOverlay.hide(); }

  $('#hld-enq-modal-close, #hld-enq-modal-cancel').on('click', closeEnqModal);
  enqOverlay.on('click', function (e) { if ($(e.target).is(enqOverlay)) closeEnqModal(); });

  /* View enquiry */
  $(document).on('click', '.hld-enq-view', function () {
    const id = $(this).data('id');
    $.post(ajax, { action: 'hld_get_enquiry', nonce, id }, function (res) {
      if (!res.success) return alert('Could not load enquiry.');
      openEnqModal(res.data);
    });
  });

  /* Save status + notes */
  $('#hld-enq-save').on('click', function () {
    const id         = $('#enq-id').val();
    const status     = $('#enq-status').val();
    const admin_notes= $('#enq-admin_notes').val();

    const $btn = $(this).prop('disabled', true).text('Saving…');
    $.post(ajax, { action: 'hld_update_enquiry_status', nonce, id, status, admin_notes }, function (res) {
      $btn.prop('disabled', false).text('Save Changes');
      if (res.success) {
        closeEnqModal();
        location.reload();
      } else {
        alert('Save failed: ' + (res.data || 'Unknown error'));
      }
    }).fail(function (xhr) {
      $btn.prop('disabled', false).text('Save Changes');
      alert('Save failed. Please refresh and try again. Server said: ' + (xhr.responseText || xhr.statusText || 'Unknown error'));
    });
  });

  /* Delete enquiry */
  $(document).on('click', '.hld-enq-delete', function () {
    const id   = $(this).data('id');
    const name = $(this).data('name');
    if (!confirm('Delete enquiry from "' + name + '"? This cannot be undone.')) return;
    $.post(ajax, { action: 'hld_delete_enquiry', nonce, id }, function (res) {
      if (res.success) location.reload();
      else alert('Delete failed.');
    });
  });

  /* ══════════════════════════════════════════
     GALLERY IMAGES + MEDIA VIDEOS
     Both live in the same hld_gallery table (media_type discriminates);
     the Images tab shows only images, the Media tab shows only videos.
  ══════════════════════════════════════════ */

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function currentHorseId() { return parseInt($('#hld-id').val()) || 0; }

  /**
   * One instance manages either the image grid or the video grid, both
   * backed by hld_gallery filtered by media_type.
   */
  function makeMediaModule(cfg) {
    let loadedForId = 0;
    let wpFrame      = null;

    function reset() {
      loadedForId = 0;
      cfg.grid.empty();
      cfg.empty.text(cfg.emptyText).show();
      cfg.hint.hide();
      cfg.needsSave.hide();
      if (cfg.urlInput) cfg.urlInput.val('');
    }

    function onOpen() {
      const id = currentHorseId();
      if (!id) { cfg.needsSave.show(); cfg.empty.hide(); cfg.hint.hide(); return; }
      cfg.needsSave.hide();
      if (id !== loadedForId) load(id);
    }

    function load(id) {
      loadedForId = id;
      cfg.grid.empty();
      $.post(ajax, { action: 'hld_get_gallery', nonce, stallion_id: id }, function (res) {
        if (!res.success) return;
        const items = (res.data || []).filter(function (it) { return it.media_type === cfg.mediaType; });
        if (!items.length) { cfg.empty.text(cfg.emptyText).show(); cfg.hint.hide(); return; }
        cfg.empty.hide();
        cfg.hint.show();
        items.forEach(addCard);
        initSortable();
      });
    }

    function addCard(item) {
      const isVideo = cfg.mediaType === 'video';
      const thumb = isVideo
        ? '<div class="hld-gallery-card__video-thumb"><span class="hld-play-icon">&#9654;</span></div>'
        : '<img class="hld-gallery-card__thumb" src="' + escHtml(item.url) + '" alt="" loading="lazy" />';

      const descField = isVideo
        ? '<textarea class="hld-gallery-card__description" rows="2" placeholder="Short description…">' + escHtml(item.description || '') + '</textarea>'
        : '';

      const card = $(
        '<div class="hld-gallery-card" data-id="' + item.id + '">' +
          thumb +
          '<button type="button" class="hld-gallery-card__del" title="Remove">✕</button>' +
          '<div class="hld-gallery-card__body">' +
            '<div class="hld-gallery-card__type">' + (isVideo ? 'Video' : 'Image') + '</div>' +
            '<input class="hld-gallery-card__caption" type="text" value="' + escHtml(item.caption || '') + '" placeholder="' + (isVideo ? 'Video title…' : 'Add caption…') + '" />' +
            descField +
          '</div>' +
        '</div>'
      );
      card.data('media-type', cfg.mediaType);
      cfg.grid.append(card);
    }

    function initSortable() {
      if (cfg.grid.hasClass('ui-sortable')) cfg.grid.sortable('destroy');
      cfg.grid.sortable({
        items: '.hld-gallery-card',
        placeholder: 'hld-gallery-card ui-sortable-placeholder',
        tolerance: 'pointer',
        stop: function () {
          const order = [];
          cfg.grid.find('.hld-gallery-card').each(function () { order.push($(this).data('id')); });
          $.post(ajax, { action: 'hld_reorder_gallery', nonce, stallion_id: loadedForId, order: order });
        }
      });
    }

    function addViaUrl(url) {
      const id = currentHorseId();
      if (!id) return alert('Save the horse first before adding media.');
      $.post(ajax, {
        action: 'hld_add_gallery_item', nonce, stallion_id: id,
        url: url, media_type: cfg.mediaType, caption: '',
      }, function (res) {
        if (!res.success) return alert(res.data || 'Failed to add item.');
        cfg.empty.hide();
        cfg.hint.show();
        addCard(res.data);
        initSortable();
        if (cfg.urlInput) cfg.urlInput.val('');
      });
    }

    function addViaLibrary() {
      const id = currentHorseId();
      if (!id) return alert('Save the horse first before adding media.');
      if (wpFrame) { wpFrame.open(); return; }
      wpFrame = wp.media({
        title: cfg.libraryTitle,
        button: { text: 'Add' },
        library: { type: [cfg.mediaType] },
        multiple: true,
      });
      wpFrame.on('select', function () {
        const attachments = wpFrame.state().get('selection').toArray();
        let pending = attachments.length;
        attachments.forEach(function (attachment) {
          const a = attachment.toJSON();
          $.post(ajax, {
            action: 'hld_add_gallery_item', nonce, stallion_id: id,
            attachment_id: a.id, url: a.url, media_type: cfg.mediaType, caption: a.caption || '',
          }, function (res) {
            if (res.success) { cfg.empty.hide(); cfg.hint.show(); addCard(res.data); }
            pending--;
            if (pending === 0) initSortable();
          });
        });
      });
      wpFrame.open();
    }

    return { reset: reset, onOpen: onOpen, addViaUrl: addViaUrl, addViaLibrary: addViaLibrary, grid: cfg.grid, emptyText: cfg.emptyText, empty: cfg.empty, hint: cfg.hint };
  }

  const imagesModule = makeMediaModule({
    grid: $('#hld-gallery-grid'), empty: $('#hld-gallery-empty-note'), hint: $('#hld-gallery-hint'),
    needsSave: $('#hld-gallery-needs-save'), urlInput: $('#hld-gallery-url-input'),
    mediaType: 'image', emptyText: 'No gallery images added yet.', libraryTitle: 'Select Images',
  });
  const mediaModule = makeMediaModule({
    grid: $('#hld-media-grid'), empty: $('#hld-media-empty-note'), hint: $('#hld-media-hint'),
    needsSave: $('#hld-media-needs-save'), urlInput: $('#hld-media-url-input'),
    mediaType: 'video', emptyText: 'No videos added yet.', libraryTitle: 'Select a Video',
  });

  function galleryReset() { imagesModule.reset(); }
  function mediaReset()   { mediaModule.reset(); }
  function imagesOnOpen() { imagesModule.onOpen(); }
  function mediaOnOpen()  { mediaModule.onOpen(); }

  $('#hld-gallery-url-add').on('click', function () {
    const url = $('#hld-gallery-url-input').val().trim();
    if (!url) return alert('Please paste an image URL first.');
    imagesModule.addViaUrl(url);
  });
  $('#hld-gallery-media-btn').on('click', function () { imagesModule.addViaLibrary(); });

  $('#hld-media-url-add').on('click', function () {
    const url = $('#hld-media-url-input').val().trim();
    if (!url) return alert('Please paste a YouTube or Vimeo link first.');
    mediaModule.addViaUrl(url);
  });
  $('#hld-media-library-btn').on('click', function () { mediaModule.addViaLibrary(); });

  /* ── Delete gallery/media item (shared handler — cards live in either grid) ── */
  $(document).on('click', '.hld-gallery-card__del', function (e) {
    e.stopPropagation();
    const $card = $(this).closest('.hld-gallery-card');
    const id    = $card.data('id');
    if (!confirm('Remove this item?')) return;
    $.post(ajax, { action: 'hld_delete_gallery_item', nonce, id }, function (res) {
      if (!res.success) return;
      const mod = $card.data('media-type') === 'video' ? mediaModule : imagesModule;
      $card.remove();
      if (!mod.grid.find('.hld-gallery-card').length) {
        mod.empty.text(mod.emptyText).show();
        mod.hint.hide();
      }
    });
  });

  /* ── Save caption / description on blur ── */
  $(document).on('blur', '.hld-gallery-card__caption', function () {
    const id = $(this).closest('.hld-gallery-card').data('id');
    $.post(ajax, { action: 'hld_update_gallery_caption', nonce, id, caption: $(this).val() });
  });
  $(document).on('blur', '.hld-gallery-card__description', function () {
    const id = $(this).closest('.hld-gallery-card').data('id');
    $.post(ajax, { action: 'hld_update_gallery_caption', nonce, id, description: $(this).val() });
  });

  /* ══════════════════════════════════════════
     CROSSES OF GOLD
  ══════════════════════════════════════════ */

  let crossesLoadedForId = 0;
  const $crossesList      = $('#hld-crosses-list');
  const $crossesEmpty     = $('#hld-crosses-empty');
  const $crossesNeedsSave = $('#hld-crosses-needs-save');

  function crossesReset() {
    crossesLoadedForId = 0;
    $crossesList.empty();
    $crossesEmpty.show();
    $crossesNeedsSave.hide();
  }

  function crossesOnOpen() {
    const id = currentHorseId();
    if (!id) { $crossesNeedsSave.show(); $crossesEmpty.hide(); return; }
    $crossesNeedsSave.hide();
    if (id !== crossesLoadedForId) crossesLoad(id);
  }

  function crossesLoad(id) {
    crossesLoadedForId = id;
    $crossesList.empty();
    $.post(ajax, { action: 'hld_get_crosses', nonce, stallion_id: id }, function (res) {
      if (!res.success) return;
      const items = res.data || [];
      if (!items.length) { $crossesEmpty.show(); return; }
      $crossesEmpty.hide();
      items.forEach(crossAddCard);
      crossesInitSortable();
    });
  }

  function crossAddCard(item) {
    const card = $(
      '<div class="hld-cross-card" data-id="' + item.id + '">' +
        '<button type="button" class="hld-cross-card__del" title="Remove cross">✕</button>' +
        '<div class="hld-field"><label>Cross Title / Sire Line</label>' +
          '<input type="text" class="hld-cross-title" value="' + escHtml(item.title || '') + '" placeholder="e.g. In The Pocket" /></div>' +
        '<div class="hld-field"><label>Description</label>' +
          '<textarea class="hld-cross-description" rows="3" placeholder="Why this line works well with this horse…">' + escHtml(item.description || '') + '</textarea></div>' +
        '<div class="hld-field"><label>Notable Examples (optional)</label>' +
          '<textarea class="hld-cross-examples" rows="2" placeholder="Horse names or supporting examples…">' + escHtml(item.examples || '') + '</textarea></div>' +
      '</div>'
    );
    $crossesList.append(card);
  }

  function crossesInitSortable() {
    if ($crossesList.hasClass('ui-sortable')) $crossesList.sortable('destroy');
    $crossesList.sortable({
      items: '.hld-cross-card',
      handle: false,
      placeholder: 'hld-cross-card ui-sortable-placeholder',
      tolerance: 'pointer',
      stop: function () {
        const order = [];
        $crossesList.find('.hld-cross-card').each(function () { order.push($(this).data('id')); });
        $.post(ajax, { action: 'hld_reorder_crosses', nonce, stallion_id: crossesLoadedForId, order: order });
      }
    });
  }

  $('#hld-cross-add').on('click', function () {
    const id = currentHorseId();
    if (!id) return alert('Save the horse first before adding breeding crosses.');
    $.post(ajax, { action: 'hld_add_cross', nonce, stallion_id: id, title: '', description: '', examples: '' }, function (res) {
      if (!res.success) return alert(res.data || 'Failed to add cross.');
      $crossesEmpty.hide();
      crossAddCard(res.data);
      crossesInitSortable();
      $crossesList.find('.hld-cross-card:last .hld-cross-title').trigger('focus');
    });
  });

  $(document).on('click', '.hld-cross-card__del', function () {
    const $card = $(this).closest('.hld-cross-card');
    const id    = $card.data('id');
    if (!confirm('Remove this breeding cross?')) return;
    $.post(ajax, { action: 'hld_delete_cross', nonce, id }, function (res) {
      if (!res.success) return;
      $card.remove();
      if (!$crossesList.find('.hld-cross-card').length) $crossesEmpty.show();
    });
  });

  $(document).on('blur', '.hld-cross-title, .hld-cross-description, .hld-cross-examples', function () {
    const $card = $(this).closest('.hld-cross-card');
    const id    = $card.data('id');
    $.post(ajax, {
      action: 'hld_update_cross', nonce, id,
      title:       $card.find('.hld-cross-title').val(),
      description: $card.find('.hld-cross-description').val(),
      examples:    $card.find('.hld-cross-examples').val(),
    });
  });

  /* ══════════════════════════════════════════
     RELATED HORSES — search-as-you-type picker
  ══════════════════════════════════════════ */

  let relatedSelected   = []; // [{id, name, stud_name}]
  const $relatedResults = $('#hld-related-results');
  const $relatedSelected= $('#hld-related-selected');
  const $relatedEmpty   = $('#hld-related-empty-note');
  let relatedSearchTimer = null;

  function relatedReset() {
    relatedSelected = [];
    $relatedResults.empty();
    $('#hld-related-search').val('');
    renderRelatedSelected();
  }

  function relatedOnOpen() {
    const raw = form.related_ids.val();
    if (!raw) return;
    let ids = [];
    try { ids = JSON.parse(raw); } catch (e) { ids = []; }
    if (!ids || !ids.length) return;
    if (relatedSelected.length) return; // already hydrated
    $.post(ajax, { action: 'hld_search_horses', nonce, ids: ids.join(',') }, function (res) {
      if (!res.success) return;
      relatedSelected = res.data || [];
      renderRelatedSelected();
    });
  }

  function renderRelatedSelected() {
    form.related_ids.val(relatedSelected.length ? JSON.stringify(relatedSelected.map(function (h) { return h.id; })) : '');
    if (!relatedSelected.length) {
      $relatedSelected.html('<p class="hld-gallery-note" id="hld-related-empty-note">No related horses selected yet.</p>');
      return;
    }
    let html = '';
    relatedSelected.forEach(function (h) {
      html += '<div class="hld-related-chip" data-id="' + h.id + '">' +
        '<span>' + escHtml(h.name) + (h.stud_name ? ' <em>(' + escHtml(h.stud_name) + ')</em>' : '') + '</span>' +
        '<button type="button" class="hld-related-chip__del" title="Remove">✕</button>' +
      '</div>';
    });
    $relatedSelected.html(html);
  }

  $(document).on('click', '.hld-related-chip__del', function () {
    const id = parseInt($(this).closest('.hld-related-chip').data('id'));
    relatedSelected = relatedSelected.filter(function (h) { return h.id !== id; });
    renderRelatedSelected();
  });

  $('#hld-related-search').on('input', function () {
    const term = $(this).val().trim();
    clearTimeout(relatedSearchTimer);
    relatedSearchTimer = setTimeout(function () {
      const excludeId = currentHorseId();
      $.post(ajax, { action: 'hld_search_horses', nonce, search: term, exclude: excludeId }, function (res) {
        if (!res.success) return;
        const selectedIds = relatedSelected.map(function (h) { return h.id; });
        let html = '';
        (res.data || []).forEach(function (h) {
          if (selectedIds.indexOf(h.id) >= 0) return;
          html += '<div class="hld-related-result" data-id="' + h.id + '" data-name="' + escHtml(h.name) + '" data-stud="' + escHtml(h.stud_name || '') + '">' +
            '<span>' + escHtml(h.name) + (h.stud_name ? ' <em>(' + escHtml(h.stud_name) + ')</em>' : '') + '</span>' +
            '<button type="button" class="hld-btn hld-btn--xs hld-btn--secondary">Add</button>' +
          '</div>';
        });
        $relatedResults.html(html || '<p class="hld-gallery-note">No matches.</p>');
      });
    }, 250);
  });

  $(document).on('click', '.hld-related-result', function () {
    const id   = parseInt($(this).data('id'));
    const name = $(this).data('name');
    const stud = $(this).data('stud');
    if (relatedSelected.some(function (h) { return h.id === id; })) return;
    relatedSelected.push({ id: id, name: name, stud_name: stud });
    renderRelatedSelected();
    $(this).remove();
  });

  /* ══════════════════════════════════════════
     PROMOTIONAL BANNERS (repeatable, rotating)
  ══════════════════════════════════════════ */

  let bannerLoadedForId = 0;
  let bannerMediaFrame  = null;
  const $bannersList  = $('#hld-banners-list');
  const $bannersEmpty = $('#hld-banners-empty');
  const $bannersNeedsSave = $('#hld-banners-needs-save');

  function bannerReset() {
    bannerLoadedForId = 0;
    $bannersList.empty();
    $bannersEmpty.show();
    $bannersNeedsSave.hide();
  }

  function bannerOnOpen() {
    const id = currentHorseId();
    if (!id) { $bannersNeedsSave.show(); $bannersEmpty.hide(); return; }
    $bannersNeedsSave.hide();
    if (id !== bannerLoadedForId) bannerLoad(id);
  }

  function bannerLoad(id) {
    bannerLoadedForId = id;
    $bannersList.empty();
    $.post(ajax, { action: 'hld_get_banners', nonce, stallion_id: id }, function (res) {
      if (!res.success) return;
      const items = res.data || [];
      if (!items.length) { $bannersEmpty.show(); return; }
      $bannersEmpty.hide();
      items.forEach(bannerAddCard);
      bannerInitSortable();
    });
  }

  function bannerAddCard(item) {
    const thumbUrl = item.image_url || '';
    const card = $(
      '<div class="hld-banner-card" data-id="' + item.id + '">' +
        '<button type="button" class="hld-banner-card__del" title="Remove">&#10005;</button>' +
        '<div class="hld-banner-card__thumb">' + (thumbUrl ? '<img src="' + escHtml(thumbUrl) + '" alt="" />' : '<span>1360 &times; 150</span>') + '</div>' +
        '<div class="hld-banner-card__fields">' +
          '<div class="hld-field"><label>Alt Text</label><input type="text" class="hld-banner-alt" value="' + escHtml(item.alt_text || '') + '" placeholder="Describe the banner for screen readers" /></div>' +
          '<div class="hld-field"><label>Link URL</label><input type="url" class="hld-banner-url" value="' + escHtml(item.url || '') + '" placeholder="https://..." /></div>' +
          '<div class="hld-field"><label>Open Link In</label><select class="hld-banner-target">' +
            '<option value="_self"' + (item.target !== '_blank' ? ' selected' : '') + '>Same tab</option>' +
            '<option value="_blank"' + (item.target === '_blank' ? ' selected' : '') + '>New tab</option>' +
          '</select></div>' +
          '<div class="hld-field"><label>Start Date</label><input type="date" class="hld-banner-start" value="' + escHtml(item.start_date || '') + '" /></div>' +
          '<div class="hld-field"><label>End Date</label><input type="date" class="hld-banner-end" value="' + escHtml(item.end_date || '') + '" /></div>' +
        '</div>' +
      '</div>'
    );
    $bannersList.append(card);
  }

  function bannerInitSortable() {
    if ($bannersList.hasClass('ui-sortable')) $bannersList.sortable('destroy');
    $bannersList.sortable({
      items: '.hld-banner-card',
      handle: '.hld-banner-card__thumb',
      placeholder: 'hld-banner-card ui-sortable-placeholder',
      tolerance: 'pointer',
      stop: function () {
        const order = [];
        $bannersList.find('.hld-banner-card').each(function () { order.push($(this).data('id')); });
        $.post(ajax, { action: 'hld_reorder_banners', nonce, stallion_id: bannerLoadedForId, order: order });
      }
    });
  }

  $('#hld-banner-add').on('click', function () {
    const id = currentHorseId();
    if (!id) return alert('Save the horse first before adding a banner.');

    if (bannerMediaFrame) { bannerMediaFrame.open(); return; }
    bannerMediaFrame = wp.media({
      title: 'Choose Banner Image (recommended 1360 × 150px)',
      button: { text: 'Use this image' },
      library: { type: 'image' },
      multiple: false,
    });
    bannerMediaFrame.on('select', function () {
      const attachment = bannerMediaFrame.state().get('selection').first().toJSON();
      $.post(ajax, {
        action: 'hld_add_banner', nonce, stallion_id: id, image_id: attachment.id,
      }, function (res) {
        if (!res.success) return alert(res.data || 'Failed to add banner.');
        $bannersEmpty.hide();
        bannerAddCard($.extend({}, res.data, { image_url: attachment.url }));
        bannerInitSortable();
      });
    });
    bannerMediaFrame.open();
  });

  $(document).on('click', '.hld-banner-card__del', function () {
    const $card = $(this).closest('.hld-banner-card');
    const id    = $card.data('id');
    if (!confirm('Remove this banner?')) return;
    $.post(ajax, { action: 'hld_delete_banner', nonce, id }, function (res) {
      if (!res.success) return;
      $card.remove();
      if (!$bannersList.find('.hld-banner-card').length) $bannersEmpty.show();
    });
  });

  $(document).on('blur change', '.hld-banner-alt, .hld-banner-url, .hld-banner-target, .hld-banner-start, .hld-banner-end', function () {
    const $card = $(this).closest('.hld-banner-card');
    const id    = $card.data('id');
    $.post(ajax, {
      action: 'hld_update_banner', nonce, id,
      alt_text:   $card.find('.hld-banner-alt').val(),
      url:        $card.find('.hld-banner-url').val(),
      target:     $card.find('.hld-banner-target').val(),
      start_date: $card.find('.hld-banner-start').val(),
      end_date:   $card.find('.hld-banner-end').val(),
    });
  });

  /* ══════════════════════════════════════════
     PEDIGREE — quick fill from pasted text
  ══════════════════════════════════════════ */

  const PED_LABELS = [
    ['Sire', 'ped_sire'], ['Dam', 'ped_dam'],
    ['Sire > Sire', 'ped_ss'], ['Sire > Dam', 'ped_sd'], ['Dam > Sire', 'ped_ds'], ['Dam > Dam', 'ped_dd'],
    ['Sire > Sire > Sire', 'ped_sss'], ['Sire > Sire > Dam', 'ped_ssd'],
    ['Sire > Dam > Sire', 'ped_sds'], ['Sire > Dam > Dam', 'ped_sdd'],
    ['Dam > Sire > Sire', 'ped_dss'], ['Dam > Sire > Dam', 'ped_dsd'],
    ['Dam > Dam > Sire', 'ped_dds'], ['Dam > Dam > Dam', 'ped_ddd'],
  ];

  $('#hld-ped-template').on('click', function () {
    const lines = PED_LABELS.map(function (pair) {
      const key = pair[1];
      const existing = (form[key] && form[key].val()) ? form[key].val().split('\n') : [];
      return '[' + pair[0] + ']\n' + (existing[0] || '') + '\n' + (existing[1] || '') + '\n';
    });
    $('#hld-ped-paste').val(lines.join('\n'));
  });

  const PED_KEY_BY_PATH = {
    s: 'ped_sire', d: 'ped_dam',
    ss: 'ped_ss', sd: 'ped_sd', ds: 'ped_ds', dd: 'ped_dd',
    sss: 'ped_sss', ssd: 'ped_ssd', sds: 'ped_sds', sdd: 'ped_sdd',
    dss: 'ped_dss', dsd: 'ped_dsd', dds: 'ped_dds', ddd: 'ped_ddd',
  };

  /** "Name (record)" or "Name, record" or just "Name" → { name, record }. */
  function splitPedEntry(text) {
    text = text.trim();
    let m = text.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (m) return { name: m[1].trim(), record: m[2].trim() };
    m = text.match(/^([^,]+),\s*((?:p|t)[.,].*)$/i); // "Name, p,3,1:50" style records only
    if (m) return { name: m[1].trim(), record: m[2].trim() };
    return { name: text, record: '' };
  }

  /**
   * Parses an indented "Sire: Name (record)" / "Dam: Name (record)" outline
   * (tree-drawing characters like │├└─ are ignored) into the 14 pedigree
   * fields, using indentation depth to reconstruct the tree — so it doesn't
   * matter whether the source used 2 spaces, 4 spaces, or box-drawing guides,
   * only that it gets deeper going down each branch.
   */
  function parsePedigreeOutline(raw) {
    const pathStack   = [];
    const indentStack = [];
    const found       = {};
    let anyLine = false;

    raw.split('\n').forEach(function (line) {
      const m = line.match(/^([^A-Za-z0-9]*)(Sire|Dam)\s*:\s*(.+)$/i);
      if (!m) return;
      anyLine = true;
      const indent = m[1].length;
      const side   = m[2].toLowerCase() === 'sire' ? 's' : 'd';
      const rest   = m[3];

      while (indentStack.length && indentStack[indentStack.length - 1] >= indent) {
        indentStack.pop();
        pathStack.pop();
      }
      pathStack.push(side);
      indentStack.push(indent);

      const path = pathStack.join('');
      if (path.length <= 3) found[path] = rest;
    });

    if (!anyLine) return null;

    const result = {};
    Object.keys(found).forEach(function (path) {
      const key = PED_KEY_BY_PATH[path];
      if (key) result[key] = splitPedEntry(found[path]);
    });
    return result;
  }

  $('#hld-ped-fill').on('click', function () {
    const raw = $('#hld-ped-paste').val();
    const $result = $('#hld-ped-fill-result').hide().removeClass('error success');
    if (!raw.trim()) { $result.addClass('error').text('Paste the filled-in template, or a Sire:/Dam: pedigree tree, first.').show(); return; }

    let filled = 0;

    if (raw.indexOf('[') >= 0 && raw.indexOf(']') >= 0) {
      // [Label] bracket template (from "Get Template").
      const parts = raw.split(/\[([^\]]+)\]/);
      const byLabel = {};
      for (let i = 1; i < parts.length; i += 2) {
        const label = parts[i].trim().toLowerCase().replace(/\s*>\s*/g, ' > ');
        const body  = (parts[i + 1] || '').split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length; });
        byLabel[label] = body;
      }
      PED_LABELS.forEach(function (pair) {
        const label = pair[0].toLowerCase();
        const key   = pair[1];
        if (!byLabel[label] || !byLabel[label].length) return;
        const name   = byLabel[label][0] || '';
        const record = byLabel[label][1] || '';
        if (form[key]) {
          form[key].val(record ? (name + '\n' + record) : name);
          filled++;
        }
      });
    } else {
      // Indented "Sire: Name (record)" / "Dam: Name (record)" outline.
      const parsed = parsePedigreeOutline(raw);
      if (parsed) {
        Object.keys(parsed).forEach(function (key) {
          const entry = parsed[key];
          if (form[key]) {
            form[key].val(entry.record ? (entry.name + '\n' + entry.record) : entry.name);
            filled++;
          }
        });
      }
    }

    if (filled) {
      $result.addClass('success').text('Filled ' + filled + ' of 14 pedigree boxes. Review them below, then save.').show();
    } else {
      $result.addClass('error').text('Couldn’t recognise that format. Use "Get Template" for a fill-in-the-blanks version, or paste an indented "Sire: Name (record)" / "Dam: Name (record)" tree.').show();
    }
  });

})(jQuery);
