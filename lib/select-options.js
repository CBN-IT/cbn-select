(function(scope) {
	
	//noinspection JSUnusedGlobalSymbols
	/**
	 * A behavior that implements the `cbn-select`'s options / values-related functionality.
	 * 
	 * @polymerBehavior
	 */
	scope.SelectOptionsBehavior = {
		
		properties: {
			
			value: {
				type: Object,
				observer: '_valueChanged'
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
			 * Stores a delayed value to be set when the list of options has finished loading.
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
			"_optionsChanged(options)"
		],
		
		// Public API:
		
		/**
		 * Removes (deselects) a single value from the list of selected items. 
		 * If the element's multiple attribute is false, the value is set to null.
		 * 
		 * @param {String|Object} item The item to deselect.
		 * @return {Boolean} True if the value was found and deselected, false otherwise.
		 */
		select: function(item) {
			if (this._transaction) return false;
			var result = false;
			
			// start a transaction, clone the currently selected options
			this._startTransaction(true);
			
			try {
				result = this._selectItem(item);
				
			} finally {
				if (result)
					this._commitValue();
				else this._endTransaction();
			}
		},
		
		/**
		 * Removes (deselects) a single value from the list of selected items. 
		 * If the element's multiple attribute is false, the value is set to null.
		 * 
		 * @param {String|Object} item The item to deselect.
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
					this._commitValue();
				else this._endTransaction();
			}
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
			var value = this._getItemValue(item);
			var hash = this._getItemHash(item);
			
			var i, found, foundIdx;
			
			if (item) {
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
				if (!found && !this.freeText) // the specified option wasn't found in the options list
					return false;
				if (found && foundIdx >= 0) {
					// replace it with the object found
					item = this._options[foundIdx].item;
					value = this._getItemValue(item);
					hash = this._getItemHash(item);
				}
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
			if (!idx) idx = this._currentTransactionItems.length;
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
		 * @param {String|Object} item The item to deselect.
		 * @return {Boolean} True if the value was found and deselected, false otherwise.
		 */
		_deselectItem: function(item) {
			var hash = this._getItemHash(item);
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
		 * Called when the value is changed externally (e.g. by the form).
		 * 
		 * @param {*} newVal The new value.
		 * @param {*} oldVal The old value.
		 */
		_valueChanged: function(newVal, oldVal) {
			if (this._transaction) // quit if value was changed internally
				return;
			
			var result = false;
			
			if (this.dataSource) {
				if (!this._options || !this._options.length) {
					try {
						this._transaction = true;
						// keep the old value
						this.value = oldVal;
					} finally {
						this._transaction = false;
					}
					this._delayedValue = newVal;
					this.async(function(){
						this._queryOptions(this._currentFilterValue);
					});
					return;
				}
			}
			
			// start an empty transaction
			this._startTransaction();
			
			try {
				if (this._isNUE(newVal)) {
					// null value deselects all options
				} else if (this.multiple && Array.isArray(newVal)) {
					newVal.forEach(function(val) {
						this._selectItem(val);
					}, this);
				} else {
					this._selectItem(newVal);
				}
				
				result = true;
				
			} finally {
				if (result)
					this._commitValue();
				else this._endTransaction();
			}
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
		 */
		_commitValue: function() {
			var newValue = [];
			this._currentTransactionItems.forEach(function(opt) {
				newValue.push(opt.value);
			});
			
			this._selectedOptions = this._currentTransactionItems.slice();
			this._selectedOptionsHash = this._currentTransactionItemHashes.slice();
			if (this.multiple) {
				this.value = newValue;
			} else {
				this.value = (newValue.length ? newValue[0] : '');
			}
			
			this._endTransaction();
		},
		
		// Select options provisioning:
		
		/**
		 * Observer for the `options` property.
		 */
		_optionsChanged: function() {
			this._setOptions(this.options);
			this._filterOptions(/**@type {String}*/this._currentFilterValue);
		},
		
		/**
		 * Automatically fired by `CbnDataSource.ConsumerBehavior` after a new data source is set.
		 */
		_dataSourceInitializedCallback: function() {
			this._setOptions([]);
			this._filterOptions(/**@type {String}*/this._currentFilterValue);
			if (this._delayedValue) {
				this._queryOptions(this._currentFilterValue);
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
		 */
		_queryOptions: function(query) {
			this._currentFilterValue = query;
			if (this._dataSource) {
				this._optionsLoading = true;
				var isDataAvailable = this._dataSource.query(query);
				if (isDataAvailable) {
					this._dataSourceAvailableCallback();
				} // otherwise, wait for the data-available event
				
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
			
			for (var i=0; i<items.length; i++) {
				var itemMeta = {
					item: items[i],
					label: this._getItemLabel(items[i]),
					filterValue: this._getItemFilterValue(items[i]),
					hashValue: this._getItemHash(items[i])
				};
				mOptions.push(itemMeta);
				mOptionValues.push(this._getItemValue(itemMeta.item));
			}
			
			this._options = mOptions;
			this._optionValues = mOptionValues;
			this._filteredOptions = [];
			
			// select the delayed value (if set)
			if (this._delayedValue && this._options.length) {
				var delayedValue = this._delayedValue;
				this._delayedValue = null;
				this._setIndirectValue(delayedValue, { delayed: true });
			}
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
			if (typeof item != 'object')
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
			if (typeof item != 'object')
				return item;
			if (this.itemHashProperty && item && item[this.itemHashProperty]) {
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
			return (this.filterProperty ? item[this.filterProperty] : item );
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
