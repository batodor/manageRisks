/*global QUnit*/

jQuery.sap.require("sap.ui.qunit.qunit-css");
jQuery.sap.require("sap.ui.thirdparty.qunit");
jQuery.sap.require("sap.ui.qunit.qunit-junit");
QUnit.config.autostart = false;

sap.ui.require([
	"sap/ui/test/Opa5",
	"managerisks/test/integration/pages/Common",
	"sap/ui/test/opaQunit",
	"managerisks/test/integration/pages/App",
	"managerisks/test/integration/pages/Browser",
	"managerisks/test/integration/pages/Master",
	"managerisks/test/integration/pages/Detail",
	"managerisks/test/integration/pages/NotFound"
], function (Opa5, Common) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Common(),
		viewNamespace: "managerisks.view."
	});

	sap.ui.require([
		"managerisks/test/integration/NavigationJourneyPhone",
		"managerisks/test/integration/NotFoundJourneyPhone",
		"managerisks/test/integration/BusyJourneyPhone"
	], function () {
		QUnit.start();
	});
});