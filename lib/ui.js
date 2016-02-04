(function(scope) {
	
	//noinspection JSUnusedGlobalSymbols
	/**
	 * A behavior that implements the `cbn-select`'s user interface controller.
	 * 
	 * @polymerBehavior
	 */
	scope.SelectUIBehavior = {
		
		properties: {
			/**
			 * Stores the main input's current value (used for add / query / showing the selected value in single mode).
			 */
			_inputValue: {
				type: String,
				notify: true,
				value: ''
			},
			
			/**
			 * Whether the input value was modified.
			 */
			_inputModified: {
				type: Boolean,
				value: false
			},
			
			/**
			 * Whether the current input value is invalid.
			 */
			_inputValueInvalid: {
				type: Boolean,
				value: false
			},
			
			/**
			 * Stores the edit option input's current value.
			 */
			_editQuery: {
				type: String,
				value: ''
			},
			
			/**
			 * Stores the selected options to be displayed using chips. 
			 * Usually, it will be a copy of _selectOptions, with added metadata.
			 */
			_displaySelectedOptions: {
				type: Array,
				value: function() { return []; }
			},
			
			/**
			 * Maps the highlightable items to their current indices.
			 */
			_highlighted: {
				type: Object,
				value: function() {
					return {
						/**
						 * Stores the index of the highlighted option inside the selected options list 
						 * ({@link #_displaySelectedOptions}).
						 */
						selectedOptionIdx: -1,
						
						/**
						 * Stores the index of the selected option inside the drop-down options list 
						 * ({@link #_filteredOptions}).
						 */
						filteredOptionIdx: -1,
						
						/**
						 * Stores the currently edited option (inside {@link #_displaySelectedOptions}).
						 */
						editOptionIdx: -1
					}
				}
			},
			
			/**
			 * Stores the status properties of the select element. 
			 * Mainly used for data bindings (element UI) / event handler methods to define the element's behavior.
			 * 
			 * Note: all properties here must be re-initialized on the `create` handler to avoid shared state issues.
			 * They are specified here for documentation purposes!
			 * 
			 * @private
			 */
			_status: {
				type: Object,
				value: function() {
					return {
						/**
						 * The mode gives the overall behavior of the element and reflects the current focused sub-component.
						 * 
						 * Available modes:
						 * - '': the initial state, used when not focused;
						 * - 'view': when a selected option is selected;
						 * - 'query': when the add/query input is focused;
						 * - 'edit': When editing a selected option.
						 * 
						 * @type {String}
						 */
						mode: '',
						
						/**
						 * Whether the dropdown (options) menu is open.
						 */
						open: false
						
					}
				}
			}
			
		},
		
		observers: [
			'_ui_selectedOptionsChanged(_selectedOptions)',
			'_ui_optionsChanged(_options.splices)',
			'_ui_filteredOptionsChanged(_filteredOptions.splices)'
		],
		
		// UI property computation methods
		
		/**
		 * Whether the options list is empty.
		 */
		get _emptyOptionsList() {
			return !this._optionsLoading && !this._filteredOptions.length;
		},
		
		/**
		 * Whether to display/use the selected option chips or just a simple input containing the selected value.
		 */
		get _showChips() {
			return this.multiple || this.alwaysShowChips;
		},
		
		/**
		 * Returns the value of the `_showChips` read-only property. 
		 * Necessary for use as computed data binding.
		 * 
		 * @return {Boolean} Whether to show selected options as chips.
		 */
		_computeShowChips: function() {
			return this._showChips;
		},
		
		/**
		 * Returns the value of the `_emptyOptionsList` read-only property. 
		 * Necessary for use as computed data binding.
		 * @return {Boolean} Whether the options list is empty.
		 */
		_computeEmptyOptionsList: function() {
			return this._emptyOptionsList;
		},
		
		/**
		 * Computes the CSS classes for #container.
		 * 
		 * @param open The observed `_status.open` value.
		 * @return {String} The computed classes (space-separated).
		 */
		_computeContainerClass: function(open) {
			return scope.utils.tokenList({ open: open });
		},
		
		/**
		 * Computes the CSS classes for a selected item.
		 * 
		 * @param highlighted The observed `item.highlighted` value.
		 * @param editing     The observed `item.editing` value.
		 * @return {String} The computed classes (space-separated).
		 */
		_computeSelectedItemClass: function(highlighted, editing) {
			return scope.utils.tokenList({
				'selected-item': true,
				highlighted: highlighted,
				editing: editing
			});
		},
		
		/**
		 * Computes the CSS classes for a dropdown item.
		 * 
		 * @param highlighted The observed `item.highlighted` value.
		 * @return {String} The computed classes (space-separated).
		 */
		_computeDropdownItemClass: function(highlighted) {
			return scope.utils.tokenList({
				item: true,
				highlighted: highlighted
			});
		},
		
		/**
		 * Computes the option edit input's size.
		 * 
		 * @param editQuery The `_editQuery` value.
		 */
		_computeEditInputSize: function(editQuery) {
			return editQuery.length < 5 ? 1 : editQuery.length-1;
		},
		
		/**
		 * Returns the options to be displayed using selection chips.
		 * 
		 * @return {Array} The selected options to render.
		 */
		_ui_selectedOptionsChanged: function() {
			var selectedOptions = [];
			
			// reset validation status
			this._setInternalValidationState(true, true); // prevent firing un-needed notifications
			
			// insert metadata inside the _selectedOptions
			this._selectedOptions.forEach(function(selectedOpt) {
				// note: here we can safely set meta properties to the original object (a new array reference is used)
				selectedOpt.highlighted = !!selectedOpt.highlighted;
				selectedOpt.editing = !!selectedOpt.editing;
				selectedOptions.push(selectedOpt);
			}, this);
			
			// set the displayed item selection
			this._displaySelectedOptions = selectedOptions;
			
			if (this.multiple && !this.allowDuplicates && this._status.open) {
				this._filterOptions(/**@type {String}*/this._currentFilterValue);
			}
			this._updateInputValue();
		},
		
		/**
		 * Called when the internal list of options is changed.
		 * Used to store own metadata among the `SelectOptionMeta` objects.
		 * 
		 * @param changeRecord The Polymer `Array.splices` change record.
		 */
		_ui_optionsChanged: function(changeRecord) {
			// update it with metadata defaults
			if (changeRecord && changeRecord.indexSplices) changeRecord.indexSplices.forEach(function(s) {
				for (var i= s.index; i < s.index + s.addedCount; i++) {
					this.set('_options.'+i+'.highlighted', !!this._options[i].highlighted);
				}
			}.bind(this));
		},
		
		/**
		 * Called when new data is available.
		 */
		_ui_filteredOptionsChanged: function() {
			if (this._status.open) {
				// call open again to recalculate the size of the list
				this.async(this._updateDropdownPosition);
			}
		},
		
		/**
		 * Called just before the options will be [re]filtered.
		 */
		_beforeOptionsFilterCallback: function() {
			if (this._highlighted.filteredOptionIdx > -1) {
				// un-highlight the currently active element
				if (this._filteredOptions[this._highlighted.filteredOptionIdx]) {
					this.set('_filteredOptions.'+this._highlighted.filteredOptionIdx+'.highlighted', false);
				}
			}
		},
		
		/**
		 * Called after the options were [re]filtered.
		 */
		_optionsFilteredCallback: function() {
			if (this._highlighted.filteredOptionIdx > -1) {
				this._highlightDropdownItem(this._highlighted.filteredOptionIdx);
			}
		},
		
		
		// Behavioral methods
		
		/**
		 * Changes the element's mode (see {@link #_status}).
		 * 
		 * @param {String} mode The new mode to activate.
		 * @param {*}      [param] Optional mode parameters.
		 * @return {Boolean} True if the mode change succeeded.
		 */
		_setMode: function(mode, param) {
			// first, reset all status variables to their default values
			if (this._highlighted.editOptionIdx > -1) {
				if (this._displaySelectedOptions[this._highlighted.editOptionIdx]) {
					this.set('_displaySelectedOptions.'+this._highlighted.editOptionIdx+'.editing', false);
				}
				this.set('this._highlighted.editOptionIdx', -1);
			}
			
			var oldMode = this._status.mode;
			this.set('_status.mode', mode);
			
			switch (mode) {
				case '':
					this._closeDropdown();
					break;
				
				case 'view':
					if (param !== undefined) {
						this._highlightSelectedItem(param);
					}
					// else: keep all highlights intact
					break;
				
				case 'query':
					// show the auto-complete box
					this._openDropdown();
					
					if (oldMode == mode) {
						break;
					}
					
					this._inputModified = false;
					this._queryOptions(this._showChips ? this._inputValue : '');
					
					// reset all highlights
					this._highlightSelectedItem(null);
					this._highlightDropdownItem(null);
					
					// focus the add/query input
					this.$.input.focus();
					break;
				
				case 'edit':
					// long list of conditions for edit to apply: 
					if (!this.freeText) return false;
					if (param === undefined) return false;
					var item = this._displaySelectedOptions[param];
					if (!item) return false;
					
					this.set('_editQuery', item.label);
					this.set('_highlighted.editOptionIdx', param);
					this.set('_displaySelectedOptions.'+param+'.editing', true);
					
					break;
				
			}
			
			return true;
		},
		
		/**
		 * Opens the select's dropdown dialog (after computing its position / styles).
		 * 
		 * Note that the dropdown has 'position: fixed', so its offset parent is the document body.
		 */
		_openDropdown: function() {
			this.set('_status.open', true);
			scope.currentlyOpened = this;
			if (this.$.optionsWrapper.style.display != 'block') {
				this.debounce('_openDropdown', this._updateDropdownPosition, 10);
			}
		},
		
		/**
		 * Computes the position and dimensions of the dropdown box.
		 * 
		 * The algorithm for doing this is:
		 * 1. Try to fit the box with the initial position (e.g. bottom):
		 *    > adjust the dimension (height) to the available space in the viewport;
		 *    > if the resulting height is higher than min-height, stop the process;
		 * 2. Flip the direction (vertical, in our case) and try again to fit the box:
		 *    > adjust the dimension (height) to the space available in the flipped direction;
		 *    > same as 1: if it fits, stop the process;
		 * 3. If all else fails, revert to the original position and fit it above the element.
		 */
		_updateDropdownPosition: function() {
			if (!this._status.open) return;
			
			if (!this.$.ironList) {
				this.$.ironList = this.$$('#ironList');
				this.$.optionsStatus = this.$$('.options-status');
			}
			
			/** @namespace this.$.optionsWrapper */
			var box = this.$.optionsWrapper;
			box.style.display = 'block';
			
			// compute the dropdown box's position
			var margins = { top: 5, left: 5, bottom: 5, right: 5 };
			this.updateElementPosition(box, this, {
				collisionMode: 'flipfit flipfit',
				viewportMargin: margins,
				callbacks: {
					updateDimensions: function(boundingBox, refBoundingBox, metric) {
						if (metric.dir === undefined || metric.dir == 0) {
							var availableXSpace = Math.round(metric.availableSpace[0] - 1);
							this._setDropdownWidth(availableXSpace);
							boundingBox.width = box.clientWidth;
						}
						if (metric.dir === undefined || metric.dir == 1) {
							var newHeight = metric.availableSpace[1];
							this._setDropdownHeight(newHeight);
							boundingBox.height = box.offsetHeight;
						}
					}.bind(this)
				}
			});
		},
		
		/**
		 * Changes the dropdown box's width to fit the listed items in the available space.
		 *
		 * - try to determine de optimal width without wrapping;
		 * - also take account on the vertical scroll bar added padding, if any;
		 * - the resulting width will be lower than both the `availableSpace` parameter;
		 *
		 * @param {Integer} availableXSpace The available space on OX.
		 */
		_setDropdownWidth: function(availableXSpace) {
			/** @namespace this.$.optionsWrapper */
			var box = this.$.optionsWrapper;
			
			box.style.width = '';
			box.style.maxWidth = '';
			if (this.useIronList) {
				// set several properties to compute the width required by the list
				this.$.ironList.style.whiteSpace = 'nowrap';
				var sizeWoScroll = this.$.ironList.clientWidth;
				this.$.ironList.$.items.style.overflow = 'scroll';
				var sizeWithScroll = this.$.ironList.$.items.clientWidth;
				var scrollSize = Math.abs(sizeWithScroll - sizeWoScroll);
				// hack: make it double the scoller size
				var reqWidth = this.$.ironList.$.items.scrollWidth + scrollSize * 2 + 1;
				// reset the props
				this.$.ironList.style.whiteSpace = '';
				this.$.ironList.$.items.style.overflow = '';
				
				// check if it fits
				if (reqWidth < availableXSpace) {
					box.style.width = reqWidth + 'px';
				} else {
					box.style.width = availableXSpace + 'px';
				}
				
				this.$.ironList.fire('iron-resize');
				
			} else {
				box.style.width = '';
				box.style.maxWidth = availableXSpace + 'px';
				box.style.overflow = 'scroll';
				box.style.width = box.offsetWidth + 'px';
				box.style.overflow = '';
				box.style.minWidth = '';
			}
		},
		
		/**
		 * Changes the dropdown box's height to the specified amount, with the following exceptions:
		 * 
		 * - if it exceeds the 'max-height' CSS property, it will be limited to this value;
		 * - if below the target, the minimum value will be used instead;
		 * - if the inner options are smaller then the calculated height, the height will be set to be an exact fit 
		 *   instead;
		 * 
		 * @param {Integer} newHeight The new height to set.
		 */
		_setDropdownHeight: function(newHeight) {
			/** @namespace this.$.optionsWrapper */
			var box = this.$.optionsWrapper;
			
			box.style.height = '';
			box.style.maxHeight = '';
			box.style.minHeight = '';
			if (this.useIronList) {
				// set an explicit height (iron-list has absolute fit)
				box.style.height = newHeight + "px";
				this.$.ironList.fire('iron-resize');
				
				// make the iron-list to an exact fit if it has less items
				var itemsHeight = this.$.ironList.$.items.clientHeight + this.$.optionsStatus .clientHeight;
				if (newHeight > itemsHeight) {
					box.style.height = itemsHeight + 'px';
					box.style.minHeight = '0';
					this.$.ironList.fire('iron-resize');
				}
				
			} else {
				// choose minimum between maxHeight and #optionsWrapper's min/max heights
				if (newHeight < box.clientHeight) {
					box.style.maxHeight = newHeight + "px";
				}
				if (newHeight > box.querySelector('#options').clientHeight) {
					box.style.minHeight = '0';
				}
			}
		},
		
		/**
		 * Closes the options dropdown list.
		 */
		_closeDropdown: function() {
			this._setMode('view');
			this.set('_status.open', false);
			this.$.optionsWrapper.style.display = '';
			if (scope.currentlyOpened == this) {
				scope.currentlyOpened = false;
			}
		},
		
		/**
		 * Changes the input.
		 * 
		 * @param valid Whether the input is valid or not.
		 */
		_updateQueryInputChanged: function(valid) {
			if (valid) {
				this._clearQueryInput();
			} else {
				this._setInternalValidationState(false);
			}
		},
		
		/**
		 * Clears the query input text.
		 */
		_clearQueryInput: function() {
			this._inputValue = '';
			this._setInternalValidationState(true);
			this._queryOptions('');
			
			this._updateInputValue();
		},
		
		/**
		 * If {@link #_showChips} is true, updates `_inputValue` to the currently selected value.
		 */
		_updateInputValue: function() {
			this._inputModified = false;
			if (!this._showChips) {
				// show the final selected value
				this._inputValue = (this._displaySelectedOptions.length ? this._displaySelectedOptions[0].label : '' );
			}
		},
		
		/**
		 * Saves the currently edited option and disabled edit mode.
		 */
		_saveEditedOption: function() {
			if (this._status.mode != 'edit') 
				return false;
			var item = this._displaySelectedOptions[this._highlighted.editOptionIdx];
			if (!item) return false;
			
			if (!this._editQuery) {
				this.deselect(item.item);
				this._setMode('view');
			} else {
				this.replaceItem(item.item, this._editQuery, this._highlighted.editOptionIdx);
				this._setMode('view', this._highlighted.editOptionIdx);
			}
		},
		
		// Navigation methods
		
		/**
		 * Highlights an option in the dropdown options box.
		 * See {@link CbnSelect.utils#computeHighlightIdx}.
		 * 
		 * @param {int|String} idx The index of the option to highlight.
		 * @param {Boolean}    [relative] Whether the index is relative to the currently highlighted item.
		 */
		_highlightDropdownItem: function(idx, relative) {
			var curIdx = this._highlighted.filteredOptionIdx;
			idx = scope.utils.computeHighlightIdx(idx, relative, this._filteredOptions, curIdx);
			
			if (curIdx > -1 && curIdx < this._filteredOptions.length) {
				this.set('_filteredOptions.'+curIdx+'.highlighted', false);
			}
			if (idx > -1) {
				this.set('_filteredOptions.'+idx+'.highlighted', true);
			}
			this.set('_highlighted.filteredOptionIdx', idx);
			
			// scroll to the highlighted element
			if (this.useIronList) {
				var ironList = this.$$('#ironList');
				var scrollToIdx = idx;
				ironList.scrollToIndex(scrollToIdx);
				
			} else {
				if (!this.$.options) {
					this.$.options = this.$$('#options');
				}
				var el = this.$.options.querySelector(".item:nth-of-type(" + (idx + 1) + ")");
				if (el) {
					if (el.offsetTop <= this.$.optionsWrapper.scrollTop) {
						this.$.optionsWrapper.scrollTop = el.offsetTop;
					} else if (el.offsetTop >= (this.$.optionsWrapper.scrollTop + this.$.optionsWrapper.clientHeight - el.clientHeight)) {
						this.$.optionsWrapper.scrollTop = el.offsetTop - this.$.optionsWrapper.clientHeight + el.clientHeight * 2;
					}
				}
			}
		},
		
		/**
		 * Highlights a selected option in the view mode.
		 * See {@link CbnSelect.utils#computeHighlightIdx}.
		 * 
		 * @param {int|String} idx The index of the option to highlight.
		 * @param {Boolean}    [relative] Whether the index is relative to the currently highlighted item.
		 */
		_highlightSelectedItem: function(idx, relative) {
			var curIdx = this._highlighted.selectedOptionIdx;
			idx = scope.utils.computeHighlightIdx(idx, relative, this._displaySelectedOptions, curIdx);
			
			if (curIdx > -1 && curIdx < this._displaySelectedOptions.length) {
				this.set('_displaySelectedOptions.'+curIdx+'.highlighted', false);
			}
			if (idx > -1) {
				this.set('_displaySelectedOptions.'+idx+'.highlighted', true);
			}
			this.set('_highlighted.selectedOptionIdx', idx);
		},
		
		/**
		 * Removes the current highlighted option from the selected options list.
		 */
		_removeSelectedOption: function() {
			if (this._highlighted.selectedOptionIdx < 0) 
				return;
			if (this._highlighted.selectedOptionIdx >= this._displaySelectedOptions.length) 
				return;
			this.deselect(this._displaySelectedOptions[this._highlighted.selectedOptionIdx].item);
			
			// try to highlight the next item
			// (if not possible, the last item will be chosen)
			this._highlightSelectedItem(this._highlighted.selectedOptionIdx);
		}
		
	};
	
	// this will hold the currently opened element
	scope.currentlyOpened = null;
	
	/**
	 * Window scroll handler: updates the currently opened select dropdown's position / dimensions.
	 * @param {Event} event The scroll event object received.
	 */
	function repositionOpenedSelect(event) {
		if (!scope.currentlyOpened) return;
		if (event.target != window && event.target != document) return;
		
		scope.currentlyOpened.debounce('_repositionOpenedSelect', scope.currentlyOpened._updateDropdownPosition);
	}
	
	window.addEventListener('scroll', repositionOpenedSelect);
	window.addEventListener('resize', repositionOpenedSelect);
	
	// JSDoc type defs:
	
})(window.CbnForm.CbnSelect);
