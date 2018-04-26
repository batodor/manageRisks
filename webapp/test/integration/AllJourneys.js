/*global QUnit*/

jQuery.sap.require("sap.ui.qunit.qunit-css");
jQuery.sap.require("sap.ui.thirdparty.qunit");
jQuery.sap.require("sap.ui.qunit.qunit-junit");
QUnit.config.autostart = false;

// We cannot provide stable mock data out of the template.
// If you introduce mock data, by adding .json files in your webapp/localService/mockdata folder you have to provide the following minimum data:
// * At least 3 CounterpartyListSet in the list
// * All 3 CounterpartyListSet have at least one ToComplianceRisks

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
		"managerisks/test/integration/MasterJourney",
		"managerisks/test/integration/NavigationJourney",
		"managerisks/test/integration/NotFoundJourney",
		"managerisks/test/integration/BusyJourney",
		"managerisks/test/integration/FLPIntegrationJourney"
	], function () {
		QUnit.start();
	});
});