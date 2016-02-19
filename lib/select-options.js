(function(scope) {
	
	//noinspection JSUnusedGlobalSymbols
	/**
	 * A behavior that implements the `cbn-select`'s options / values-related functionality.
	 * 
	 * @polymerBehavior
	 */
	scope.SelectOptionsBehavior = {
		
		properties: {
			
			/**
			 * The input's value.
			 */
			value: {
				type: Object,
				observer: '_valueChanged'
			},
			
			/**
			 * The select options.
			 */
			options: {
				observer: '_optionsChanged'
			},
			
			/**
			 * Stores all option items, together with metadata.
			 */
			_options: {
				type: Array,
				notify: true,
				value: function() { return []; }
			},
			
			/**
			 * Whether the list of options is currently loading.
			 */
			_optionsLoading: {
				type: Boolean,
				notify: true,
				value: false
			},
			
			/**
			 * Stores all option values (only used if freeText is disabled to quickly check if the value 
			 * entered is allowed).
			 */
			_optionValues: {
				type: Array,
				notify: true,
				value: function() { return []; }
			},
			
			/**
			 * Stores the filtered items, together with metadata.
			 */
			_filteredOptions: {
				type: Array,
				notify: true,
				value: function() { return []; }
			},
			
			/**
			 * Stores the selected values and their metadata inside a special Item object.
			 * Regardless of the multiple attribute, this value is always an array (with length=1 if multiple is false).
			 */
			_selectedOptions: {
				type: Array,
				notify: true,
				value: function() { return []; }
			},
			
			/**
			 * Stores the hash values of the selected options (see {@link #_getItemHash} for the motivation behind this.
			 */
			_selectedOptionsHash: {
				type: Array,
				value: function() { return []; }
			},
			
			/**
			 * Whether the select {@link #value} is currently being updated internally.
			 * 
			 * Used for detecting whether the value was updated externally and/or firing 'value-changed' events.
			 */
			_transaction: {
				type: Boolean,
				value: false
			},
			
			/**
			 * Stores the current transaction's selected options.
			 */
			_currentTransactionItems: {
				type: Object
			},
			
			/**
			 * Stores the hash values of the current transaction's selected options.
			 */
			_currentTransactionItemHashes: {
				type: Object
			},
			
			/**
			 * Whether the current transaction's result is a direct or indirect value change (and the indirection cause, 
			 * if specified).
			 * 
			 * Only available while committing. Useful inside `selectedOptions` observers to determine the cause of the 
			 * value change.
			 */
			_currentTransactionIndirect: {
				type: Object
			},
			
			/**
			 * Saves a currently invalid value to be set after a new options list are loaded.
			 */
			_delayedValue: {
				type: Object,
				value: null
			},
			
			/**
			 * Stores the current value used to filter the options.
			 */
			_currentFilterValue: {
				type: String,
				value: ''
			}
			
		},
		
		observers: [
			"_multipleChanged(multiple)",
			"_optionsSpliced(options.splices)",
			"_optionAttributeChanged(filterProperty,itemValueProperty,itemHashProperty)"
		],
		
		// Public API:
		
		/**
		 * Selects a single item.
		 * 
		 * @param {String|Object} item The item to select.
		 * @param {Number}        [idx] If multiple=true, specifies the position to append the value to.
		 * @return {Boolean} True if the value was selected, false otherwise.
		 */
		select: function(item, idx) {
			if (this._transaction) return false;
			var result = false;
			
			if (this._isNUE(item)) {
				return this.deselect();
			}
			// make the operation idempotent
			if (this.isItemSelected(item)) {
				return true;
			}
			
			// start a transaction, clone the currently selected options
			this._startTransaction(true);
			
			try {
				result = this._selectItem(item, idx);
				
			} finally {
				if (result)
					result = this._commitValue();
				else this._endTransaction();
			}
			
			return result;
		},
		
		/**
		 * Removes (deselects) a single value from the list of selected items. 
		 * If the element's multiple attribute is false, the value is set to null.
		 * 
		 * @param {String|Object} [item] The item to deselect. If none given, deselects all options.
		 * @return {Boolean} True if the value was found and deselected, false otherwise.
		 */
		deselect: function(item) {
			if (this._transaction) return false;
			var result = false;
			
			// start a transaction, clone the currently selected options
			this._startTransaction(true);
			
			try {
				result = this._deselectItem(item);
				
			} finally {
				if (result)
					result = this._commitValue();
				else this._endTransaction();
			}
			
			return result;
		},
		
		/**
		 * Replaces an item by deselecting it and selecting a new value in place.
		 * 
		 * @param {String|Object} item The item to deselect.
		 * @param {String|Object} newValue The new value to replace the item with.
		 * @param {Number}        idx The index to insert the new value.
		 */
		replaceItem: function(item, newValue, idx) {
			if (this._transaction) return false;
			var result = false;
			
			// start a transaction, clone the currently selected options
			this._startTransaction(true);
			
			try {
				this._deselectItem(item);
				this._selectItem(newValue, idx);
				result = true;
				
			} finally {
				if (result)
					this._commitValue();
				else this._endTransaction();
			}
		},
		
		/**
		 * Returns whether the specified item is selected.
		 * 
		 * @param {String|Object} item The item to check.
		 * @return {Boolean} True if the value is selected, false otherwise.
		 */
		isItemSelected: function(item) {
			var metaObject = this._findOptionMetaForItem(item);
			if (metaObject) {
				item = metaObject.item;
			}
			var value = this._getItemValue(item);
			var hash = this._getItemHash(item);
			
			if (this._selectedOptionsHash.indexOf(hash) >= 0) 
				return true; // fast return
			
			var i;
			for (i = 0; i < this._selectedOptions.length; i++) {
				if (this._selectedOptions[i].value == value)
					return true;
			}
			
			return false;
		},
		
		/**
		 * Returns the list of selected option objects.
		 * 
		 * This is different from the {@link #value} property because it always returns an array, and contains 
		 * the option objects as passed via the options array / data source (i.e. doesn't use `itemValueProperty`).
		 * 
		 * @return {Array<Object>} An array with the selected options.
		 */
		getSelectedOptions: function() {
			var selected = [];
			this._selectedOptions.forEach(function(item){
				selected.push(item.item);
			});
			return selected;
		},
		
		
		// Protected API
		
		/**
		 * Callback function for data source query pre-processing.
		 * Receives the query string and returns the query to send to the data source element.
		 * @type Function
		 * @param {String} query The user-inputted query text.
		 * @return {Object|String} The altered query.
		 */
		_processDataSourceQuery: null,
		
		/**
		 * Callback to override the selected value or stop the commit process (roll back).
		 * @type Function
		 * @param {Array} selectedItems The selected items to be committed.
		 * @param {Array|Boolean} The altered selection array or false to roll back.
		 */
		_commitValueCallback: null,
		
		// Polymer callbacks
		
		created: function() {
			if (!this._beforeOptionsFilterCallback) {
				/**
				 * Called just before the options will be [re]filtered.
				 */
				this._beforeOptionsFilterCallback = function () { /* ABSTRACT */
				};
			}
		},
		
		// Selection API
		
		/**
		 * Selects a single item from the options array.
		 * 
		 * If the multiple attribute is true, the value is appended to the selected values list.
		 * Otherwise, the old selected value is replaced.
		 * 
		 * @param {String|Object|null} item The item to select.
		 * @param {Number}             [idx] If multiple=true, specifies the index where to append the value. 
		 * @return {Boolean} True if the item was successfully selected, false otherwise (invalid/non-existing value and 
		 *                   freeText is disabled).
		 */
		_selectItem: function(item, idx) {
			if (this._isNUE(item))
				return false;
			
			var i;
			var value = this._getItemValue(item);
			var hash = this._getItemHash(item);
			
			var metaObject = this._findOptionMetaForItem(item);
			if (!metaObject && !this.freeText) // the specified option wasn't found in the options list
				return false;
			if (metaObject) {
				// replace it with the object found
				item = metaObject.item;
				value = this._getItemValue(item);
				hash = this._getItemHash(item);
			}
			
			if (!this.multiple || !this.allowDuplicates) {
				// check if the value has already been selected
				for (i = 0; i < this._currentTransactionItems.length; i++) {
					if (this._currentTransactionItems[i].value == value)
						return false;
					if (this._currentTransactionItemHashes[i] == hash)
						return false;
				}
			}
			
			if (!this.multiple) {
				this._currentTransactionItems = [];
				this._currentTransactionItemHashes = [];
			}
			if (idx === undefined) idx = this._currentTransactionItems.length;
			this._currentTransactionItems.splice(idx, 0, {
				item: item, value: value,
				label: this._getItemLabel(item)
			});
			this._currentTransactionItemHashes.splice(idx, 0, hash);
			
			return true;
		},
		
		/**
		 * Removes (deselects) a single value from the list of selected items. 
		 * If the element's multiple attribute is false, the value is set to null.
		 * 
		 * @param {String|Object} [item] The item to deselect (null for all items).
		 * @return {Boolean} True if the value was found and deselected, false otherwise.
		 */
		_deselectItem: function(item) {
			var hash = this._getItemHash(item);
			if (this._isNUE(item)) {
				this._currentTransactionItems = [];
				this._currentTransactionItemHashes = [];
				
				return true;
			}
			
			if (this.multiple) {
				var i = this._currentTransactionItemHashes.indexOf(hash);
				if (i < 0) return false;
				
				this._currentTransactionItems.splice(i, 1);
				this._currentTransactionItemHashes.splice(i, 1);
				
			} else { // multiple == false: 
				if (this._currentTransactionItemHashes.length != 1 || this._currentTransactionItemHashes[0] != hash)
					return false;
				this._currentTransactionItems = [];
				this._currentTransactionItemHashes = [];
			}
			
			return true;
		},
		
		/**
		 * Finds the option meta object for the specified value.
		 * 
		 * @param {String|Object} item The item / value to search the option object for.
		 * @return {Object} The option meta object, if found, null otherwise.
		 */
		_findOptionMetaForItem: function(item) {
			var value = this._getItemValue(item);
			var hash = this._getItemHash(item);
			
			var i, found, foundIdx;
			
			if (this._isNUE(item) || !this._options)
				return null;
			
			// check if the option exists inside the options list
			found = (this._optionValues && (foundIdx = this._optionValues.indexOf(value)) > -1);
			
			// otherwise, search by hash/label
			for (i = 0; i < this._options.length; i++) {
				if (this._options[i].hashValue == hash) {
					found = true; foundIdx = i;
					break;
				}
				if ((this._options[i].label+'').toLowerCase() == (item+'').toLowerCase()) {
					found = true; foundIdx = i;
				}
			}
			if (!found) // the specified option wasn't found in the options list
				return null;
			
			return this._options[foundIdx];
		},
		
		/**
		 * Observes the value of the element's `multiple` property and switches the `value` type when changed.
		 * @param {Boolean} multiple The new value for the `multiple` property.
		 */
		_multipleChanged: function(multiple) {
			// need to reset the value
			if (multiple) {
				this.value = [];
			} else {
				this.value = '';
			}
		},
		
		/**
		 * Override the FormElement's value observer to prevent firing multiple `value-changed` events.
		 * We use our own transaction system.
		 */
		_fe_valueChanged: function() {
		},
		
		/**
		 * Called when the selected value is changed (programmatically / from model).
		 * 
		 * @param {*} newVal The new value.
		 * @param {*} oldVal The old value.
		 */
		_valueChanged: function(newVal, oldVal) {
			if (this._transaction) // quit if value was changed internally
				return;
			var result = false;
			
			// start an empty transaction
			this._startTransaction();
			
			try {
				if (this._isNUE(newVal)) {
					// null value deselects all options
					result = true;
				} else if (this.multiple && Array.isArray(newVal)) {
					newVal.forEach(function(val) {
						result = this._selectItem(val) || result;
					}, this);
				} else {
					result = this._selectItem(newVal);
				}
				if (!result) {
					// an option does not exist? save it as delayed value
					this._delayedValue = newVal;
					
					/*
					 * Only issue a new data source query if:
					 * - we have no active options;
					 * - we're not inside a data available handler;
					 * This is required to avoid an infinite request loop if the server doesn't return the desired
					 * options.
					 */
					if (this.dataSource && (!this._options || !this._options.length) && 
							(this._dataSource && !this._dataSource._forDelayedValue)) {
						this._queryOptions(this._currentFilterValue, true);
					}
				}
				
			} finally {
				if (result) {
					this._commitValue();
				} else {
					// restore the old value
					this.value = oldVal;
					this._endTransaction();
				}
			}
		},
		
		/**
		 * Re-selects the current value. Used after the options array is changed (to make sure the old value doesn't 
		 * stay selected if invalid).
		 *
		 * @return {Boolean} True if the value was changed (i.e. differs from the old one), false otherwise.
		 */
		_reselectCurrentValue: function() {
			if (this._transaction) return false;
			var result = false;
			var newVal = this.value;
			
			// start a transaction, clone the currently selected options
			this._startTransaction();
			
			try {
				if (this._isNUE(newVal)) {
					result = true;
				} else if (this.multiple && Array.isArray(newVal)) {
					newVal.forEach(function (val) {
						result = this._selectItem(val) || result;
					}, this);
				} else {
					result = this._selectItem(newVal);
				}
				
			} finally {
				/*
				 * Selection changed criteria:
				 * - if the arrays have different lengths; or
				 * - if at least one option from the new array is not selected;
				 */
				var lengthsDiffer = (this._currentTransactionItems.length != 
					this._selectedOptions.length);
				var someNotSelected = this._currentTransactionItems.some(function(meta) {
					return !this.isItemSelected(meta.item);
				}, this);
				
				if (result) {
					result = this._commitValue({
						indirect: true, reselected: true,
						selectionChanged: (lengthsDiffer || someNotSelected)
					});
				}
				else this._endTransaction();
			}
			
			return result;
		},
		
		/**
		 * Starts a new transaction for changing the {@link #value} property.
		 * 
		 * @param {Boolean} [copySelectedOptions] Whether to copy the current selected options.
		 */
		_startTransaction: function(copySelectedOptions) {
			this._transaction = true;
			if (copySelectedOptions) {
				this._currentTransactionItems = this._selectedOptions.slice();
				this._currentTransactionItemHashes = this._selectedOptionsHash.slice();
			} else {
				this._currentTransactionItems = [];
				this._currentTransactionItemHashes = [];
			}
		},
		
		/**
		 * Ends / rolls back the current transaction (if it wasn't committed yet).
		 */
		_endTransaction: function() {
			this._transaction = false;
			this._currentTransactionItems = null;
			this._currentTransactionItemHashes = null;
		},
		
		/**
		 * Commits the value of the select, firing the 'input' and 'change' events.
		 * 
		 * @param {Boolean|Object} [indirect] Notification object to use.
		 * @return {Boolean} Whether the commit was successful or not.
		 */
		_commitValue: function(indirect) {
			var newValue = [];
			this._currentTransactionItems.forEach(function(opt) {
				newValue.push(opt.value);
			});
			
			if (this._commitValueCallback) {
				var result = this._commitValueCallback(newValue, indirect);
				if (!result) {
					// just roll back
					this._endTransaction();
					return false;
				}
				newValue = result;
				
				// recalculate the option objects and hashes from the altered selected items
				this._currentTransactionItems = newValue.map(function(item) {
					return {
						item: item, value: this._getItemValue(item),
						label: this._getItemLabel(item)
					};
				}, this);
				this._currentTransactionItemHashes = this._currentTransactionItems.map(function(v) {
					return this._getItemHash(v.item);
				}, this);
			}
			this._currentTransactionIndirect = indirect;
			this._delayedValue = null;
			
			// note: hashes need to be saved first (some `_selectedOptions` observers need them)
			this._selectedOptionsHash = this._currentTransactionItemHashes.slice();
			this._selectedOptions = this._currentTransactionItems.slice();
			if (!this.multiple) {
				newValue = (newValue.length ? newValue[0] : '');
			}
			
			if (this._inputValueIndirectlyChanged) {
				this.value = newValue;
				// let `_setIndirectValue` fire the notification, but fire an additional 'value-change' event with 
				// the new value (if it changed)
				this.async(function() {
					this.fire('value-changed', {
						value: newValue,
						indirect: true
					});
				});
				
			} else if (indirect) {
				this._setIndirectValue(newValue, (indirect === true ? null : indirect));
			} else {
				this.value = newValue;
				this.fire('value-changed', {
					value: newValue
				});
			}
			
			this._currentTransactionIndirect = undefined;
			this._endTransaction();
			return true;
		},
		
		// Select options provisioning:
		
		/**
		 * Observer for the `options` property.
		 */
		_optionsChanged: function(/*newOptions, oldOptions*/) {
			this._setOptions(this.options);
			this._filterOptions(/**@type {String}*/this._currentFilterValue);
		},
		
		/**
		 * Splice observer for the `options` array.
		 */
		_optionsSpliced: function(splices) {
			if (!splices) return; // handled by the `_optionsChanged` observer
			this._setOptions(this.options);
			this._filterOptions(/**@type {String}*/this._currentFilterValue);
		},
		
		/**
		 * Called to recalculate the options' metadata when some item property name (e.g. itemValueProperty) changes.
		 */
		_optionAttributeChanged: function() {
			var items = [];
			if (!this._options) return;
			
			for (var i=0; i<this._options.length; i++) {
				items.push(this._options[i].item);
			}
			this._setOptions(items);
			this._filterOptions(/**@type {String}*/this._currentFilterValue);
		},
		
		/**
		 * Automatically fired by `CbnDataSource.ConsumerBehavior` after a new data source is set.
		 */
		_dataSourceInitializedCallback: function() {
			this._setOptions([]);
			this._filterOptions(/**@type {String}*/this._currentFilterValue);
			if (this._delayedValue) {
				this._queryOptions(this._currentFilterValue, true);
			} 
		},
		
		/**
		 * Called when the `cbn-data-source` element has new data available.
		 */
		_dataSourceAvailableCallback: function() {
			this._setOptions(/**@type {Array}*/this._dataSource.filteredData);
			this._filterOptions(/**@type {String}*/this._currentFilterValue);
			this._optionsLoading = false;
		},
		
		/**
		 * Interrogates the data source for options that match the specified query.
		 * 
		 * This will set both the {@link #_options} and {@link #_filteredOptions} properties 
		 * (the former is changed only if a datasource is used).
		 * 
		 * @param {String} query The query to run.
		 * @param {Boolean} [delayed=false] Whether this is a query for a delayed value.
		 */
		_queryOptions: function(query, delayed) {
			this._currentFilterValue = query;
			if (this._dataSource) {
				if (this._processDataSourceQuery) {
					query = this._processDataSourceQuery(query);
				} 
				this._optionsLoading = true;
				var isDataAvailable = this._dataSource.query(query);
				if (isDataAvailable) {
					try {
						this._dataSource._forDelayedValue = delayed;
						this._dataSourceAvailableCallback();
					} finally {
						this._dataSource._forDelayedValue = false;
					}
				} else {
					// otherwise, wait for the data-available event
					this._dataSource._forDelayedValue = delayed;
				}
				
			} else {
				// just filter them using the locally configured filter (if enabled)
				this._filterOptions(this._currentFilterValue);
			}
		},
		
		/**
		 * Replaces the current options with the specified list.
		 * 
		 * @param {Array} items The new options list to set.
		 */
		_setOptions: function(items) {
			var mOptions = [], mOptionValues = [];
			if (!items) items = [];
			
			for (var i=0; i<items.length; i++) {
				mOptions.push(this._getOptionMeta(items[i]));
				mOptionValues.push(this._getItemValue(items[i]));
			}
			
			this._options = mOptions;
			this._optionValues = mOptionValues;
			this._filteredOptions = [];
			
			// select the delayed value
			if (this._delayedValue) {
				// only change the value as result of a delayed-initiated query
				if (!this.dataSource || (this._dataSource && this._dataSource._forDelayedValue)) {
					var delayedValue = this._delayedValue;
					this._delayedValue = null;
					if (this._dataSource)
						this._dataSource._forDelayedValue = false;
					this._setIndirectValue(delayedValue, { indirect: true, delayed: true });
				}
				
			} else {
				this._reselectCurrentValue();
			}
		},
		
		
		/**
		 * Returns the option metadata object for an item.
		 * @param {Object|String} item The option item.
		 * @return {SelectOptionMeta} The option metadata object.
		 */
		_getOptionMeta: function(item) {
			return {
				item: item,
				label: this._getItemLabel(item),
				filterValue: this._getItemFilterValue(item),
				hashValue: this._getItemHash(item)
			};
		},
		
		/**
		 * Applies the local filter to the options list and outputs the filtered results to the 
		 * {@link #_filteredOptions} property.
		 * 
		 * @param {String} query The query/filter to use.
		 */
		_filterOptions: function (query) {
			this._beforeOptionsFilterCallback();
			
			this._currentFilterValue = query;
			this._filteredOptions = this.$.filter.filter(this._options, query);
			
			if (this.multiple && !this.allowDuplicates) {
				// remove the selected options from the filtered list
				this._filteredOptions = this._filteredOptions.filter(function (item) {
					return !this._selectedOptionsHash || (this._selectedOptionsHash.indexOf(item.hashValue) == -1);
				}, this);
			}
		},
		
		
		// Option item utility methods:
		
		/**
		 * Returns the model value of an item.
		 * 
		 * @param {Object|String} item The item to fetch the property for.
		 */
		_getItemValue: function (item) {
			if (!item || typeof item != 'object')
				return item;
			return (this.itemValueProperty ? item[this.itemValueProperty] : item );
		},
		
		/**
		 * Returns the hash value of an item (that is used for comparing the item objects).
		 * If the option item is an Object, the hash is the stringified value.
		 * 
		 * This is required instead of comparing the objects by reference because if an AJAX datasource is used, the 
		 * references would change when new objects are returned!
		 * 
		 * @param {Object|String} item The item to fetch the property for.
		 */
		_getItemHash: function (item) {
			if (!item || typeof item != 'object')
				return item;
			if (this.itemHashProperty) {
				return item[this.itemHashProperty];
			}
			return JSON.stringify(item);
		},
		
		/**
		 * Returns the value used to filter an item by.
		 * 
		 * @param {Object|String} item The item to fetch the property for.
		 */
		_getItemFilterValue: function (item) {
			if (typeof item != 'object')
				return item;
			var fp = this.filterProperty || this.itemLabelProperty;
			if (fp === undefined)
				return ''; // prevent uninitialized element from calling filter with invalid values
			return (fp ? item[fp] : item );
		},
		
		/**
		 * Returns the display label of a select option/item.
		 * 
		 * @param {Object|String} item The item to fetch the property for.
		 */
		_getItemLabel: function (item) {
			if (typeof item != 'object')
				return item;
			return (this.itemLabelProperty ? item[this.itemLabelProperty] : item );
		},
		
		/**
		 * Returns whether the given value is null, undefined or empty string.
		 * 
		 * @param {*} val The value to check.
		 * @return {Boolean} True if the value is Null/Undefined/Empty.
		 */
		_isNUE: function (val) {
			return val === undefined || val === null ||
				(typeof val === "string" && val.trim().length === 0) ||
				((val instanceof Array) && val.length === 0);
		}
		
	};
	
	// JSDoc type defs:
	
	/**
	 * The type definition of the option (incl. metadata) object.
	 * 
	 * @typedef  {Object}        SelectOptionMeta
	 * @memberof cbn-select
	 * @property {Object|String} item The actual data item's object.
	 * @property {String}        [label] The display label of the item.
	 * @property {Object|String} [value] The item's value (to set as input value).
	 * @property {String}        [hashValue] The value that will be used for comparing item objects.
	 * @property {String}        [filterValue] The value used for filtering.
	 */
	
})(window.CbnForm.CbnSelect);
