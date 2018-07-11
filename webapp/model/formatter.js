sap.ui.define([
	], function () {
		"use strict";

		return {
			/**
			 * Rounds the currency value to 2 digits
			 *
			 * @public
			 * @param {string} sValue value to be formatted
			 * @returns {string} formatted currency value with 2 digits
			 */
			currencyValue : function (sValue) {
				if (!sValue) {
					return "";
				}

				return parseFloat(sValue).toFixed(2);
			},
			
			brakeLine : function(value) {
				if (!value) {
					return "";
				}
				var valueArr = value.split(';');
				var newValue = '';
				for(var i = 0; i < valueArr.length; i++){
					newValue = newValue + valueArr[i] + '\n';
				}
				newValue.slice(0, -2);
				return newValue;
			}
		};

	}
);