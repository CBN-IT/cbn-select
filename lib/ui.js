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
			 * Stores the edit option input's current value.
			 */
			_editQuery: {
				type: String,
				value: ''
			},
			
			/**
			 * True if the element needs to be refocused after blur.
			 */
			_refocus: {
				type: Boolean,
				value: false
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
						 * ({@link #_selectedOptions}).
						 */
						selectedOptionIdx: -1,
						
						/**
						 * Stores the index of the selected option inside the drop-down options list 
						 * ({@link #_filteredOptions}).
						 */
						filteredOptionIdx: -1,
						
						/**
						 * Stores the currently edited option (inside {@link #_selectedOptions}).
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
						 * Whether the element has focus.
						 */
						focused: false,
						
						/**
						 * Whether the dropdown (options) menu is open.
						 */
						open: false
						
					}
				}
			}
			
		},
		
		observers: [
			'_ui_selectedOptionsChanged(_selectedOptions.*)',
			'_ui_optionsChanged(_options.splices)'
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
		 * Called after the selected value is updated.
		 */
		_ui_selectedOptionsChanged: function() {
			// update it with metadata defaults
			this._selectedOptions.forEach(function(selectedOpt, i) {
				this.set('_selectedOptions.'+i+'.highlighted', !!selectedOpt.highlighted);
				this.set('_selectedOptions.'+i+'.editing', !!selectedOpt.editing);
			}.bind(this));
			
			this.debounce('_selectedOptionsChanged', function() {
				if (this.multiple && !this.allowDuplicates) {
					this._filterOptions(/**@type {String}*/this._currentFilterValue);
				}
				this._updateInputValue();
			});
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
				if (this._selectedOptions[this._highlighted.editOptionIdx]) {
					this.set('_selectedOptions.'+this._highlighted.editOptionIdx+'.editing', false);
				}
				this.set('this._highlighted.editOptionIdx', -1);
			}
			
			var oldMode = this._status.mode;
			this.set('_status.mode', mode);
			
			switch (mode) {
				case '':
					this.set('_status.open', false);
					break;
				
				case 'view':
					if (param !== undefined) {
						this._highlightSelectedItem(param);
					}
					// else: keep all highlights intact
					break;
				
				case 'query':
					// show the auto-complete box
					this.set('_status.open', true);
					if (this.useIronList) {
						if (!this.$.ironList) {
							this.$.ironList = this.$$('#ironList');
						}
						this.$.ironList.fire('resize');
					}
					
					if (oldMode == mode) {
						break;
					}
					
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
					var item = this._selectedOptions[param];
					if (!item) return false;
					
					this.set('_editQuery', item.label);
					this.set('_highlighted.editOptionIdx', param);
					this.set('_selectedOptions.'+param+'.editing', true);
					
					break;
			}
			
			return true;
		},
		
		/**
		 * Clears the query input text.
		 */
		_clearQueryInput: function() {
			this._inputValue = '';
			this._queryOptions('');
			
			this._updateInputValue();
		},
		
		/**
		 * If {@link #_showChips} is true, updates `_inputValue` to the currently selected value.
		 */
		_updateInputValue: function() {
			if (!this._showChips) {
				// show the final selected value
				this._inputValue = (this._selectedOptions.length ? this._selectedOptions[0].label : '' );
			}
		},
		
		/**
		 * Saves the currently edited option and disabled edit mode.
		 */
		_saveEditedOption: function() {
			if (this._status.mode != 'edit') 
				return false;
			var item = this._selectedOptions[this._highlighted.editOptionIdx];
			if (!item) return false;
			
			if (!this._editQuery) {
				this.deselect(item.item);
				this._setMode('view');
			} else {
				this.deselect(item.item);
				this.select(this._editQuery, this._highlighted.editOptionIdx);
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
				this.$$('#ironList').scrollToIndex(idx);
			} else {
				if (!this.$.options) {
					this.$.options = this.$$('#options');
				}
				var el = this.$.options.querySelector(".item:nth-of-type(" + (idx + 1) + ")");
				if (el) {
					if (el.offsetTop <= this.$.options.scrollTop) {
						this.$.options.scrollTop = el.offsetTop;
					} else if (el.offsetTop >= (this.$.options.scrollTop + this.$.options.clientHeight - el.clientHeight)) {
						this.$.options.scrollTop = el.offsetTop - this.$.options.clientHeight + el.clientHeight * 2;
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
			idx = scope.utils.computeHighlightIdx(idx, relative, this._selectedOptions, curIdx);
			
			if (curIdx > -1 && curIdx < this._selectedOptions.length) {
				this.set('_selectedOptions.'+curIdx+'.highlighted', false);
			}
			if (idx > -1) {
				this.set('_selectedOptions.'+idx+'.highlighted', true);
			}
			this.set('_highlighted.selectedOptionIdx', idx);
		},
		
		/**
		 * Removes the current highlighted option from the selected options list.
		 */
		_removeSelectedOption: function() {
			if (this._highlighted.selectedOptionIdx < 0) 
				return;
			if (this._highlighted.selectedOptionIdx >= this._selectedOptions.length) 
				return;
			this.deselect(this._selectedOptions[this._highlighted.selectedOptionIdx].item);
			
			// try to highlight the next item
			// (if not possible, the last item will be chosen)
			this._highlightSelectedItem(this._highlighted.selectedOptionIdx);
		}
		
	};
	
	// JSDoc type defs:
	
	
})(window.CbnForm.CbnSelect);
