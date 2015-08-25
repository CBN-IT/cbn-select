(function(scope) {
	
	scope.utils = {};
	
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
	
})(window.CbnForm.CbnSelect);
