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
  }

  $(document).on('change', '#hld-directory_type', function () {
    applyTypeSchema($(this).val());
  });

  function closeModal() {
    overlay.hide();
    resetForm();
    galleryReset();
  }

  function resetForm() {
    $.each(form, function (k, el) {
      if (el.is(':checkbox')) el.prop('checked', false);
      else if (k === 'directory_type') el.val(el.data('default') || 'stallion');
      else el.val('');
    });
    updateProfileImagePreview('');
  }

  function fillForm(s) {
    $.each(form, function (k, el) {
      if (k === 'is_paying' || k === 'is_featured') el.prop('checked', s[k] == 1);
      else el.val(s[k] || '');
    });
    updateProfileImagePreview(s.profile_image || '');
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

  /* ══ MODAL TABS ══ */
  function switchTab(id) {
    $('.hld-tab').removeClass('active');
    $('.hld-tab-panel').removeClass('active');
    $('.hld-tab[data-tab="' + id + '"]').addClass('active');
    $('#hld-tab-' + id).addClass('active');
  }
  $(document).on('click', '.hld-tab', function () {
    switchTab($(this).data('tab'));
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
     GALLERY
  ══════════════════════════════════════════ */

  let currentStallionId = 0;
  let wpMediaFrame       = null;

  const $galleryGrid     = $('#hld-gallery-grid');
  const $galleryEmpty    = $('#hld-gallery-empty-note');
  const $galleryHint     = $('#hld-gallery-hint');

  /* Reset gallery state when modal closes / new stallion opened */
  function galleryReset() {
    currentStallionId = 0;
    $galleryGrid.empty();
    $galleryEmpty.show();
    $galleryHint.hide();
    $('#hld-gallery-url-input').val('');
  }

  /* Load gallery items for existing stallion */
  function galleryLoad(stallionId) {
    currentStallionId = stallionId;
    $galleryGrid.empty();
    $.post(ajax, { action: 'hld_get_gallery', nonce, stallion_id: stallionId }, function (res) {
      if (!res.success) return;
      const items = res.data;
      if (!items || !items.length) {
        $galleryEmpty.show();
        $galleryHint.hide();
        return;
      }
      $galleryEmpty.hide();
      $galleryHint.show();
      items.forEach(function (item) { galleryAddCard(item); });
      galleryInitSortable();
    });
  }

  /* Build a single gallery card DOM element */
  function galleryAddCard(item) {
    const isVideo = item.media_type === 'video';
    const thumb   = isVideo
      ? '<div class="hld-gallery-card__video-thumb"><span class="hld-play-icon">&#9654;</span></div>'
      : '<img class="hld-gallery-card__thumb" src="' + escHtml(item.url) + '" alt="" loading="lazy" />';

    const card = $(
      '<div class="hld-gallery-card" data-id="' + item.id + '">' +
        thumb +
        '<button type="button" class="hld-gallery-card__del" title="Remove">✕</button>' +
        '<div class="hld-gallery-card__body">' +
          '<div class="hld-gallery-card__type">' + (isVideo ? 'Video' : 'Image') + '</div>' +
          '<input class="hld-gallery-card__caption" type="text" value="' + escHtml(item.caption || '') + '" placeholder="Add caption…" />' +
        '</div>' +
      '</div>'
    );
    $galleryGrid.append(card);
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* Sortable drag-to-reorder */
  function galleryInitSortable() {
    if ($galleryGrid.hasClass('ui-sortable')) $galleryGrid.sortable('destroy');
    $galleryGrid.sortable({
      items: '.hld-gallery-card',
      placeholder: 'hld-gallery-card ui-sortable-placeholder',
      tolerance: 'pointer',
      stop: function () {
        const order = [];
        $galleryGrid.find('.hld-gallery-card').each(function () {
          order.push($(this).data('id'));
        });
        $.post(ajax, {
          action:      'hld_reorder_gallery',
          nonce:       nonce,
          stallion_id: currentStallionId,
          order:       order,
        });
      }
    });
  }

  /* ── Gallery tab click: load items for existing stallion ── */
  $(document).on('click', '.hld-tab[data-tab="gallery"]', function () {
    const stallionId = parseInt($('#hld-id').val()) || 0;
    if (stallionId && stallionId !== currentStallionId) {
      galleryLoad(stallionId);
    } else if (!stallionId) {
      $galleryEmpty.text('Save the stallion first, then add gallery items.').show();
      $galleryHint.hide();
    }
  });

  /* ── Add via URL ── */
  $('#hld-gallery-url-add').on('click', function () {
    const url  = $('#hld-gallery-url-input').val().trim();
    const type = $('#hld-gallery-type-select').val();
    const stallionId = parseInt($('#hld-id').val()) || 0;

    if (!url) return alert('Please paste a URL first.');
    if (!stallionId) return alert('Save the stallion first before adding gallery items.');

    $.post(ajax, {
      action:      'hld_add_gallery_item',
      nonce:       nonce,
      stallion_id: stallionId,
      url:         url,
      media_type:  type,
      caption:     '',
    }, function (res) {
      if (!res.success) return alert(res.data || 'Failed to add item.');
      $galleryEmpty.hide();
      $galleryHint.show();
      galleryAddCard(res.data);
      galleryInitSortable();
      $('#hld-gallery-url-input').val('');
    });
  });

  /* ── Add via WP Media Library ── */
  $('#hld-gallery-media-btn').on('click', function () {
    const stallionId = parseInt($('#hld-id').val()) || 0;
    if (!stallionId) return alert('Save the stallion first before adding gallery items.');

    if (wpMediaFrame) {
      wpMediaFrame.open();
      return;
    }

    wpMediaFrame = wp.media({
      title:    'Select Images or Videos',
      button:   { text: 'Add to Gallery' },
      library:  { type: ['image', 'video'] },
      multiple: true,
    });

    wpMediaFrame.on('select', function () {
      const attachments = wpMediaFrame.state().get('selection').toArray();
      let pending = attachments.length;

      attachments.forEach(function (attachment) {
        const a = attachment.toJSON();
        const isVideo = a.type === 'video';

        $.post(ajax, {
          action:        'hld_add_gallery_item',
          nonce:         nonce,
          stallion_id:   stallionId,
          attachment_id: a.id,
          url:           a.url,
          media_type:    isVideo ? 'video' : 'image',
          caption:       a.caption || '',
        }, function (res) {
          if (res.success) {
            $galleryEmpty.hide();
            $galleryHint.show();
            galleryAddCard(res.data);
          }
          pending--;
          if (pending === 0) galleryInitSortable();
        });
      });
    });

    wpMediaFrame.open();
  });

  /* ── Delete gallery item ── */
  $(document).on('click', '.hld-gallery-card__del', function (e) {
    e.stopPropagation();
    const $card = $(this).closest('.hld-gallery-card');
    const id    = $card.data('id');
    if (!confirm('Remove this media item?')) return;
    $.post(ajax, { action: 'hld_delete_gallery_item', nonce, id }, function (res) {
      if (res.success) {
        $card.remove();
        if (!$galleryGrid.find('.hld-gallery-card').length) {
          $galleryEmpty.text('No media added yet.').show();
          $galleryHint.hide();
        }
      }
    });
  });

  /* ── Save caption on blur ── */
  $(document).on('blur', '.hld-gallery-card__caption', function () {
    const $card   = $(this).closest('.hld-gallery-card');
    const id      = $card.data('id');
    const caption = $(this).val();
    $.post(ajax, { action: 'hld_update_gallery_caption', nonce, id, caption });
  });

})(jQuery);
