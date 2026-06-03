/* global wp, HLInsiderData */
/**
 * HarnessLink Insider Panel — block editor UI.
 *
 * No build step: this script uses the WordPress packages already present on
 * the global `wp` object. The block itself is server-rendered (dynamic), so
 * here we only provide the editor `edit` function, the InspectorControls and
 * a live ServerSideRender preview. `save` returns null (output comes from PHP).
 */
( function ( wp ) {
	'use strict';

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var __ = wp.i18n.__;
	var registerBlockType = wp.blocks.registerBlockType;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var PanelColorSettings = wp.blockEditor.PanelColorSettings;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var ServerSideRender = wp.serverSideRender;

	var cmp = wp.components;
	var PanelBody = cmp.PanelBody;
	var TextControl = cmp.TextControl;
	var TextareaControl = cmp.TextareaControl;
	var ToggleControl = cmp.ToggleControl;
	var SelectControl = cmp.SelectControl;
	var RangeControl = cmp.RangeControl;
	var Button = cmp.Button;
	var Notice = cmp.Notice;

	var iconOptions = ( HLInsiderData && HLInsiderData.iconOptions ) || [
		{ value: 'lines', label: 'Lines / Article' },
	];
	var MAX_ITEMS = 8;

	// Attribute schema — mirrors block.json so the editor knows the types.
	var attributes = {
		eyebrow: { type: 'string', default: 'THE INSIDER' },
		headline: { type: 'string', default: 'Exclusive insights.\nEvery Thursday.' },
		subhead: { type: 'string', default: "In-depth stories, industry whispers and international coverage you won't find anywhere else." },
		badge_top: { type: 'string', default: 'SUBSCRIBE' },
		badge_bottom: { type: 'string', default: 'FREE' },
		show_badge: { type: 'boolean', default: true },
		cta_text: { type: 'string', default: 'Subscribe Now' },
		cta_url: { type: 'string', default: 'https://harnesslink.com/the-insider/editions/' },
		cta_new_tab: { type: 'boolean', default: false },
		week_label: { type: 'string', default: 'THIS WEEK ON THE INSIDER' },
		schedule_text: { type: 'string', default: 'Every Thursday 3PM' },
		show_schedule: { type: 'boolean', default: true },
		proof_text: { type: 'string', default: 'Join 7,000+ harness racing readers every Thursday.' },
		show_proof: { type: 'boolean', default: true },
		use_global: { type: 'boolean', default: true },
		pad_left: { type: 'number', default: 20 },
		offset_top: { type: 'number', default: 0 },
		hpos: { type: 'string', default: 'center' },
		fixed_height: { type: 'boolean', default: true },
		color_navy: { type: 'string', default: '#0e2455' },
		color_accent: { type: 'string', default: '#244287' },
		color_gold: { type: 'string', default: '#c9a24b' },
		color_ink: { type: 'string', default: '#16213f' },
		color_muted: { type: 'string', default: '#5b6478' },
		color_line: { type: 'string', default: '#e4e6ec' },
		items: {
			type: 'array',
			default: ( HLInsiderData && HLInsiderData.defaultItems ) || [],
		},
	};

	/**
	 * Build a single repeater row.
	 */
	function itemRow( props, item, index ) {
		var items = props.attributes.items || [];

		function update( changes ) {
			var next = items.map( function ( it, i ) {
				return i === index ? Object.assign( {}, it, changes ) : it;
			} );
			props.setAttributes( { items: next } );
		}

		function move( delta ) {
			var target = index + delta;
			if ( target < 0 || target >= items.length ) {
				return;
			}
			var next = items.slice();
			var tmp = next[ index ];
			next[ index ] = next[ target ];
			next[ target ] = tmp;
			props.setAttributes( { items: next } );
		}

		function remove() {
			var next = items.filter( function ( it, i ) {
				return i !== index;
			} );
			props.setAttributes( { items: next } );
		}

		return el(
			'div',
			{
				key: index,
				style: {
					border: '1px solid #e0e0e0',
					borderRadius: '4px',
					padding: '10px',
					marginBottom: '10px',
				},
			},
			el(
				'div',
				{ style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' } },
				el( 'strong', null, __( 'Item', 'hl-insider' ) + ' ' + ( index + 1 ) ),
				el(
					'div',
					null,
					el( Button, {
						icon: 'arrow-up-alt2',
						label: __( 'Move up', 'hl-insider' ),
						disabled: index === 0,
						onClick: function () { move( -1 ); },
						isSmall: true,
					} ),
					el( Button, {
						icon: 'arrow-down-alt2',
						label: __( 'Move down', 'hl-insider' ),
						disabled: index === items.length - 1,
						onClick: function () { move( 1 ); },
						isSmall: true,
					} ),
					el( Button, {
						icon: 'trash',
						label: __( 'Remove', 'hl-insider' ),
						onClick: remove,
						isDestructive: true,
						isSmall: true,
					} )
				)
			),
			el( TextControl, {
				label: __( 'Text', 'hl-insider' ),
				value: item.text || '',
				onChange: function ( value ) { update( { text: value } ); },
			} ),
			el( SelectControl, {
				label: __( 'Icon', 'hl-insider' ),
				value: item.icon || 'lines',
				options: iconOptions,
				onChange: function ( value ) { update( { icon: value } ); },
			} )
		);
	}

	function edit( props ) {
		var a = props.attributes;
		var items = a.items || [];

		function set( key ) {
			return function ( value ) {
				var obj = {};
				obj[ key ] = value;
				props.setAttributes( obj );
			};
		}

		function addItem() {
			if ( items.length >= MAX_ITEMS ) {
				return;
			}
			props.setAttributes( {
				items: items.concat( [ { text: '', icon: 'lines' } ] ),
			} );
		}

		var contentPanel = el(
			PanelBody,
			{ title: __( 'Content', 'hl-insider' ), initialOpen: true },
			el( TextControl, { label: __( 'Eyebrow', 'hl-insider' ), value: a.eyebrow, onChange: set( 'eyebrow' ) } ),
			el( TextareaControl, {
				label: __( 'Headline', 'hl-insider' ),
				help: __( 'Use a new line (or |) for a line break.', 'hl-insider' ),
				value: a.headline,
				onChange: set( 'headline' ),
			} ),
			el( TextareaControl, { label: __( 'Subhead', 'hl-insider' ), value: a.subhead, onChange: set( 'subhead' ) } )
		);

		var badgePanel = el(
			PanelBody,
			{ title: __( 'Badge', 'hl-insider' ), initialOpen: false },
			el( ToggleControl, { label: __( 'Show badge', 'hl-insider' ), checked: !! a.show_badge, onChange: set( 'show_badge' ) } ),
			el( TextControl, { label: __( 'Badge top', 'hl-insider' ), value: a.badge_top, onChange: set( 'badge_top' ) } ),
			el( TextControl, { label: __( 'Badge bottom', 'hl-insider' ), value: a.badge_bottom, onChange: set( 'badge_bottom' ) } )
		);

		var ctaPanel = el(
			PanelBody,
			{ title: __( 'Call to action', 'hl-insider' ), initialOpen: false },
			el( TextControl, { label: __( 'Button text', 'hl-insider' ), value: a.cta_text, onChange: set( 'cta_text' ) } ),
			el( TextControl, { label: __( 'Button URL', 'hl-insider' ), type: 'url', value: a.cta_url, onChange: set( 'cta_url' ) } ),
			el( ToggleControl, { label: __( 'Open in new tab', 'hl-insider' ), checked: !! a.cta_new_tab, onChange: set( 'cta_new_tab' ) } )
		);

		var itemsPanel = el(
			PanelBody,
			{ title: __( 'This week items', 'hl-insider' ), initialOpen: false },
			items.map( function ( item, index ) {
				return itemRow( props, item, index );
			} ),
			el(
				Button,
				{
					variant: 'secondary',
					onClick: addItem,
					disabled: items.length >= MAX_ITEMS,
				},
				items.length >= MAX_ITEMS
					? __( 'Maximum of 8 items', 'hl-insider' )
					: __( '+ Add item', 'hl-insider' )
			)
		);

		var footerPanel = el(
			PanelBody,
			{ title: __( 'Footer', 'hl-insider' ), initialOpen: false },
			el( ToggleControl, { label: __( 'Show schedule', 'hl-insider' ), checked: !! a.show_schedule, onChange: set( 'show_schedule' ) } ),
			el( TextControl, { label: __( 'Schedule text', 'hl-insider' ), value: a.schedule_text, onChange: set( 'schedule_text' ) } ),
			el( ToggleControl, { label: __( 'Show proof', 'hl-insider' ), checked: !! a.show_proof, onChange: set( 'show_proof' ) } ),
			el( TextControl, {
				label: __( 'Proof text', 'hl-insider' ),
				help: __( 'Wrap text in **double asterisks** to bold it; otherwise the first number is bolded automatically.', 'hl-insider' ),
				value: a.proof_text,
				onChange: set( 'proof_text' ),
			} )
		);

		var layoutPanel = el(
			PanelBody,
			{ title: __( 'Position & spacing', 'hl-insider' ), initialOpen: false },
			el( SelectControl, {
				label: __( 'Horizontal position', 'hl-insider' ),
				value: a.hpos || 'center',
				options: [
					{ value: 'left', label: __( 'Left (hug the left edge)', 'hl-insider' ) },
					{ value: 'center', label: __( 'Center', 'hl-insider' ) },
					{ value: 'right', label: __( 'Right', 'hl-insider' ) },
				],
				onChange: set( 'hpos' ),
			} ),
			el( RangeControl, {
				label: __( 'Left gutter (px)', 'hl-insider' ),
				help: __( 'Lower or go negative to pull the panel left, closer to the next widget.', 'hl-insider' ),
				value: a.pad_left,
				onChange: set( 'pad_left' ),
				min: -100,
				max: 200,
			} ),
			el( RangeControl, {
				label: __( 'Vertical offset (px)', 'hl-insider' ),
				help: __( 'Negative pulls the panel up to close the gap above it.', 'hl-insider' ),
				value: a.offset_top,
				onChange: set( 'offset_top' ),
				min: -200,
				max: 200,
			} ),
			el( ToggleControl, {
				label: __( 'Fixed height (desktop)', 'hl-insider' ),
				help: __( 'Locks the card to 537px on large screens.', 'hl-insider' ),
				checked: !! a.fixed_height,
				onChange: set( 'fixed_height' ),
			} )
		);

		var colorPanel = el( PanelColorSettings, {
			title: __( 'Colors', 'hl-insider' ),
			initialOpen: false,
			colorSettings: [
				{ value: a.color_navy, onChange: set( 'color_navy' ), label: __( 'Navy', 'hl-insider' ) },
				{ value: a.color_accent, onChange: set( 'color_accent' ), label: __( 'Accent', 'hl-insider' ) },
				{ value: a.color_gold, onChange: set( 'color_gold' ), label: __( 'Gold', 'hl-insider' ) },
				{ value: a.color_ink, onChange: set( 'color_ink' ), label: __( 'Ink (headings)', 'hl-insider' ) },
				{ value: a.color_muted, onChange: set( 'color_muted' ), label: __( 'Muted text', 'hl-insider' ) },
				{ value: a.color_line, onChange: set( 'color_line' ), label: __( 'Lines / borders', 'hl-insider' ) },
			],
		} );

		var blockProps = useBlockProps ? useBlockProps() : {};
		var useGlobal = a.use_global !== false;

		// Top panel: choose between dashboard-driven content and per-block overrides.
		var sourcePanel = el(
			PanelBody,
			{ title: __( 'Content source', 'hl-insider' ), initialOpen: true },
			el( ToggleControl, {
				label: __( 'Use global settings (dashboard)', 'hl-insider' ),
				help: useGlobal
					? __( 'On: this panel shows the content from the Insider Panel dashboard. Turn off to customise just this one.', 'hl-insider' )
					: __( 'Off: this panel uses the custom fields below instead of the dashboard.', 'hl-insider' ),
				checked: useGlobal,
				onChange: set( 'use_global' ),
			} ),
			useGlobal
				? el(
						Notice,
						{ status: 'info', isDismissible: false },
						__( 'Edit the shared content under the "Insider Panel" menu in the admin sidebar.', 'hl-insider' )
				  )
				: null
		);

		// When using global settings, only show the source panel.
		var panels = useGlobal
			? [ sourcePanel ]
			: [ sourcePanel, contentPanel, badgePanel, ctaPanel, itemsPanel, footerPanel, layoutPanel, colorPanel ];

		return el(
			Fragment,
			null,
			el.apply( null, [ InspectorControls, null ].concat( panels ) ),
			el(
				'div',
				blockProps,
				el( ServerSideRender, {
					block: 'hl-insider/panel',
					attributes: a,
				} )
			)
		);
	}

	registerBlockType( 'hl-insider/panel', {
		apiVersion: 3,
		title: __( 'Insider Panel', 'hl-insider' ),
		category: 'widgets',
		icon: 'megaphone',
		description: __( 'The Insider subscribe panel with editable text, items, icons and colours.', 'hl-insider' ),
		keywords: [ 'insider', 'subscribe', 'harnesslink', 'newsletter' ],
		supports: {
			html: false,
			align: [ 'left', 'center', 'right', 'wide', 'full' ],
		},
		attributes: attributes,
		edit: edit,
		save: function () {
			return null;
		},
	} );
} )( window.wp );
