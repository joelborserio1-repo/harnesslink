/* Article Duplicator – Admin JS */
(function ($) {
    'use strict';

    /* =========================================================
       PREVIEW ARTICLES
    ========================================================= */
    $('#artdup-preview-btn').on('click', function () {
        var $btn = $(this);
        $btn.prop('disabled', true).html('<span class="artdup-spinner"></span> ' + AD.strings.previewing);
        $('#artdup-preview-results').empty();
        $('#artdup-import-results').hide();
        $('#artdup-import-all-btn').hide();
        $('#artdup-progress-bar-wrap').hide();

        $.post(AD.ajaxurl, {
            action: 'ad_preview_articles',
            nonce:  AD.nonce
        }, function (res) {
            $btn.prop('disabled', false).html('<span class="dashicons dashicons-visibility"></span> Preview Articles');

            if (!res.success) {
                showResult('#artdup-import-results', 'error', '&#10007; ' + res.data.message);
                return;
            }

            var articles = res.data.articles;
            if (!articles || articles.length === 0) {
                showResult('#artdup-import-results', 'error', 'No articles found at source URL.');
                return;
            }

            renderArticleGrid(articles);
            $('#artdup-import-all-btn').show().data('articles', articles);
        }).fail(function () {
            $btn.prop('disabled', false).html('<span class="dashicons dashicons-visibility"></span> Preview Articles');
            showResult('#artdup-import-results', 'error', 'Request failed. Check server logs.');
        });
    });

    /* =========================================================
       IMPORT ALL
    ========================================================= */
    $('#artdup-import-all-btn').on('click', function () {
        if (!confirm(AD.strings.confirm_all)) return;

        var $btn = $(this);
        $btn.prop('disabled', true).html('<span class="artdup-spinner"></span> ' + AD.strings.importing);
        $('#artdup-preview-btn').prop('disabled', true);
        $('#artdup-progress-bar-wrap').show();
        updateProgress(0, 'Starting import…');

        $.post(AD.ajaxurl, {
            action:    'ad_import_articles',
            nonce:     AD.nonce,
            author_id: $('#artdup-author').val() || 0
        }, function (res) {
            $btn.prop('disabled', false).html('<span class="dashicons dashicons-yes"></span> Import All');
            $('#artdup-preview-btn').prop('disabled', false);
            updateProgress(100, 'Done!');

            if (!res.success) {
                showResult('#artdup-import-results', 'error', '&#10007; ' + res.data.message);
                return;
            }

            var d = res.data;
            var html = '<div class="artdup-import-summary">';
            html += '<div class="artdup-import-count"><strong style="color:#057a55">' + d.imported + '</strong><span>Imported</span></div>';
            html += '<div class="artdup-import-count"><strong style="color:#c27803">' + d.skipped + '</strong><span>Skipped</span></div>';
            html += '<div class="artdup-import-count"><strong style="color:#c81e1e">' + d.errors + '</strong><span>Errors</span></div>';
            html += '</div>';

            if (d.details && d.details.length) {
                html += '<ul style="margin:0;padding:0;list-style:none;">';
                d.details.forEach(function (item) {
                    var icon = item.status === 'imported' ? '&#10003;' : (item.status === 'skipped' ? '&#8212;' : '&#10007;');
                    var color = item.status === 'imported' ? '#057a55' : (item.status === 'skipped' ? '#c27803' : '#c81e1e');
                    html += '<li style="padding:4px 0;border-bottom:1px solid #f3f4f6;font-size:.82rem;">';
                    html += '<span style="color:' + color + ';font-weight:700;margin-right:6px;">' + icon + '</span>';
                    html += '<strong>' + escHtml(item.title || item.url || 'Article') + '</strong>';
                    if (item.edit_url) html += ' &mdash; <a href="' + item.edit_url + '" target="_blank">Edit Post</a>';
                    if (item.message) html += ' <span style="color:#9ca3af">(' + escHtml(item.message) + ')</span>';
                    html += '</li>';
                });
                html += '</ul>';
            }

            showResult('#artdup-import-results', 'success', html);

            // Mark cards
            if (d.details) {
                d.details.forEach(function (item) {
                    if (item.status === 'imported' && item.post_id) {
                        $('.artdup-article-card[data-url]').filter(function () {
                            return $(this).data('url') === item.url;
                        }).addClass('artdup-imported');
                    }
                });
            }
        }).fail(function () {
            $btn.prop('disabled', false).html('<span class="dashicons dashicons-yes"></span> Import All');
            $('#artdup-preview-btn').prop('disabled', false);
            showResult('#artdup-import-results', 'error', 'Request failed or timed out.');
        });
    });

    /* =========================================================
       SINGLE ARTICLE IMPORT
    ========================================================= */
    $('#artdup-import-single').on('click', function () {
        var url = $('#artdup-single-url').val().trim();
        if (!url) { alert('Please enter a URL.'); return; }

        var $btn = $(this);
        $btn.prop('disabled', true).html('<span class="artdup-spinner"></span> Importing…');

        $.post(AD.ajaxurl, {
            action:      'ad_import_single',
            nonce:       AD.nonce,
            article_url: url,
            author_id:   $('#artdup-author').val() || 0
        }, function (res) {
            $btn.prop('disabled', false).html('<span class="dashicons dashicons-cloud-download"></span> Import');

            if (!res.success) {
                showResult('#artdup-single-result', 'error', '&#10007; ' + res.data.message);
            } else {
                showResult('#artdup-single-result', 'success',
                    '&#10003; ' + res.data.message +
                    (res.data.edit_url ? ' <a href="' + res.data.edit_url + '" target="_blank">Edit Post #' + res.data.post_id + '</a>' : '')
                );
                $('#artdup-single-url').val('');
            }
        }).fail(function () {
            $btn.prop('disabled', false).html('<span class="dashicons dashicons-cloud-download"></span> Import');
            showResult('#artdup-single-result', 'error', 'Request failed.');
        });
    });

    /* =========================================================
       TEST CONNECTION
    ========================================================= */
    $('#artdup-test-btn').on('click', function () {
        var $btn = $(this);
        $btn.prop('disabled', true).html('<span class="artdup-spinner"></span> ' + AD.strings.testing);

        $.post(AD.ajaxurl, {
            action: 'ad_test_connection',
            nonce:  AD.nonce
        }, function (res) {
            $btn.prop('disabled', false).html('<span class="dashicons dashicons-admin-plugins"></span> Test Connection');
            var type = res.success ? 'success' : 'error';
            showResult('#artdup-import-results', type, (res.success ? '&#10003; ' : '&#10007; ') + res.data.message);
        }).fail(function () {
            $btn.prop('disabled', false).html('<span class="dashicons dashicons-admin-plugins"></span> Test Connection');
            showResult('#artdup-import-results', 'error', 'Request failed.');
        });
    });

    /* =========================================================
       CLEAR LOG
    ========================================================= */
    $('#artdup-clear-log-btn').on('click', function () {
        if (!confirm(AD.strings.confirm_log)) return;

        $.post(AD.ajaxurl, {
            action: 'ad_clear_logs',
            nonce:  AD.nonce
        }, function (res) {
            if (res.success) location.reload();
        });
    });

    /* =========================================================
       HELPERS
    ========================================================= */

    function showResult(selector, type, html) {
        $(selector).removeClass('success error').addClass(type).html(html).show();
    }

    function updateProgress(pct, text) {
        $('#artdup-progress-bar-inner').css('width', pct + '%');
        $('#artdup-progress-text').text(text);
    }

    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderArticleGrid(articles) {
        var $grid = $('#artdup-preview-results').empty();
        articles.forEach(function (a) {
            var thumb = '';
            if (a.thumbnail) {
                thumb = '<img src="' + escHtml(a.thumbnail) + '" class="artdup-article-thumb" onerror="this.style.display=\'none\'" />';
            } else {
                thumb = '<div class="artdup-article-thumb-placeholder"><span class="dashicons dashicons-format-image"></span></div>';
            }

            var date = a.date ? '<span>' + escHtml(a.date) + '</span>' : '';
            var excerpt = a.excerpt ? '<div class="artdup-article-excerpt">' + escHtml(a.excerpt.substring(0,120)) + (a.excerpt.length > 120 ? '…' : '') + '</div>' : '';

            var card = '<div class="artdup-article-card" data-url="' + escHtml(a.url) + '">'
                + thumb
                + '<div class="artdup-article-body">'
                + '<p class="artdup-article-title">' + escHtml(a.title || 'Untitled') + '</p>'
                + '<div class="artdup-article-meta">' + date + '</div>'
                + excerpt
                + '<div class="artdup-article-footer">'
                + '<a href="' + escHtml(a.url) + '" target="_blank">View Source &#8599;</a>'
                + '</div></div></div>';

            $grid.append(card);
        });
    }

})(jQuery);

/* =========================================================
   SOURCE SWITCHER  (Settings page)
   Shows/hides the custom URL row and source hint text
   when the user changes the "News Source" dropdown.
========================================================= */
(function($){
    'use strict';

    function artdupUpdateSourceUI() {
        var slug = $('#artdup-source-slug').val();

        // Custom URL row: visible only when no pre-configured source selected
        if (slug === '') {
            $('#artdup-custom-url-row').show();
        } else {
            $('#artdup-custom-url-row').hide();
        }

        // Source hint paragraphs
        $('.artdup-source-hint').hide();
        if (slug !== '') {
            $('.artdup-source-hint[data-slug="' + slug + '"]').show();
        }
    }

    $(document).ready(function(){
        // Run on load to set correct initial state
        if ($('#artdup-source-slug').length) {
            artdupUpdateSourceUI();
            $('#artdup-source-slug').on('change', artdupUpdateSourceUI);
        }
    });

}(jQuery));

/* =========================================================
   SCHEDULE MODE UI  (Settings page)
   Toggles shared-interval vs per-source rows,
   shows/hides the alternating hint, and collapses
   all schedule options when auto-schedule is unchecked.
========================================================= */
(function($){
    'use strict';

    function artdupUpdateScheduleUI() {
        var mode    = $('input[name="ad_schedule_mode"]:checked').val();
        var enabled = $('#artdup-auto-schedule').is(':checked');

        // Show/hide the whole schedule block
        if (enabled) {
            $('#artdup-schedule-options').show();
        } else {
            $('#artdup-schedule-options').hide();
            return;
        }

        // Show/hide shared interval row
        if (mode === 'independent') {
            $('.artdup-shared-interval').hide();
            $('.artdup-independent-intervals').show();
        } else {
            $('.artdup-shared-interval').show();
            $('.artdup-independent-intervals').hide();
        }

        // Alternating hint inside shared interval row
        if (mode === 'alternating') {
            $('.artdup-alternating-hint').show();
        } else {
            $('.artdup-alternating-hint').hide();
        }
    }

    $(document).ready(function(){
        if ($('#artdup-auto-schedule').length) {
            artdupUpdateScheduleUI();
            $('#artdup-auto-schedule').on('change', artdupUpdateScheduleUI);
            $('.artdup-smode-radio').on('change', artdupUpdateScheduleUI);
        }
    });

}(jQuery));
