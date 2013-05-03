var Historical = function(args) {
	LOG.info('Historical.js::constructor: Historical class is initializing.');
	var me = (this === window) ? {} : this;

	me.name = 'historical';
	me.isActive = false;
	me.collapseDiv = args.collapseDiv;
	me.shareMenuDiv = args.shareMenuDiv;
	me.viewMenuDiv = args.viewMenuDiv;
	me.boxLayerName = 'historical-box-layer';
	me.serverName = 'cida-geoserver';
	me.boxBorderColor = '#FF0000';
	me.highlightedBorderColor = '#00FF00';
	me.visibleLayers = [];
	me.boxLayer = new OpenLayers.Layer.Boxes(me.boxLayerName, {
		displayInLayerSwitcher: false
	});

	LOG.debug('Historical.js::constructor: Historical class initialized.');
	return $.extend(me, {
		init: function() {
			LOG.debug('Historical.js::init()');
			me.bindParentMenu();
			me.bindViewMenu();
			me.bindShareMenu();
		},
		enterSection: function(args) {
			LOG.debug('Historical.js::enterSection(): Adding box layer to map');
			args = args || {};
			CONFIG.map.getMap().addLayer(me.boxLayer);
			me.isActive = true;
			var callbacks = args.callbacks || {
				success: [
					function(data, textStatus, jqXHR) {
						me.displayBoxMarkers();
					}
				],
				error: [
					function(data, textStatus, jqXHR) {
						LOG.error('Historical.js:: Got an error while getting WMS GetCapabilities from server');
					}
				]
			};
			if (!CONFIG.ows.servers[me.serverName].data.wms.capabilities.object.capability) {
				CONFIG.ows.getWMSCapabilities({
					server: me.serverName,
					callbacks: callbacks
				});
			} else {
				me.displayBoxMarkers();
			}

		},
		leaveSection: function() {
			LOG.debug('Historical.js::leaveSection(): Removing box layer from map');
			me.removeBoxLayer();
			me.isActive = false;
			me.visibleLayers.each(function(layer) {
				CONFIG.map.getMap().removeLayer(layer);
			});
			me.visibleLayers = [];
		},
		updateFromSession: function() {
			if (CONFIG.session.objects.view.activeParentMenu === me.name) {
				if (!me.collapseDiv.find('>:last-child').hasClass('in')) {
					me.collapseDiv.find('>:last-child').addClass('in');
					me.collapseDiv.find('>:last-child').attr('style', 'height:auto')
				}

				me.enterSection({
					callbacks: {
						success: [
							function(data, textStatus, jqXHR) {
								var activeLayers = CONFIG.session.objects.view.historical.activeLayers;
								if (activeLayers.length) {
									me.removeBoxLayer();
									var bounds = new OpenLayers.Bounds();
									activeLayers.each(function(layer) {
										var layer = CONFIG.ows.servers[me.serverName].data.wms.capabilities.object.capability.layers.find(function(l) {
											return l.name === layer.name;
										});
										me.displayData({
											'title': layer.title,
											'name': layer.name,
											'layers': layer.layers
										});
										bounds.extend(new OpenLayers.Bounds(layer.bbox['EPSG:900913'].bbox));
									});
									CONFIG.map.getMap().zoomToExtent(bounds);

								}
							}
						],
						error: [
							function(data, textStatus, jqXHR) {
								LOG.error('OnReady.js:: Got an error while getting WMS GetCapabilities from server');
							}
						]
					}
				});
			} else {
				if (me.collapseDiv.find('>:last-child').hasClass('in')) {
					me.collapseDiv.find('>:last-child').removeClass('in');
					me.collapseDiv.find('>:last-child').removeAttr('style');
				}
			}
		},
		bindParentMenu: function() {
			me.collapseDiv.on({
				'show': function(e) {
					if (e.target.className !== 'accordion-group-item') {
						LOG.debug('Historical.js:: Entering historical section.');
						CONFIG.session.objects.view.activeParentMenu = me.name;
						me.enterSection();
					}
				},
				'hide': function(e) {
					if (e.target.className !== 'accordion-group-item') {
						LOG.debug('Historical.js:: Leaving historical section.');
						me.leaveSection();
					}
				}
			});
		},
		bindViewMenu: function() {
			me.viewMenuDiv.popover({
				html: true,
				placement: 'right',
				trigger: 'manual',
				title: 'View Historical',
				container: 'body',
				content: "<div class='container-fluid'><div>This menu will contain information and options for viewing historical shorelines, result sets, etc etc</div></div>"
			}).on({
				'click': CONFIG.ui.popoverClickHandler,
				'shown': CONFIG.ui.popoverShowHandler
			});
		},
		bindShareMenu: function() {
			CONFIG.ui.bindShareMenu({
				menuItem: me.shareMenuDiv
			});
		},
		/**
		 * Uses the OpenLayers parsed WMS GetCapabilities response to get an
		 * array of shoreline objects.
		 * 
		 * @returns Array of shoreline info objects
		 */
		getLayerInfoArray: function() {
			var allLayerArray = CONFIG.ows.servers['cida-geoserver'].data.wms.capabilities.object.capability.layers;
			var publishedLayers = allLayerArray.findAll(function(l) {
				return l.name.toLowerCase().startsWith(CONFIG.name.published);
			});
			var shorelineLayers = publishedLayers.findAll(function(l) {
				return l.name.toLowerCase().endsWith('shorelines');
			});
			return shorelineLayers;
		},
		/**
		 * Lays out a set of box markers on the map that shows the user where we
		 * have active data sets
		 * 
		 * @returns {undefined}
		 */
		displayBoxMarkers: function() {
			var availableLayers = me.getLayerInfoArray();
			var layerCt = availableLayers.length;
			if (layerCt) {
				LOG.debug('Historical.js::displayBoxMarkers(): Found ' + layerCt + ' shoreline layers to display');

				var bounds = new OpenLayers.Bounds();

				availableLayers.each(function(layer) {
					var layerBounds = OpenLayers.Bounds.fromArray(layer.bbox['EPSG:900913'].bbox);
					var box = new OpenLayers.Marker.Box(layerBounds);
					box.setBorder(me.boxBorderColor, 1);

					box.events.register('click', box, function() {
						LOG.debug('Historical.js:: Box marker clicked. Zooming to shoreline');
						CONFIG.map.getMap().zoomToExtent(this.bounds);
						me.removeBoxLayer();
						me.displayData({
							'name': this.layerObject.name
						});
					});

					box.events.register('mouseover', box, function(event) {
						LOG.debug('Historical.js:: Box marker rolled over with mouse. Displaying popup');
						box.setBorder(me.highlightedBorderColor, 2);
						$(box.div).css({
							'cursor': 'pointer',
							'border-style': 'dotted'
						});

						if (!this.popup) {
							this.popup = new OpenLayers.Popup.FramedCloud(
									null,
									this.bounds.getCenterLonLat(),
									null,
									this.layerObject.title,
									null,
									false,
									null);
						}

						CONFIG.map.getMap().addPopup(this.popup, true);
					});

					box.events.register('mouseout', box, function() {
						LOG.debug('Historical.js:: Box marker rolled off with mouse. Displaying popup');
						box.setBorder(me.boxBorderColor, 1);
						$(box.div).css({
							'cursor': 'default'
						});

						CONFIG.map.getMap().removePopup(this.popup);
					});

					box.layerObject = layer;

					LOG.debug('Historical.js:: Adding box marker to map');
					me.boxLayer.addMarker(box);

					LOG.trace('Historical.js::displayAvailableData(): Adding current box bounds to overall layer set bounds.');
					bounds.extend(box.bounds);
				});

				LOG.debug('Historical.js::displayAvailableData(): Zooming to combined bounds of all layers.');
				CONFIG.map.getMap().zoomToExtent(bounds);
			}
		},
		/**
		 * Removes all box markers from the map
		 * 
		 * @returns {undefined}
		 */
		removeBoxLayer: function() {
			var map = CONFIG.map.getMap();
			map.popups.each(function(p) {
				map.removePopup(p);
			});
			me.boxLayer.clearMarkers();
			CONFIG.map.removeLayersByName(me.boxLayerName);
		},
		/**
		 *	Displays one or all shorelines on the map
		 *  
		 * @param {type} args
		 * @returns {undefined}
		 */
		displayData: function(args) {
			var name = args.name;

			if (name) {
				var prefix = name.split(':')[0];
				var title = name.split(':')[1];
				var layer = new OpenLayers.Layer.Shorelines(
						title,
						'geoserver/' + prefix + '/wms',
						{
							layers: [name],
							transparent: true,
//							sld_body: sldBody,
							format: "image/png"
						},
				{
					prefix: prefix,
					isBaseLayer: false,
					unsupportedBrowsers: [],
					tileOptions: {
						// http://www.faqs.org/rfcs/rfc2616.html
						// This will cause any request larger than this many characters to be a POST
						maxGetUrlLength: 2048
					},
					singleTile: true,
					ratio: 1,
					displayInLayerSwitcher: false
				});
				CONFIG.map.getMap().addLayer(layer);
				layer.redraw(true);
				CONFIG.session.objects.view.historical.activeLayers = [{name: name}];
				if (me.visibleLayers.indexOf(layer) === -1) {
					me.visibleLayers.push(layer);
				}
			}
		}
	});
};