(function(scope) {
	
	scope.utils = {};
	
	/**
	 * Computes a space-separated list containing all map keys that evaluate to true.
	 * 
	 * @param obj The source map (plain object).
	 * @returns {string} A space-separated list of keys that have a positive value.
	 */
	scope.utils.tokenList = function(obj) {
		var result = '';
		for (var n in obj) {
			if (!obj.hasOwnProperty(n)) continue;
			if (obj[n]) {
				result += (result ? ' ' : '') + n;
			}
		}
		return result;
	};
	
	/**
	 * Generic highlight computation routine that returns the absolute index of the item to be highlighted.
	 * 
	 * @param {int|String} idx The index of the option to highlight.
	 * @param {Boolean}    relative Whether the index is relative to the currently highlighted item.
	 * @param {Array}      arr The target options array.
	 * @param {int}        curIdx The index of the currently highlighted item.
	 * @return {int} The absolute index of the item to highlight.
	 */
	scope.utils.computeHighlightIdx = function(idx, relative, arr, curIdx) {
		var absIdx = idx;
		
		if (!arr.length) // nothing to select
			return -1;
		if (idx === null) // de-highlight
			return -1;
		
		if (curIdx == -1 && relative) {
			if (idx > 0) idx = 'first';
			if (idx < 0) idx = 'last';
		}
		if (idx == 'first') {
			absIdx = 0;
		} else if (idx == 'last') {
			absIdx = arr.length-1;
		} else if (relative) {
			absIdx = curIdx + idx;
		}
		if (absIdx < 0) absIdx = 0;
		if (absIdx >= arr.length) absIdx = arr.length-1;
		
		return absIdx;
	};
	
	
})(window.CbnForm.CbnSelect);
