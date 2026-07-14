<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap hld-wrap">

  <div class="hld-admin-header">
    <div class="hld-admin-header__brand">
      <span class="hld-logo">HL</span>
      <div>
        <h1>Master Sync</h1>
        <p>Sync the stallion directory to the master list. Always preview first — nothing changes until you apply.</p>
      </div>
    </div>
  </div>

  <div class="hld-settings-card">
    <h2 style="margin-top:0;">How this works</h2>
    <ul style="margin:0 0 4px 18px;line-height:1.7;">
      <li><strong>Protected:</strong> paying &amp; featured stallions are never changed or deleted.</li>
      <li><strong>Update + Add:</strong> matching free listings are updated; stallions in the sheet that don't exist are added.</li>
      <li><strong>Full replace:</strong> free listings <em>not</em> in the sheet are deleted, so the directory matches the master (plus protected listings).</li>
      <li>Stallions standing in several countries are merged into one listing with the correct stud per country.</li>
    </ul>
    <p class="hld-field-hint">Bundled master: <code>data/master-stallions.csv</code> (169 stallions, rows 1–170). Upload a CSV below to sync from a different file instead.</p>

    <div class="hld-field" style="margin:14px 0;">
      <label style="font-weight:600;display:block;margin-bottom:6px;">Optional: upload a different master CSV</label>
      <input type="file" id="hld-master-file" accept=".csv" />
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <button type="button" class="hld-btn hld-btn--secondary" id="hld-master-preview">Preview Changes (dry run)</button>
      <button type="button" class="hld-btn hld-btn--primary" id="hld-master-apply" disabled>Apply Changes</button>
    </div>
    <div id="hld-master-status" class="hld-import-result" style="display:none;margin-top:14px;"></div>
  </div>

  <div class="hld-settings-card" id="hld-master-report" style="display:none;margin-top:18px;">
    <h2 style="margin-top:0;">Preview</h2>
    <div class="hld-stats" id="hld-master-counts"></div>

    <div id="hld-master-warnings" style="display:none;margin:12px 0;padding:12px 14px;background:#FFF7E6;border:1px solid #F5D9A8;border-radius:10px;font-size:13px;color:#8A5B00;"></div>

    <div class="hld-master-cols">
      <div class="hld-master-col">
        <h3>Add <span id="hld-c-add" class="hld-master-badge"></span></h3>
        <div class="hld-master-list" id="hld-list-add"></div>
      </div>
      <div class="hld-master-col">
        <h3>Update <span id="hld-c-update" class="hld-master-badge"></span></h3>
        <div class="hld-master-list" id="hld-list-update"></div>
      </div>
      <div class="hld-master-col">
        <h3>Delete <span id="hld-c-delete" class="hld-master-badge hld-master-badge--danger"></span></h3>
        <div class="hld-master-list" id="hld-list-delete"></div>
      </div>
      <div class="hld-master-col">
        <h3>Skipped (protected) <span id="hld-c-skip" class="hld-master-badge hld-master-badge--ok"></span></h3>
        <div class="hld-master-list" id="hld-list-skip"></div>
      </div>
    </div>
  </div>

</div>

<script>
jQuery(function ($) {
  // HLD_Admin is localized onto the footer-loaded admin script; fall back to
  // sane defaults so the buttons always bind even if load order varies.
  var CFG = (typeof HLD_Admin !== 'undefined') ? HLD_Admin : {};
  const ajax  = CFG.ajax_url || (window.ajaxurl || '');
  const nonce = CFG.nonce || '';
  let lastPreviewOk = false;

  if (!ajax || !nonce) {
    $('#hld-master-status').addClass('error').show().text(
      'Could not initialise (admin script not loaded). Hard-refresh the page (Cmd/Ctrl+Shift+R) and try again.'
    );
  }

  function esc(v){ return $('<div>').text(v==null?'':String(v)).html(); }

  function fillList(id, arr) {
    if (!arr || !arr.length) { $('#'+id).html('<em class="hld-master-empty">None</em>'); return; }
    $('#'+id).html(arr.map(n => '<div class="hld-master-item">'+esc(n)+'</div>').join(''));
  }

  function buildForm(confirm) {
    const fd = new FormData();
    fd.append('action', 'hld_master_sync');
    fd.append('nonce', nonce);
    if (confirm) fd.append('confirm', '1');
    const f = document.getElementById('hld-master-file').files[0];
    if (f) fd.append('master_csv', f);
    return fd;
  }

  function renderReport(d) {
    const c = d.counts || {};
    $('#hld-master-counts').html(
      stat(c.add,'To Add') + stat(c.update,'To Update') +
      stat(c.delete,'To Delete','hld-stat--danger') + stat(c.skip,'Protected','hld-stat--green') +
      stat(c.sheet,'In Sheet') + stat(c.existing,'Existing')
    );
    $('#hld-c-add').text(c.add||0);
    $('#hld-c-update').text(c.update||0);
    $('#hld-c-delete').text(c.delete||0);
    $('#hld-c-skip').text(c.skip||0);
    fillList('hld-list-add', d.add);
    fillList('hld-list-update', d.update);
    fillList('hld-list-delete', d.delete);
    fillList('hld-list-skip', d.skip);
    if (d.warnings && d.warnings.length) {
      $('#hld-master-warnings').show().html('<strong>'+d.warnings.length+' warning(s):</strong><br>' + d.warnings.map(esc).join('<br>'));
    } else {
      $('#hld-master-warnings').hide();
    }
    $('#hld-master-report').show();
  }

  function stat(num, label, cls) {
    return '<div class="hld-stat '+(cls||'')+'"><span class="hld-stat__num">'+(num||0)+'</span><span class="hld-stat__label">'+label+'</span></div>';
  }

  function run(confirm, $btn) {
    const $status = $('#hld-master-status').removeClass('error success').hide();
    const label = $btn.text();
    $btn.prop('disabled', true).text(confirm ? 'Applying…' : 'Previewing…');
    $.ajax({
      url: ajax, type: 'POST', data: buildForm(confirm), processData: false, contentType: false,
      success: function (res) {
        $btn.prop('disabled', false).text(label);
        if (!res.success) { $status.addClass('error').text(res.data || 'Failed.').show(); return; }
        renderReport(res.data);
        if (confirm) {
          lastPreviewOk = false;
          $('#hld-master-apply').prop('disabled', true);
          $status.addClass('success').text('Applied. ' + (res.data.counts.add) + ' added, ' + (res.data.counts.update) + ' updated, ' + (res.data.counts.delete) + ' deleted, ' + (res.data.counts.skip) + ' protected.').show();
        } else {
          lastPreviewOk = true;
          $('#hld-master-apply').prop('disabled', false);
          $status.addClass('success').text('Preview ready. Review below, then Apply. Nothing has changed yet.').show();
        }
      },
      error: function () {
        $btn.prop('disabled', false).text(label);
        $status.addClass('error').text('Server error.').show();
      }
    });
  }

  $('#hld-master-preview').on('click', function () { run(false, $(this)); });

  $('#hld-master-apply').on('click', function () {
    if (!lastPreviewOk) { alert('Run a preview first.'); return; }
    const c = $('#hld-c-delete').text();
    if (!confirm('This will DELETE ' + c + ' free stallion listings and update/add the rest. Paying & featured listings are protected. Continue?')) return;
    run(true, $(this));
  });

  // Re-preview needed if the file changes.
  $('#hld-master-file').on('change', function () {
    lastPreviewOk = false;
    $('#hld-master-apply').prop('disabled', true);
  });
});
</script>
