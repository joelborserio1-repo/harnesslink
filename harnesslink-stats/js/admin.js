(function($) {
    /* ── PIN pad ── */
    var pin = '';
    function updateDots() {
        $('#hl-pin-dots span').each(function(i){ $(this).toggleClass('filled', i < pin.length); });
    }
    function submitPin() {
        $.post(hlStats.ajaxUrl, { action:'hl_verify_pin', nonce:hlStats.nonce, pin:pin }, function(r) {
            if (r.success) { location.reload(); }
            else { pin=''; updateDots(); $('#hl-pin-error').show(); }
        });
    }
    $(document).on('click', '.hl-pin-key', function() {
        var k = $(this).data('key').toString();
        if (k === '⌫' || k === '?') { pin = pin.slice(0,-1); $('#hl-pin-error').hide(); }
        else if (k !== '' && pin.length < 4) { pin += k; }
        updateDots();
        if (pin.length === 4) setTimeout(submitPin, 120);
    });
    $(document).on('keydown', function(e) {
        if (!$('.hl-pin-pad').length) return;
        if (e.key >= '0' && e.key <= '9' && pin.length < 4) { pin += e.key; updateDots(); $('#hl-pin-error').hide(); if(pin.length===4) setTimeout(submitPin,120); }
        else if (e.key === 'Backspace') { pin=pin.slice(0,-1); updateDots(); }
    });

    /* ── Lock button ── */
    $(document).on('click', '#hl-lock-btn', function() {
        $.post(hlStats.ajaxUrl, { action:'hl_lock', nonce:hlStats.nonce }, function(r) {
            if (r.success) location.reload();
        });
    });
})(jQuery);
